import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Liveness: GET /api/health. Readiness (database reachable): GET /api/health?ready=1.
 * Exposes no versions, configuration or error detail (spec 11.1).
 */
export async function GET(req: Request) {
  const ready = new URL(req.url).searchParams.has("ready");
  if (!ready)
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", checks: { database: "ok" } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logger.error("health.database_unavailable", { error });
    return NextResponse.json(
      { status: "unavailable", checks: { database: "failed" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
