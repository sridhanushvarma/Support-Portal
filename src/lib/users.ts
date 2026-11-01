import "server-only";
import { Prisma, type Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { env } from "./env";
import { randomToken, sha256Hex } from "./crypto";
import { recordAudit } from "./audit";
import type { SessionUser } from "./auth/session";
import { revokeAllSessions } from "./auth/session";
import { hashPassword, passwordPolicyError } from "./auth/password";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { emailProvider } from "./email/providers";
import { userSetupEmail } from "./email/templates";
import { loadSettings } from "./settings";
import { logger } from "./logger";

interface Ctx {
  user: SessionUser;
  requestId?: string;
}

const ROLES: Role[] = ["ADMIN", "PUBLISHER", "EDITOR", "SALES", "SALES_MANAGER", "MARKETING"];
export const SETUP_TOKEN_HOURS = 48;

export const userInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  displayName: z.string().trim().min(1, "Enter a name.").max(120),
  roles: z.array(z.enum(ROLES as [Role, ...Role[]])).min(1, "Choose at least one role."),
});

function needAdmin(user: SessionUser) {
  if (!user.permissions.has("users.manage")) throw ForbiddenError();
}

async function activeAdminCount(tx: Prisma.TransactionClient, excludeUserId?: string) {
  return tx.adminUser.count({
    where: {
      active: true,
      roles: { some: { role: "ADMIN" } },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

/** Issue a single-use setup/reset link. Only the hash is stored. */
export async function issueSetupToken(
  userId: string,
  purpose: "invite" | "reset",
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const token = randomToken(32);
  await db.userSetupToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  }); // invalidate older links
  await db.userSetupToken.create({
    data: {
      tokenHash: sha256Hex(token),
      userId,
      purpose,
      expiresAt: new Date(Date.now() + SETUP_TOKEN_HOURS * 3600_000),
    },
  });
  return `${env().SITE_URL}/admin/setup?token=${encodeURIComponent(token)}`;
}

async function sendSetupEmail(
  to: string,
  displayName: string,
  url: string,
  purpose: "invite" | "reset",
): Promise<boolean> {
  try {
    const settings = await loadSettings();
    await emailProvider().send(
      userSetupEmail(
        {
          siteName: settings.siteName,
          displayName,
          setupUrl: url,
          expiresHours: SETUP_TOKEN_HOURS,
          purpose,
        },
        to,
      ),
    );
    return true;
  } catch (error) {
    logger.warn("users.setup_email_failed", { error });
    return false;
  }
}

/** Invite a user (UC-07). Returns the setup link so the administrator can share it if email fails. */
export async function inviteUser(ctx: Ctx, input: z.infer<typeof userInputSchema>) {
  needAdmin(ctx.user);
  try {
    const { user, url } = await prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          roles: { create: input.roles.map((role) => ({ role, grantedBy: ctx.user.id })) },
        },
      });
      const url = await issueSetupToken(user.id, "invite", tx);
      await recordAudit(
        {
          actor: ctx.user,
          action: "user.invited",
          entityType: "user",
          entityId: user.id,
          requestId: ctx.requestId,
          metadata: { roles: input.roles },
        },
        tx,
      );
      return { user, url };
    });
    const emailed = await sendSetupEmail(user.email, user.displayName, url, "invite");
    return { user, url, emailed };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw ValidationError("A user with that email already exists.", {
        email: ["A user with that email already exists."],
      });
    }
    throw e;
  }
}

/** Grant/revoke roles (FR-ADM-010). Users cannot change their own roles; the last administrator cannot be removed. */
export async function updateUserRoles(
  ctx: Ctx,
  userId: string,
  roles: Role[],
  displayName: string,
) {
  needAdmin(ctx.user);
  const parsed = z
    .array(z.enum(ROLES as [Role, ...Role[]]))
    .min(1, "Choose at least one role.")
    .safeParse(roles);
  if (!parsed.success)
    throw ValidationError("Choose at least one role.", { roles: ["Choose at least one role."] });
  if (userId === ctx.user.id) {
    const current = await prisma.userRole.findMany({ where: { userId } });
    const same =
      current.length === parsed.data.length && current.every((r) => parsed.data.includes(r.role));
    if (!same) throw ForbiddenError("You cannot change your own roles. Ask another administrator.");
  }
  await prisma.$transaction(async (tx) => {
    const target = await tx.adminUser.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!target) throw NotFoundError();
    const wasAdmin = target.roles.some((r) => r.role === "ADMIN");
    if (wasAdmin && !parsed.data.includes("ADMIN") && (await activeAdminCount(tx, userId)) === 0) {
      throw ConflictError("At least one active administrator is required.");
    }
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.createMany({
      data: parsed.data.map((role) => ({ userId, role, grantedBy: ctx.user.id })),
    });
    await tx.adminUser.update({
      where: { id: userId },
      data: { displayName: displayName.trim().slice(0, 120) || target.displayName },
    });
    await recordAudit(
      {
        actor: ctx.user,
        action: "user.roles_changed",
        entityType: "user",
        entityId: userId,
        requestId: ctx.requestId,
        metadata: { from: target.roles.map((r) => r.role), to: parsed.data },
      },
      tx,
    );
  });
}

export async function setUserActive(ctx: Ctx, userId: string, active: boolean) {
  needAdmin(ctx.user);
  if (userId === ctx.user.id && !active)
    throw ForbiddenError("You cannot deactivate your own account.");
  await prisma.$transaction(async (tx) => {
    const target = await tx.adminUser.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!target) throw NotFoundError();
    if (
      !active &&
      target.roles.some((r) => r.role === "ADMIN") &&
      (await activeAdminCount(tx, userId)) === 0
    ) {
      throw ConflictError("At least one active administrator is required.");
    }
    await tx.adminUser.update({ where: { id: userId }, data: { active } });
    if (!active) await tx.session.deleteMany({ where: { userId } });
    await recordAudit(
      {
        actor: ctx.user,
        action: active ? "user.reactivated" : "user.deactivated",
        entityType: "user",
        entityId: userId,
        requestId: ctx.requestId,
      },
      tx,
    );
  });
}

/** Lost authenticator: clears MFA so the user re-enrols at next sign-in. */
export async function resetUserMfa(ctx: Ctx, userId: string) {
  needAdmin(ctx.user);
  if (userId === ctx.user.id) throw ForbiddenError("Ask another administrator to reset your MFA.");
  await prisma.adminUser.update({
    where: { id: userId },
    data: { mfaSecretEnc: null, mfaEnabledAt: null, mfaLastUsedStep: null },
  });
  await revokeAllSessions(userId);
  await recordAudit({
    actor: ctx.user,
    action: "user.mfa_reset",
    entityType: "user",
    entityId: userId,
    requestId: ctx.requestId,
  });
}

export async function sendPasswordReset(ctx: Ctx, userId: string) {
  needAdmin(ctx.user);
  const user = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!user) throw NotFoundError();
  const url = await issueSetupToken(userId, "reset");
  const emailed = await sendSetupEmail(user.email, user.displayName, url, "reset");
  await recordAudit({
    actor: ctx.user,
    action: "user.reset_issued",
    entityType: "user",
    entityId: userId,
    requestId: ctx.requestId,
  });
  return { url, emailed };
}

export async function findValidSetupToken(token: string) {
  if (!token || token.length > 200) return null;
  const row = await prisma.userSetupToken.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.active) return null;
  return row;
}

/** Consume a setup token and set the password. All existing sessions are revoked (FR-ADM-009). */
export async function completeSetup(token: string, password: string, requestId: string) {
  const row = await findValidSetupToken(token);
  if (!row)
    throw ValidationError(
      "This link is invalid or has expired. Ask an administrator for a new one.",
    );
  const policy = passwordPolicyError(password, row.user.email);
  if (policy) throw ValidationError(policy, { password: [policy] });
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.userSetupToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw ValidationError("This link has already been used.");
    await tx.adminUser.update({
      where: { id: row.userId },
      data: { passwordHash, passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null },
    });
    await tx.session.deleteMany({ where: { userId: row.userId } });
    await recordAudit(
      {
        actor: { id: row.user.id, email: row.user.email },
        action: "user.password_set",
        entityType: "user",
        entityId: row.userId,
        requestId,
        metadata: { purpose: row.purpose },
      },
      tx,
    );
  });
  return row.user;
}

export async function changeOwnPassword(
  ctx: Ctx,
  currentPassword: string,
  newPassword: string,
  currentSessionId: string,
) {
  const { verifyPassword } = await import("./auth/password");
  const user = await prisma.adminUser.findUnique({ where: { id: ctx.user.id } });
  if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ValidationError("Current password is incorrect.", {
      currentPassword: ["Current password is incorrect."],
    });
  }
  const policy = passwordPolicyError(newPassword, user.email);
  if (policy) throw ValidationError(policy, { newPassword: [policy] });
  const passwordHash = await hashPassword(newPassword);
  // passwordChangedAt invalidates every older session; the current session is re-stamped so the user stays signed in.
  const changedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: changedAt },
    });
    await tx.session.deleteMany({ where: { userId: user.id, id: { not: currentSessionId } } });
    await tx.session.update({ where: { id: currentSessionId }, data: { createdAt: changedAt } });
    await recordAudit(
      {
        actor: ctx.user,
        action: "user.password_changed",
        entityType: "user",
        entityId: user.id,
        requestId: ctx.requestId,
      },
      tx,
    );
  });
}
