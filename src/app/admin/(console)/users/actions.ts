"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { adminAction, fdString, zodToFieldErrors, type ActionState } from "@/lib/actions";
import { ValidationError } from "@/lib/errors";
import {
  inviteUser,
  resetUserMfa,
  sendPasswordReset,
  setUserActive,
  updateUserRoles,
  userInputSchema,
} from "@/lib/users";

export async function inviteUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("users.manage", async (ctx) => {
    const parsed = userInputSchema.safeParse({
      email: fdString(fd, "email"),
      displayName: fdString(fd, "displayName"),
      roles: fd.getAll("roles").map(String),
    });
    if (!parsed.success)
      throw ValidationError(
        "Please fix the highlighted fields.",
        zodToFieldErrors(parsed.error.issues),
      );
    const { url, emailed } = await inviteUser(ctx, parsed.data);
    revalidatePath("/admin/users");
    return {
      message: emailed
        ? "Invitation sent. You can also share this single-use link securely (valid 48 hours):"
        : "The invitation email could not be sent. Share this single-use link securely (valid 48 hours):",
      data: { "Setup link": url },
    };
  });
}

export async function updateUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("users.manage", async (ctx) => {
    const id = fdString(fd, "id");
    const op = fdString(fd, "op");
    switch (op) {
      case "roles":
        await updateUserRoles(
          ctx,
          id,
          fd.getAll("roles").map(String) as Role[],
          fdString(fd, "displayName"),
        );
        revalidatePath(`/admin/users/${id}`);
        return "Roles updated. Changes apply to the user's next request.";
      case "deactivate":
      case "activate":
        await setUserActive(ctx, id, op === "activate");
        revalidatePath(`/admin/users/${id}`);
        return op === "activate"
          ? "Account re-activated."
          : "Account deactivated and signed out everywhere.";
      case "reset-mfa":
        await resetUserMfa(ctx, id);
        return "MFA reset. The user will set up a new authenticator at next sign-in.";
      case "reset-password": {
        const { url, emailed } = await sendPasswordReset(ctx, id);
        return {
          message: emailed
            ? "Reset link emailed. You can also share it securely:"
            : "The email could not be sent. Share this link securely:",
          data: { "Reset link": url },
        };
      }
      default:
        throw ValidationError("Unknown action.");
    }
  });
}
