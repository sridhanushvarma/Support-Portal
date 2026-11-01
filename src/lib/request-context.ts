import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { env } from "./env";

export const REQUEST_ID_HEADER = "x-request-id";

/** Extract client IP. X-Forwarded-For is honoured only when TRUST_PROXY=true. */
export function clientIpFrom(h: Headers): string {
  if (env().TRUST_PROXY) {
    const xff = h.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  }
  // Without a trusted proxy the App Router does not expose the socket address.
  // Deployments must sit behind a proxy/CDN with TRUST_PROXY=true (see docs/operations.md).
  return "unknown";
}

export async function requestContext() {
  const h = await headers();
  return {
    requestId: h.get(REQUEST_ID_HEADER) ?? randomUUID(),
    ip: clientIpFrom(h),
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
    origin: h.get("origin"),
    host: h.get("host"),
  };
}

export function requestIdFrom(h: Headers): string {
  return h.get(REQUEST_ID_HEADER) ?? randomUUID();
}
