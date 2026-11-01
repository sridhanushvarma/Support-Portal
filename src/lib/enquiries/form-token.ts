import { randomUUID } from "node:crypto";
import { hmacHex, safeEqual } from "../crypto";

/**
 * Signed, stateless form token. Its nonce is the idempotency key for a single
 * rendered form (FR-ENQ-005); its timestamp supports a minimum completion time
 * that filters most bots without a CAPTCHA (FR-ENQ-006, accessible by default).
 */
export const MIN_FILL_MS = 2500;
export const MAX_AGE_MS = 24 * 3600_000;

export function issueFormToken(now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ n: randomUUID(), t: now })).toString("base64url");
  return `${payload}.${hmacHex(`enquiry-form:${payload}`)}`;
}

export type TokenCheck =
  | { ok: true; nonce: string; issuedAt: number }
  | { ok: false; reason: "invalid" | "expired" | "too_fast" };

export function verifyFormToken(token: unknown, now = Date.now()): TokenCheck {
  if (typeof token !== "string" || token.length > 300) return { ok: false, reason: "invalid" };
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, hmacHex(`enquiry-form:${payload}`)))
    return { ok: false, reason: "invalid" };
  try {
    const { n, t } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      n: string;
      t: number;
    };
    if (typeof n !== "string" || typeof t !== "number") return { ok: false, reason: "invalid" };
    if (now - t > MAX_AGE_MS) return { ok: false, reason: "expired" };
    if (now - t < MIN_FILL_MS) return { ok: false, reason: "too_fast" };
    return { ok: true, nonce: n, issuedAt: t };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
