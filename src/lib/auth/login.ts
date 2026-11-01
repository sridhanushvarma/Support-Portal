import { prisma } from "../db";
import { decrypt, encrypt } from "../crypto";
import { recordAudit } from "../audit";
import { logger } from "../logger";
import { consumeRateLimit, ipSubject, RATE_LIMITS, resetRateLimit } from "../rate-limit";
import { dummyPasswordHash, verifyPassword } from "./password";
import { generateTotpSecret, verifyTotp } from "./totp";

export const GENERIC_LOGIN_ERROR = "Email or password is incorrect, or the account is not active.";
const LOCK_THRESHOLD = 10;
const LOCK_MINUTES = 15;

export type LoginOutcome =
  | { ok: true; userId: string; mfaEnrolled: boolean }
  | { ok: false; reason: "invalid" | "rate_limited" | "locked" };

/**
 * Password step of sign-in. Messages never reveal whether an account exists.
 * Rate limited per IP and per account; repeated failures lock the account briefly.
 */
export async function authenticatePassword(
  emailRaw: string,
  password: string,
  meta: { ip: string; requestId: string },
): Promise<LoginOutcome> {
  const email = emailRaw.trim().toLowerCase().slice(0, 254);
  const [ipRl, acctRl] = await Promise.all([
    consumeRateLimit(RATE_LIMITS.loginIp, ipSubject(meta.ip)),
    consumeRateLimit(RATE_LIMITS.loginAccount, `acct:${email}`),
  ]);
  if (!ipRl.allowed || !acctRl.allowed) {
    logger.warn("auth.rate_limited", { requestId: meta.requestId });
    return { ok: false, reason: "rate_limited" };
  }
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !user.active) {
    await verifyPassword(password, await dummyPasswordHash()); // uniform timing
    await recordAudit({
      action: "auth.login_failed",
      requestId: meta.requestId,
      metadata: { reason: "unknown_or_inactive" },
    });
    return { ok: false, reason: "invalid" };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordAudit({
      actor: user,
      action: "auth.login_blocked",
      entityType: "user",
      entityId: user.id,
      requestId: meta.requestId,
    });
    return { ok: false, reason: "locked" };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil: failed >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await recordAudit({
      actor: user,
      action: "auth.login_failed",
      entityType: "user",
      entityId: user.id,
      requestId: meta.requestId,
      metadata: { reason: "bad_password", failed },
    });
    return { ok: false, reason: failed >= LOCK_THRESHOLD ? "locked" : "invalid" };
  }
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null },
  });
  await resetRateLimit(RATE_LIMITS.loginAccount, `acct:${email}`);
  return {
    ok: true,
    userId: user.id,
    mfaEnrolled: user.mfaEnabledAt !== null && user.mfaSecretEnc !== null,
  };
}

export async function completeLogin(userId: string, requestId: string, mfa: boolean) {
  const user = await prisma.adminUser.update({
    where: { id: userId },
    data: { lastSignInAt: new Date() },
  });
  await recordAudit({
    actor: user,
    action: "auth.login_succeeded",
    entityType: "user",
    entityId: user.id,
    requestId,
    metadata: { mfa },
  });
}

/** Verify a TOTP code for an enrolled user, rejecting replays. */
export async function verifyUserTotp(
  userId: string,
  code: string,
  meta: { requestId: string },
): Promise<"ok" | "invalid" | "rate_limited"> {
  const rl = await consumeRateLimit(RATE_LIMITS.mfa, `user:${userId}`);
  if (!rl.allowed) return "rate_limited";
  const user = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!user?.mfaSecretEnc || !user.active) return "invalid";
  const step = verifyTotp(decrypt(user.mfaSecretEnc), code, user.mfaLastUsedStep);
  if (step === null) {
    await recordAudit({
      actor: user,
      action: "auth.mfa_failed",
      entityType: "user",
      entityId: user.id,
      requestId: meta.requestId,
    });
    return "invalid";
  }
  // Conditional update closes the race where the same code is submitted twice concurrently.
  const { count } = await prisma.adminUser.updateMany({
    where: { id: userId, OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: step } }] },
    data: { mfaLastUsedStep: step },
  });
  if (count === 0) return "invalid";
  await resetRateLimit(RATE_LIMITS.mfa, `user:${userId}`);
  return "ok";
}

export function newMfaSecret(): { secret: string; encrypted: string } {
  const secret = generateTotpSecret();
  return { secret, encrypted: encrypt(secret) };
}

/** Confirm enrolment: the user proves possession of the secret before it is activated. */
export async function enrolMfa(
  userId: string,
  encryptedSecret: string,
  code: string,
  requestId: string,
): Promise<boolean> {
  let secret: string;
  try {
    secret = decrypt(encryptedSecret);
  } catch {
    return false;
  }
  const step = verifyTotp(secret, code, null);
  if (step === null) return false;
  const user = await prisma.adminUser.update({
    where: { id: userId },
    data: { mfaSecretEnc: encryptedSecret, mfaEnabledAt: new Date(), mfaLastUsedStep: step },
  });
  await recordAudit({
    actor: user,
    action: "auth.mfa_enrolled",
    entityType: "user",
    entityId: userId,
    requestId,
  });
  return true;
}
