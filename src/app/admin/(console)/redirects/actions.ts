"use server";

import { revalidatePath } from "next/cache";
import { adminAction, fdString, type ActionState } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { upsertRedirect } from "@/lib/redirects";
import { invalidate } from "@/lib/cache-tags";

export async function createRedirectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("redirects.manage", async (ctx) => {
    const code = Number(fdString(fd, "statusCode")) === 302 ? 302 : 308;
    const r = await prisma.$transaction(async (tx) => {
      const created = await upsertRedirect(tx, {
        sourcePath: fdString(fd, "sourcePath"),
        targetPath: fdString(fd, "targetPath"),
        statusCode: code,
        createdBy: ctx.user.id,
      });
      await recordAudit(
        {
          actor: ctx.user,
          action: "redirect.saved",
          entityType: "redirect",
          entityId: created.id,
          requestId: ctx.requestId,
          metadata: { from: created.sourcePath, to: created.targetPath },
        },
        tx,
      );
      return created;
    });
    invalidate("redirects");
    revalidatePath("/admin/redirects");
    return `Redirect saved: ${r.sourcePath} now points to the final destination.`;
  });
}

export async function toggleRedirectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("redirects.manage", async (ctx) => {
    const id = fdString(fd, "id");
    const op = fdString(fd, "op");
    if (op === "delete") {
      await prisma.redirect.delete({ where: { id } });
    } else {
      await prisma.redirect.update({ where: { id }, data: { enabled: op === "enable" } });
    }
    await recordAudit({
      actor: ctx.user,
      action: `redirect.${op}`,
      entityType: "redirect",
      entityId: id,
      requestId: ctx.requestId,
    });
    revalidatePath("/admin/redirects");
    return "Redirect updated.";
  });
}
