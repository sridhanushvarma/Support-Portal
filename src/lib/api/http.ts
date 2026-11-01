import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { env } from "../env";
import { AppError, isAppError, RateLimitedError } from "../errors";
import { consumeRateLimit, ipSubject, RATE_LIMITS } from "../rate-limit";
import { logger } from "../logger";
import { clientIpFrom, requestIdFrom } from "../request-context";

/** Consistent JSON error envelope that never leaks internals (URS-022). */
export function errorResponse(error: unknown, req: Request): NextResponse {
  const requestId = requestIdFrom(req.headers);
  if (isAppError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fields: error.fieldErrors, requestId } },
      {
        status: error.status,
        headers: error.status === 429 ? { "Retry-After": "600" } : undefined,
      },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid request.", requestId } },
      { status: 422 },
    );
  }
  logger.error("api.unhandled", { requestId, path: new URL(req.url).pathname, error });
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "Something went wrong. Please try again.",
        requestId,
      },
    },
    { status: 500 },
  );
}

/**
 * Same-origin check for state-changing requests authenticated by cookie
 * (CSRF defence in addition to SameSite=Lax cookies, NFR-10).
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const expected = new URL(env().SITE_URL).origin;
  if (origin) return origin === expected || origin === new URL(req.url).origin;
  const fetchSite = req.headers.get("sec-fetch-site");
  return fetchSite === "same-origin" || fetchSite === "none";
}

export async function readJson(req: Request, maxBytes = 32_768): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json"))
    throw new AppError("Send the body as application/json.", 415, "unsupported_media_type");
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new AppError("Request body is too large.", 413, "payload_too_large");
  const text = await req.text();
  if (text.length > maxBytes)
    throw new AppError("Request body is too large.", 413, "payload_too_large");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("Request body is not valid JSON.", 400, "invalid_json");
  }
}

/** Per-IP limit for public read APIs. */
export async function enforcePublicApiLimit(req: Request) {
  const rl = await consumeRateLimit(RATE_LIMITS.publicApi, ipSubject(clientIpFrom(req.headers)));
  if (!rl.allowed) throw RateLimitedError();
}
