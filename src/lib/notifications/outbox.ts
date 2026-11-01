import type { Notification, Prisma } from "@prisma/client";
import { prisma, type Db } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { loadSettings, type SiteSettings } from "../settings";
import { emailProvider, EmailDeliveryError, type EmailMessage } from "../email/providers";
import { acknowledgementEmail, internalEnquiryEmail, opsAlertEmail } from "../email/templates";

/**
 * Transactional outbox for email (UC-09, NFR-15). Rows are written in the same
 * transaction as the enquiry, so a stored enquiry always has its notifications
 * queued, and email failure can never roll back or delete the enquiry (BR-05).
 */

export const MAX_ATTEMPTS = 6;
const BACKOFF_SECONDS = [60, 300, 900, 3600, 3 * 3600, 6 * 3600];
const LOCK_SECONDS = 120;

export type NotificationKind = "enquiry_internal" | "enquiry_ack" | "ops_alert";

interface InternalPayload {
  reference: string;
  services: string[];
  receivedAt: string;
}
interface AckPayload {
  reference: string;
  firstName: string;
}
interface OpsPayload {
  failureClass: string;
  reference: string | null;
  notificationId: string;
  occurredAt: string;
}

export function backoffSeconds(attempts: number): number {
  return BACKOFF_SECONDS[Math.min(Math.max(attempts - 1, 0), BACKOFF_SECONDS.length - 1)]!;
}

export async function enqueueEnquiryNotifications(
  db: Db,
  enquiry: { id: string; reference: string; createdAt: Date; name: string; email: string },
  services: string[],
  settings: SiteSettings,
) {
  const recipients = settings.enquiryRecipients.length
    ? settings.enquiryRecipients
    : env().OPS_ALERT_EMAIL
      ? [env().OPS_ALERT_EMAIL!]
      : [];
  if (recipients.length === 0) {
    logger.warn("notifications.no_recipients", { enquiryId: enquiry.id });
  }
  const internal: InternalPayload = {
    reference: enquiry.reference,
    services,
    receivedAt: enquiry.createdAt.toISOString().replace("T", " ").slice(0, 16),
  };
  const rows: Prisma.NotificationCreateManyInput[] = recipients.map((to) => ({
    kind: "enquiry_internal",
    enquiryId: enquiry.id,
    recipient: to,
    payload: internal as unknown as Prisma.InputJsonValue,
  }));
  if (settings.enquiryAckEnabled) {
    const ack: AckPayload = {
      reference: enquiry.reference,
      firstName: enquiry.name.split(" ")[0] || enquiry.name,
    };
    rows.push({
      kind: "enquiry_ack",
      enquiryId: enquiry.id,
      recipient: enquiry.email,
      payload: ack as unknown as Prisma.InputJsonValue,
    });
  }
  if (rows.length) await db.notification.createMany({ data: rows });
}

function render(n: Notification, settings: SiteSettings): EmailMessage {
  const siteUrl = env().SITE_URL;
  switch (n.kind as NotificationKind) {
    case "enquiry_internal": {
      const p = n.payload as unknown as InternalPayload;
      return internalEnquiryEmail(
        {
          siteName: settings.siteName,
          reference: p.reference,
          services: p.services,
          receivedAt: p.receivedAt,
          adminUrl: `${siteUrl}/admin/enquiries/${n.enquiryId}`,
        },
        n.recipient,
      );
    }
    case "enquiry_ack": {
      const p = n.payload as unknown as AckPayload;
      return acknowledgementEmail(
        {
          siteName: settings.siteName,
          firstName: p.firstName,
          reference: p.reference,
          responseExpectation: settings.responseExpectation,
          siteUrl,
        },
        n.recipient,
      );
    }
    case "ops_alert": {
      const p = n.payload as unknown as OpsPayload;
      return opsAlertEmail(
        { siteName: settings.siteName, ...p, adminUrl: `${siteUrl}/admin/notifications` },
        n.recipient,
      );
    }
    default:
      throw new EmailDeliveryError(`Unknown notification kind ${n.kind}`, true);
  }
}

/** Atomically claim due notifications so concurrent workers never send the same row twice. */
async function claimDue(limit: number): Promise<Notification[]> {
  return prisma.$queryRaw<Notification[]>`
    UPDATE "Notification" SET "lockedUntil" = now() + make_interval(secs => ${LOCK_SECONDS}), "updatedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "Notification"
      WHERE "status" IN ('PENDING', 'FAILED') AND "nextAttemptAt" <= now()
        AND ("lockedUntil" IS NULL OR "lockedUntil" < now())
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

async function raiseOpsAlert(n: Notification, failureClass: string, reference: string | null) {
  logger.error("notifications.dead", {
    notificationId: n.id,
    kind: n.kind,
    enquiryId: n.enquiryId,
    failureClass,
  });
  const to = env().OPS_ALERT_EMAIL;
  if (!to || n.kind === "ops_alert") return; // never alert about alerts (prevents loops)
  const payload: OpsPayload = {
    failureClass,
    reference,
    notificationId: n.id,
    occurredAt: new Date().toISOString().replace("T", " ").slice(0, 16),
  };
  await prisma.notification.create({
    data: {
      kind: "ops_alert",
      enquiryId: n.enquiryId,
      recipient: to,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
}

export interface ProcessResult {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
}

export async function processDueNotifications(limit = 20): Promise<ProcessResult> {
  const claimed = await claimDue(limit);
  const result: ProcessResult = { claimed: claimed.length, sent: 0, failed: 0, dead: 0 };
  if (claimed.length === 0) return result;
  const settings = await loadSettings();
  for (const n of claimed) {
    const attempts = n.attempts + 1;
    try {
      const message = render(n, settings);
      await emailProvider().send(message);
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "SENT", attempts, sentAt: new Date(), lockedUntil: null, lastError: null },
      });
      result.sent++;
    } catch (error) {
      const permanent = error instanceof EmailDeliveryError && error.permanent;
      const failureClass = permanent ? "permanent" : "transient";
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      const dead = permanent || attempts >= MAX_ATTEMPTS;
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          status: dead ? "DEAD" : "FAILED",
          attempts,
          lastError: message,
          lockedUntil: null,
          nextAttemptAt: new Date(Date.now() + backoffSeconds(attempts) * 1000),
        },
      });
      logger.warn("notifications.send_failed", {
        notificationId: n.id,
        kind: n.kind,
        attempts,
        failureClass,
        error: message,
      });
      if (dead) {
        result.dead++;
        const ref = n.enquiryId
          ? ((
              await prisma.enquiry.findUnique({
                where: { id: n.enquiryId },
                select: { reference: true },
              })
            )?.reference ?? null)
          : null;
        await raiseOpsAlert(n, failureClass, ref);
      } else result.failed++;
    }
  }
  return result;
}

/** Manual retry from the admin area once the underlying problem is fixed (UC-09 step 6). */
export async function requeueNotification(id: string) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || (n.status !== "DEAD" && n.status !== "FAILED")) return false;
  await prisma.notification.update({
    where: { id },
    data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lockedUntil: null },
  });
  return true;
}

export async function purgeOldNotifications(days = 90) {
  const cutoff = new Date(Date.now() - days * 86400_000);
  const { count } = await prisma.notification.deleteMany({
    where: { status: { in: ["SENT", "SKIPPED"] }, updatedAt: { lt: cutoff } },
  });
  return count;
}
