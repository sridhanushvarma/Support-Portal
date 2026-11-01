import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "./db";

const optionalEmail = z.union([z.email(), z.literal("")]);
const optionalUrl = z.union([z.url({ protocol: /^https?$/ }), z.literal("")]);
const fieldMode = z.enum(["off", "optional", "required"]);

/** Editable, non-secret configuration (SiteSetting entity). Secrets live in environment variables. */
export const settingsSchema = z.object({
  siteName: z.string().trim().min(1).max(80),
  legalName: z.string().trim().max(160),
  tagline: z.string().trim().max(160),
  contactEmail: optionalEmail,
  contactPhone: z.string().trim().max(40),
  contactAddress: z.string().trim().max(400),
  businessHours: z.string().trim().max(120),
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
  primaryCtaLabel: z.string().trim().min(1).max(40),
  secondaryCtaLabel: z.string().trim().min(1).max(40),
  enquiryRecipients: z.array(z.email()).max(10),
  enquiryAckEnabled: z.boolean(),
  responseExpectation: z.string().trim().max(240),
  formPhone: fieldMode,
  formCountry: fieldMode,
  formTimeline: fieldMode,
  formBudget: fieldMode,
  privacyPolicyVersion: z.string().trim().min(1).max(40),
  privacyApproved: z.boolean(),
  analyticsConsentMode: z.enum(["opt-in", "notice-only", "disabled"]),
  enquiryRetentionDays: z.number().int().min(30).max(3650),
  adminTimeZone: z.string().trim().min(1).max(60),
  contentReviewDays: z.number().int().min(30).max(730),
});

export type SiteSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Your Company",
  legalName: "",
  tagline: "Business software, data and automation delivered with care.",
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  businessHours: "",
  linkedinUrl: "",
  githubUrl: "",
  primaryCtaLabel: "Discuss a project",
  secondaryCtaLabel: "Request a consultation",
  enquiryRecipients: [],
  enquiryAckEnabled: true,
  responseExpectation:
    "A member of our team will review your enquiry and reply within two business days.",
  formPhone: "optional",
  formCountry: "optional",
  formTimeline: "optional",
  formBudget: "optional",
  privacyPolicyVersion: "draft",
  privacyApproved: false,
  analyticsConsentMode: "opt-in",
  enquiryRetentionDays: 730,
  adminTimeZone: "UTC",
  contentReviewDays: 180,
};

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Load settings merged over defaults; invalid stored values fall back to defaults individually. */
export async function loadSettings(db: Db = prisma): Promise<SiteSettings> {
  const rows = await db.siteSetting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  const shape = settingsSchema.shape as Record<string, z.ZodType>;
  for (const row of rows) {
    const fieldSchema = shape[row.key];
    if (!fieldSchema) continue;
    const parsed = fieldSchema.safeParse(row.value);
    if (parsed.success) merged[row.key] = parsed.data;
  }
  return merged as SiteSettings;
}

export async function saveSettings(patch: Partial<SiteSettings>, actorId: string, db: Db = prisma) {
  const parsed = settingsSchema.partial().parse(patch);
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    await db.siteSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedBy: actorId },
      update: { value: value as Prisma.InputJsonValue, updatedBy: actorId },
    });
  }
}
