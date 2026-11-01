import "server-only";
import { redirect } from "next/navigation";
import { env } from "../env";
import { ForbiddenError, UnauthenticatedError } from "../errors";
import { logger } from "../logger";
import type { Permission } from "./permissions";
import { getCurrentSession, type CurrentSession, type SessionUser } from "./session";

export function mfaRequired(): boolean {
  return env().ADMIN_MFA_REQUIRED;
}

/** Session that has completed sign-in (password and, where enrolled, MFA). */
async function fullSession(): Promise<CurrentSession | null> {
  const session = await getCurrentSession();
  if (!session || session.mfaPending) return null;
  return session;
}

/**
 * Guard for admin pages. Redirects to sign-in, MFA verification or MFA
 * enrolment as needed; redirects with a notice when permission is missing.
 */
export async function requireAdminPage(
  permission?: Permission,
  opts: { allowMfaSetup?: boolean } = {},
): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) redirect("/admin/login");
  if (session.mfaPending) redirect("/admin/login/verify");
  if (mfaRequired() && !session.user.mfaEnabled && !opts.allowMfaSetup)
    redirect("/admin/account/mfa?required=1");
  if (permission && !session.user.permissions.has(permission)) {
    logger.warn("authz.denied", { userId: session.user.id, permission });
    redirect("/admin?denied=1");
  }
  return session.user;
}

/** Guard for server actions and route handlers. Throws AppError (401/403). */
export async function requirePermission(permission?: Permission): Promise<SessionUser> {
  const session = await fullSession();
  if (!session) throw UnauthenticatedError();
  if (mfaRequired() && !session.user.mfaEnabled)
    throw ForbiddenError("Multi-factor authentication must be set up first.");
  if (permission && !session.user.permissions.has(permission)) {
    logger.warn("authz.denied", { userId: session.user.id, permission });
    throw ForbiddenError();
  }
  return session.user;
}

export function can(user: SessionUser, permission: Permission): boolean {
  return user.permissions.has(permission);
}
