"use server";

import { revalidatePath } from "next/cache";
import { adminAction, fdString, type ActionState } from "@/lib/actions";
import { recordAudit } from "@/lib/audit";
import { processDueNotifications, requeueNotification } from "@/lib/notifications/outbox";

export async function retryNotificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("notifications.manage", async (ctx) => {
    const id = fdString(fd, "id");
    const ok = await requeueNotification(id);
    if (!ok) return { ok: false, message: "That notification is not in a failed state." };
    await recordAudit({
      actor: ctx.user,
      action: "notification.requeued",
      entityType: "notification",
      entityId: id,
      requestId: ctx.requestId,
    });
    const result = await processDueNotifications(5);
    revalidatePath("/admin/notifications");
    return result.sent > 0
      ? "Retried and delivered."
      : "Queued for retry. If the problem persists, check the email provider configuration.";
  });
}
