import { sessionFromToken } from "../auth/session";
import { mfaRequired } from "../auth/guard";
import type { Permission } from "../auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "../errors";
import { cookies } from "next/headers";
import { sessionCookieName } from "../auth/session";
import { isSameOrigin } from "./http";
import { logger } from "../logger";

/** Authenticate an admin API request (FR-ADM-001/002). Mutations must also be same-origin. */
export async function requireApiUser(req: Request, permission: Permission) {
  if (req.method !== "GET" && req.method !== "HEAD" && !isSameOrigin(req))
    throw ForbiddenError("Cross-origin request rejected.");
  const jar = await cookies();
  const session = await sessionFromToken(jar.get(sessionCookieName())?.value);
  if (!session || session.mfaPending) throw UnauthenticatedError();
  if (mfaRequired() && !session.user.mfaEnabled)
    throw ForbiddenError("Multi-factor authentication must be set up first.");
  if (!session.user.permissions.has(permission)) {
    logger.warn("authz.denied", {
      userId: session.user.id,
      permission,
      path: new URL(req.url).pathname,
    });
    throw ForbiddenError();
  }
  return session.user;
}
