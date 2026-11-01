"use server";

import { revalidatePath } from "next/cache";
import { adminAction, fdString, type ActionState } from "@/lib/actions";
import { deleteMedia, updateAltText, uploadImage } from "@/lib/media/service";
import { ValidationError } from "@/lib/errors";

export async function uploadMediaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("media.upload", async (ctx) => {
    const file = fd.get("file");
    if (!(file instanceof File))
      throw ValidationError("Choose an image to upload.", { file: ["Choose an image."] });
    await uploadImage(ctx.user, file, fdString(fd, "altText"), ctx.requestId);
    revalidatePath("/admin/media");
    return "Image uploaded. It becomes public only when used by published content.";
  });
}

export async function updateAltAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("media.upload", async (ctx) => {
    await updateAltText(ctx.user, fdString(fd, "id"), fdString(fd, "altText"));
    revalidatePath("/admin/media");
    return "Alternative text updated. Republish projects using this image to update the live site.";
  });
}

export async function deleteMediaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("media.manage", async (ctx) => {
    await deleteMedia(ctx.user, fdString(fd, "id"), ctx.requestId);
    revalidatePath("/admin/media");
    return "Image deleted.";
  });
}
