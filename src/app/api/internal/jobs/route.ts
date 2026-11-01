import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runMaintenanceJobs, runNotificationJob } from "@/lib/jobs";
import { errorResponse } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/**
 * Scheduled jobs for platforms without a long-running worker (e.g. a cron
 * service). Requires `Authorization: Bearer $CRON_SECRET`; disabled when unset.
 */
export async function POST(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 24 || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }
  try {
    const notifications = await runNotificationJob();
    const maintenance = await runMaintenanceJobs();
    return NextResponse.json({ data: { notifications, maintenance } });
  } catch (e) {
    return errorResponse(e, req);
  }
}
