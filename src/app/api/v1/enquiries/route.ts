import { NextResponse, after } from "next/server";
import { errorResponse, readJson } from "@/lib/api/http";
import { AppError } from "@/lib/errors";
import { clientIpFrom, requestIdFrom } from "@/lib/request-context";
import { submitEnquiry } from "@/lib/enquiries/submit";
import { processDueNotifications } from "@/lib/notifications/outbox";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Create an enquiry (spec 11.1). Requires an `Idempotency-Key` header: a retry
 * with the same key returns the original receipt with 200 instead of 201.
 */
export async function POST(req: Request) {
  try {
    const key = req.headers.get("idempotency-key");
    if (!key)
      throw new AppError(
        "Send an Idempotency-Key header (8–100 characters: letters, digits, '-' or '_').",
        400,
        "idempotency_key_required",
      );
    const body = (await readJson(req)) as Record<string, unknown>;
    const source = (body.source ?? {}) as Record<string, unknown>;
    const result = await submitEnquiry(body, {
      ip: clientIpFrom(req.headers),
      requestId: requestIdFrom(req.headers),
      submissionKey: key,
      honeypot: typeof body.website === "string" ? body.website : null,
      source: {
        path: typeof source.path === "string" ? source.path : null,
        service: typeof source.service === "string" ? source.service : null,
        utmSource: typeof source.utmSource === "string" ? source.utmSource : null,
        utmMedium: typeof source.utmMedium === "string" ? source.utmMedium : null,
        utmCampaign: typeof source.utmCampaign === "string" ? source.utmCampaign : null,
      },
    });
    if (!result.duplicate) {
      after(async () => {
        await processDueNotifications(10).catch((error) =>
          logger.warn("notifications.inline_process_failed", { error }),
        );
      });
    }
    return NextResponse.json(
      { data: { reference: result.reference } },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}
