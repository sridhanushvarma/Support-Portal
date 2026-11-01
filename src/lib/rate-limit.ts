import { prisma } from "./db";
import { hashIp } from "./crypto";

export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  enquiryBurst: { name: "enq10m", limit: 5, windowSeconds: 600 },
  enquiryDaily: { name: "enq1d", limit: 20, windowSeconds: 86400 },
  loginIp: { name: "login-ip", limit: 20, windowSeconds: 900 },
  loginAccount: { name: "login-acct", limit: 8, windowSeconds: 900 },
  mfa: { name: "mfa", limit: 10, windowSeconds: 900 },
  exportUser: { name: "export", limit: 10, windowSeconds: 3600 },
  publicApi: { name: "api", limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter stored in PostgreSQL so limits hold across stateless
 * application instances (FR-ENQ-006). A single atomic upsert per check.
 */
export async function consumeRateLimit(
  rule: RateLimitRule,
  subject: string,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const key = `${rule.name}:${subject}`;

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "expiresAt")
    VALUES (${key}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" = EXCLUDED."windowStart" THEN "RateLimitBucket"."count" + 1 ELSE 1 END,
      "windowStart" = EXCLUDED."windowStart",
      "expiresAt" = EXCLUDED."expiresAt"
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.ceil((expiresAt.getTime() - now) / 1000),
  };
}

export const ipSubject = (ip: string) => `ip:${hashIp(ip)}`;

export async function resetRateLimit(rule: RateLimitRule, subject: string) {
  await prisma.rateLimitBucket.deleteMany({ where: { key: `${rule.name}:${subject}` } });
}

export async function purgeExpiredRateLimits() {
  const { count } = await prisma.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
