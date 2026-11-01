"use server";

import { adminAction, fdString, type ActionState } from "@/lib/actions";
import { getCurrentSession } from "@/lib/auth/session";
import { UnauthenticatedError, ValidationError } from "@/lib/errors";
import { changeOwnPassword } from "@/lib/users";

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction(null, async (ctx) => {
    const session = await getCurrentSession();
    if (!session) throw UnauthenticatedError();
    const next = fdString(fd, "newPassword");
    if (next !== fdString(fd, "confirmPassword"))
      throw ValidationError("The new passwords do not match.", {
        confirmPassword: ["Passwords do not match."],
      });
    await changeOwnPassword(ctx, fdString(fd, "currentPassword"), next, session.sessionId);
    return "Password changed. Other sessions have been signed out.";
  });
}
