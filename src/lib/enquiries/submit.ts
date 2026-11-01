import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { humanReference } from "../crypto";
import { recordAudit } from "../audit";
import { AppError, RateLimitedError, ValidationError, type FieldErrors } from "../errors";
import { logger } from "../logger";
import { consumeRateLimit, ipSubject, RATE_LIMITS } from "../rate-limit";
import { loadSettings, type SiteSettings } from "../settings";
import { fetchPublishedServices } from "../content/public-data";
import { enqueueEnquiryNotifications } from "../notifications/outbox";
import { buildEnquirySchema, type EnquiryFormConfig } from "./schema";

export interface SubmissionSource {
  path?: string | null;
  service?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  referrerHost?: string | null;
}

export interface SubmissionMeta {
  ip: string;
  requestId: string;
  /** Idempotency key: the signed form nonce or the API Idempotency-Key header. */
  submissionKey: string;
  honeypot?: string | null;
  source?: SubmissionSource;
}

export interface SubmissionResult {
  id: string;
  reference: string;
  duplicate: boolean;
}

export const SPAM_MESSAGE =
  "We could not accept this submission. Please wait a moment and try again, or contact us directly by email.";

const sourceSchema = z
  .object({
    path: z
      .string()
      .max(300)
      .regex(/^\/[^\s]*$/)
      .nullish(),
    service: z.string().max(80).nullish(),
    utmSource: z.string().max(100).nullish(),
    utmMedium: z.string().max(100).nullish(),
    utmCampaign: z.string().max(150).nullish(),
    utmTerm: z.string().max(150).nullish(),
    utmContent: z.string().max(150).nullish(),
    referrerHost: z.string().max(253).nullish(),
  })
  .partial();

export function formConfig(settings: SiteSettings, serviceSlugs: string[]): EnquiryFormConfig {
  return {
    phone: settings.formPhone,
    country: settings.formCountry,
    timeline: settings.formTimeline,
    budget: settings.formBudget,
    serviceSlugs,
  };
}

function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Create a project enquiry (UC-03). Success is returned only after the
 * database transaction commits (BR-04); the same submission key never creates
 * a second record (FR-ENQ-005). Notifications are queued in the same
 * transaction and delivered asynchronously.
 */
export async function submitEnquiry(raw: unknown, meta: SubmissionMeta): Promise<SubmissionResult> {
  if (meta.honeypot && meta.honeypot.trim() !== "") {
    logger.warn("enquiry.spam_honeypot", { requestId: meta.requestId });
    throw new AppError(SPAM_MESSAGE, 400, "rejected");
  }
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(meta.submissionKey)) {
    throw new AppError("Missing or invalid submission key.", 400, "invalid_submission_key");
  }

  // A retried submission returns the original receipt without consuming rate-limit budget.
  const existing = await prisma.enquiry.findUnique({
    where: { submissionKey: meta.submissionKey },
    select: { id: true, reference: true },
  });
  if (existing) return { ...existing, duplicate: true };

  for (const rule of [RATE_LIMITS.enquiryBurst, RATE_LIMITS.enquiryDaily]) {
    const rl = await consumeRateLimit(rule, ipSubject(meta.ip));
    if (!rl.allowed) {
      logger.warn("enquiry.rate_limited", { requestId: meta.requestId, rule: rule.name });
      throw RateLimitedError(
        "You have sent several enquiries in a short time. Please try again later or email us directly.",
      );
    }
  }

  const [settings, services] = await Promise.all([loadSettings(), fetchPublishedServices()]);
  const schema = buildEnquirySchema(
    formConfig(
      settings,
      services.map((s) => s.slug),
    ),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw ValidationError("Please correct the highlighted fields.", zodFieldErrors(parsed.error));
  const input = parsed.data;
  const source = sourceSchema.safeParse(meta.source ?? {});
  const src = source.success ? source.data : {};

  const selected = services.filter((s) => input.services.includes(s.slug));
  const reference = humanReference("ENQ");

  try {
    const enquiry = await prisma.$transaction(async (tx) => {
      const created = await tx.enquiry.create({
        data: {
          reference,
          submissionKey: meta.submissionKey,
          name: input.name,
          email: input.email,
          emailNormalized: input.email.toLowerCase(),
          organisation: input.organisation,
          phone: input.phone,
          country: input.country,
          projectSummary: input.projectSummary,
          timeline: input.timeline,
          budgetRange: input.budgetRange,
          contactPreference: input.contactPreference,
          sourcePath: src.path ?? null,
          sourceService: src.service ?? null,
          utmSource: src.utmSource ?? null,
          utmMedium: src.utmMedium ?? null,
          utmCampaign: src.utmCampaign ?? null,
          utmTerm: src.utmTerm ?? null,
          utmContent: src.utmContent ?? null,
          referrerHost: src.referrerHost ?? null,
          serviceInterests: {
            create: selected.map((s) => ({ serviceId: s.id, serviceLabel: s.name })),
          },
          consents: {
            create: {
              purpose: "privacy_notice_acknowledged",
              policyVersion: settings.privacyPolicyVersion,
              choice: true,
              captureSource: "enquiry_form",
            },
          },
          activities: { create: { type: "system", body: "Enquiry received via website form." } },
        },
      });
      await enqueueEnquiryNotifications(
        tx,
        created,
        selected.map((s) => s.name),
        settings,
      );
      await recordAudit(
        {
          action: "enquiry.created",
          entityType: "enquiry",
          entityId: created.id,
          requestId: meta.requestId,
          metadata: { services: selected.map((s) => s.slug) },
        },
        tx,
      );
      return created;
    });
    logger.info("enquiry.created", { enquiryId: enquiry.id, requestId: meta.requestId });
    return { id: enquiry.id, reference: enquiry.reference, duplicate: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Concurrent duplicate of the same submission: return the winner's receipt.
      const winner = await prisma.enquiry.findUnique({
        where: { submissionKey: meta.submissionKey },
        select: { id: true, reference: true },
      });
      if (winner) return { ...winner, duplicate: true };
    }
    logger.error("enquiry.persist_failed", { requestId: meta.requestId, error });
    throw new AppError(
      "Your enquiry could not be submitted because of a technical problem. Nothing was sent. Please try again in a few minutes or contact us by email.",
      503,
      "persistence_failed",
    );
  }
}
