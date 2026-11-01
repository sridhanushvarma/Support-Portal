import { prisma } from "../src/lib/db";
import { env } from "../src/lib/env";
import { logger } from "../src/lib/logger";
import { runMaintenanceJobs, runNotificationJob } from "../src/lib/jobs";

/**
 * Long-running background worker: delivers queued notifications with bounded
 * retries (UC-09) and runs hourly maintenance (retention, expired sessions,
 * rate-limit buckets). Safe to run more than one instance: work is claimed
 * with row locks.
 *
 *   npm run worker            (development, via tsx)
 *   node dist/worker.mjs      (production image)
 */
const NOTIFY_INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 15_000);
const MAINTENANCE_INTERVAL_MS = 60 * 60_000;

let stopping = false;
let lastMaintenance = 0;
let wake: (() => void) | null = null;

/** Sleep that ends early on shutdown so the container stops promptly. */
function pause(ms: number) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    wake = () => {
      clearTimeout(t);
      resolve();
    };
  });
}

async function tick() {
  try {
    const r = await runNotificationJob();
    if (r.claimed > 0) logger.info("worker.notifications", { ...r });
    if (Date.now() - lastMaintenance >= MAINTENANCE_INTERVAL_MS) {
      await runMaintenanceJobs();
      lastMaintenance = Date.now();
    }
  } catch (error) {
    logger.error("worker.tick_failed", { error });
  }
}

async function main() {
  env(); // fail fast on invalid configuration
  logger.info("worker.started", { intervalMs: NOTIFY_INTERVAL_MS });
  while (!stopping) {
    await tick();
    if (!stopping) await pause(NOTIFY_INTERVAL_MS);
  }
  await prisma.$disconnect();
  logger.info("worker.stopped");
}

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    stopping = true;
    wake?.();
  });
}

main().catch((error) => {
  logger.error("worker.crashed", { error });
  process.exit(1);
});
