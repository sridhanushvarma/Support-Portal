import { prisma } from "./db";
import { logger } from "./logger";
import { loadSettings } from "./settings";
import { processDueNotifications, purgeOldNotifications } from "./notifications/outbox";
import { purgeExpiredRateLimits } from "./rate-limit";
import { runEnquiryRetention } from "./enquiries/admin";

/**
 * Housekeeping run by the worker process (scripts/worker.ts) or the protected
 * jobs endpoint. Every step is idempotent and safe to run concurrently.
 */
export async function runNotificationJob() {
  return processDueNotifications(25);
}

export async function runMaintenanceJobs() {
  const settings = await loadSettings();
  const now = new Date();
  const [anonymised, notifications, rateLimits, sessions, tokens] = await Promise.all([
    runEnquiryRetention(settings.enquiryRetentionDays),
    purgeOldNotifications(90),
    purgeExpiredRateLimits(),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }).then((r) => r.count),
    prisma.userSetupToken
      .deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86400_000) } } })
      .then((r) => r.count),
  ]);
  const result = { anonymised, notifications, rateLimits, sessions, tokens };
  if (Object.values(result).some((v) => v > 0)) logger.info("jobs.maintenance", result);
  return result;
}
