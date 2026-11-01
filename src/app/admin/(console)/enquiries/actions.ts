"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminAction, fdString, zodToFieldErrors, type ActionState } from "@/lib/actions";
import {
  activitySchema,
  addEnquiryActivity,
  anonymiseEnquiry,
  deleteEnquiry,
  enquiryUpdateSchema,
  updateEnquiry,
} from "@/lib/enquiries/admin";
import { ValidationError } from "@/lib/errors";

export async function updateEnquiryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("enquiries.update", async (ctx) => {
    const id = fdString(fd, "id");
    const parsed = enquiryUpdateSchema.safeParse({
      status: fdString(fd, "status") || undefined,
      assignedToId: fd.has("assignedToId") ? fdString(fd, "assignedToId") : undefined,
      version: fdString(fd, "version"),
    });
    if (!parsed.success)
      throw ValidationError("Check the highlighted fields.", zodToFieldErrors(parsed.error.issues));
    await updateEnquiry(ctx, id, parsed.data);
    revalidatePath(`/admin/enquiries/${id}`);
    revalidatePath("/admin/enquiries");
    return "Enquiry updated.";
  });
}

export async function addActivityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("enquiries.update", async (ctx) => {
    const id = fdString(fd, "id");
    const parsed = activitySchema.safeParse({
      type: fdString(fd, "type"),
      body: fdString(fd, "body"),
    });
    if (!parsed.success)
      throw ValidationError("Check the note.", zodToFieldErrors(parsed.error.issues));
    await addEnquiryActivity(ctx, id, parsed.data);
    revalidatePath(`/admin/enquiries/${id}`);
    return parsed.data.type === "note" ? "Note added." : "Follow-up recorded.";
  });
}

export async function removePersonalDataAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const mode = fdString(fd, "mode");
  const id = fdString(fd, "id");
  const result = await adminAction("enquiries.delete", async (ctx) => {
    if (fdString(fd, "confirm") !== "on")
      throw ValidationError("Tick the box to confirm.", {
        confirm: ["Confirm that you understand this cannot be undone."],
      });
    const reason = fdString(fd, "reason");
    if (mode === "delete") await deleteEnquiry(ctx, id, reason);
    else await anonymiseEnquiry(ctx, id, reason);
    revalidatePath("/admin/enquiries");
    return mode === "delete" ? "Enquiry deleted." : "Personal data removed.";
  });
  if (result.ok && mode === "delete") redirect("/admin/enquiries?deleted=1");
  if (result.ok) revalidatePath(`/admin/enquiries/${id}`);
  return result;
}
