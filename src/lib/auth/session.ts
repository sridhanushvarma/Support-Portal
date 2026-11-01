import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "../db";
import { env } from "../env";
import { hashIp, randomToken, sha256Hex } from "../crypto";
import { permissionsFor, type Permission } from "./permissions";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
  permissions: Set<Permission>;
  mfaEnabled: boolean;
}

export interface CurrentSession {
  sessionId: string;
  mfaPending: boolean;
  user: SessionUser;
}

export function sessionCookieName(): string {
  return env().SITE_URL.startsWith("https://") ? "__Host-cw_session" : "cw_session";
}

const TOUCH_INTERVAL_MS = 60_000;

export async function createSession(
  userId: string,
  opts: { mfaPending: boolean; ip: string; userAgent: string },
) {
  const token = randomToken(32);
  const maxMs = env().SESSION_MAX_HOURS * 3600_000;
  const expiresAt = new Date(Date.now() + maxMs);
  await prisma.session.create({
    data: {
      tokenHash: sha256Hex(token),
      userId,
      mfaPending: opts.mfaPending,
      expiresAt,
      ipHash: hashIp(opts.ip),
      userAgent: opts.userAgent.slice(0, 300),
    },
  });
  const jar = await cookies();
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: env().SITE_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Look up a session from a raw token, enforcing absolute and idle expiry. */
export async function sessionFromToken(
  token: string | undefined | null,
): Promise<CurrentSession | null> {
  if (!token || token.length > 200) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: { include: { roles: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  const idleMs = env().SESSION_IDLE_MINUTES * 60_000;
  const expired =
    session.expiresAt.getTime() <= now ||
    session.lastSeenAt.getTime() + idleMs <= now ||
    !session.user.active ||
    // Sessions created before a password change are invalid.
    (session.user.passwordChangedAt !== null && session.createdAt < session.user.passwordChangedAt);
  if (expired) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }
  const roles = session.user.roles.map((r) => r.role);
  return {
    sessionId: session.id,
    mfaPending: session.mfaPending,
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      roles,
      permissions: permissionsFor(roles),
      mfaEnabled: session.user.mfaEnabledAt !== null,
    },
  };
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const jar = await cookies();
  return sessionFromToken(jar.get(sessionCookieName())?.value);
}

export async function markSessionMfaVerified(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { mfaPending: false, lastSeenAt: new Date() },
  });
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256Hex(token) } });
  jar.delete(sessionCookieName());
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}

export async function purgeExpiredSessions() {
  const idleCutoff = new Date(Date.now() - env().SESSION_IDLE_MINUTES * 60_000);
  const { count } = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { lastSeenAt: { lt: idleCutoff } }] },
  });
  return count;
}
