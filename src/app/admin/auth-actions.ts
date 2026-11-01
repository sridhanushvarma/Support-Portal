"use server";

import { redirect } from "next/navigation";
import { requestContext } from "@/lib/request-context";
import {
  authenticatePassword,
  completeLogin,
  enrolMfa,
  GENERIC_LOGIN_ERROR,
  verifyUserTotp,
} from "@/lib/auth/login";
import {
  createSession,
  destroyCurrentSession,
  getCurrentSession,
  markSessionMfaVerified,
} from "@/lib/auth/session";
import { completeSetup } from "@/lib/users";
import { isAppError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions";

/** Only same-site admin paths are accepted as post-login destinations (open-redirect protection). */
function safeNext(raw: FormDataEntryValue | null): string {
  const v = typeof raw === "string" ? raw : "";
  return /^\/admin(\/[\w\-/?=&%.]*)?$/.test(v) && !v.startsWith("//") ? v : "/admin";
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requestContext();
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  if (!email || !password)
    return { ok: false, message: "Enter your email and password.", nonce: Date.now() };
  const result = await authenticatePassword(email, password.slice(0, 256), {
    ip: ctx.ip,
    requestId: ctx.requestId,
  });
  if (!result.ok) {
    const message =
      result.reason === "rate_limited"
        ? "Too many sign-in attempts. Wait 15 minutes and try again."
        : result.reason === "locked"
          ? "This account is temporarily locked after repeated failed attempts. Try again in 15 minutes or ask an administrator."
          : GENERIC_LOGIN_ERROR;
    return { ok: false, message, nonce: Date.now() };
  }
  await createSession(result.userId, {
    mfaPending: result.mfaEnrolled,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  const next = safeNext(fd.get("next"));
  if (result.mfaEnrolled) redirect(`/admin/login/verify?next=${encodeURIComponent(next)}`);
  await completeLogin(result.userId, ctx.requestId, false);
  redirect(next);
}

export async function verifyMfaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requestContext();
  const session = await getCurrentSession();
  if (!session) redirect("/admin/login");
  if (!session.mfaPending) redirect("/admin");
  const outcome = await verifyUserTotp(session.user.id, String(fd.get("code") ?? ""), {
    requestId: ctx.requestId,
  });
  if (outcome === "rate_limited") {
    await destroyCurrentSession();
    return {
      ok: false,
      message: "Too many incorrect codes. Sign in again in 15 minutes.",
      nonce: Date.now(),
    };
  }
  if (outcome !== "ok")
    return {
      ok: false,
      message: "That code is not valid. Check your authenticator app and try again.",
      fieldErrors: { code: ["Enter the current 6-digit code."] },
      nonce: Date.now(),
    };
  await markSessionMfaVerified(session.sessionId);
  await completeLogin(session.user.id, ctx.requestId, true);
  redirect(safeNext(fd.get("next")));
}

export async function enrolMfaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requestContext();
  const session = await getCurrentSession();
  if (!session || session.mfaPending) redirect("/admin/login");
  const ok = await enrolMfa(
    session.user.id,
    String(fd.get("secret") ?? ""),
    String(fd.get("code") ?? ""),
    ctx.requestId,
  );
  if (!ok)
    return {
      ok: false,
      message:
        "That code did not match. Make sure your device clock is correct and enter the current code.",
      fieldErrors: { code: ["Enter the current 6-digit code."] },
      nonce: Date.now(),
    };
  redirect("/admin?mfa=enabled");
}

export async function setupPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requestContext();
  const password = String(fd.get("password") ?? "");
  if (password !== String(fd.get("confirm") ?? ""))
    return {
      ok: false,
      message: "The passwords do not match.",
      fieldErrors: { confirm: ["Passwords do not match."] },
      nonce: Date.now(),
    };
  try {
    await completeSetup(String(fd.get("token") ?? ""), password, ctx.requestId);
  } catch (e) {
    if (isAppError(e))
      return { ok: false, message: e.message, fieldErrors: e.fieldErrors, nonce: Date.now() };
    throw e;
  }
  redirect("/admin/login?setup=done");
}

export async function logoutAction() {
  const session = await getCurrentSession();
  if (session)
    await recordAudit({
      actor: session.user,
      action: "auth.logout",
      entityType: "user",
      entityId: session.user.id,
    });
  await destroyCurrentSession();
  redirect("/admin/login?signedout=1");
}
