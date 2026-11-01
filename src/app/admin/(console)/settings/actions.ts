"use server";

import { revalidatePath } from "next/cache";
import { adminAction, fdLines, fdString, zodToFieldErrors, type ActionState } from "@/lib/actions";
import { recordAudit } from "@/lib/audit";
import { invalidate } from "@/lib/cache-tags";
import { ValidationError } from "@/lib/errors";
import { isValidTimeZone, saveSettings, settingsSchema } from "@/lib/settings";

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (ctx) => {
    const candidate = {
      siteName: fdString(fd, "siteName"),
      legalName: fdString(fd, "legalName"),
      tagline: fdString(fd, "tagline"),
      contactEmail: fdString(fd, "contactEmail").trim(),
      contactPhone: fdString(fd, "contactPhone"),
      contactAddress: fdString(fd, "contactAddress"),
      businessHours: fdString(fd, "businessHours"),
      linkedinUrl: fdString(fd, "linkedinUrl").trim(),
      githubUrl: fdString(fd, "githubUrl").trim(),
      primaryCtaLabel: fdString(fd, "primaryCtaLabel"),
      secondaryCtaLabel: fdString(fd, "secondaryCtaLabel"),
      enquiryRecipients: fdLines(fd, "enquiryRecipients").map((e) => e.toLowerCase()),
      enquiryAckEnabled: fd.get("enquiryAckEnabled") === "on",
      responseExpectation: fdString(fd, "responseExpectation"),
      formPhone: fdString(fd, "formPhone"),
      formCountry: fdString(fd, "formCountry"),
      formTimeline: fdString(fd, "formTimeline"),
      formBudget: fdString(fd, "formBudget"),
      privacyPolicyVersion: fdString(fd, "privacyPolicyVersion"),
      privacyApproved: fd.get("privacyApproved") === "on",
      analyticsConsentMode: fdString(fd, "analyticsConsentMode"),
      enquiryRetentionDays: Number(fdString(fd, "enquiryRetentionDays")),
      adminTimeZone: fdString(fd, "adminTimeZone").trim(),
      contentReviewDays: Number(fdString(fd, "contentReviewDays")),
    };
    const parsed = settingsSchema.safeParse(candidate);
    if (!parsed.success)
      throw ValidationError(
        "Please fix the highlighted fields.",
        zodToFieldErrors(parsed.error.issues),
      );
    if (!isValidTimeZone(parsed.data.adminTimeZone))
      throw ValidationError("Unknown time zone.", {
        adminTimeZone: ["Use an IANA time zone such as Europe/London or Asia/Kolkata."],
      });
    await saveSettings(parsed.data, ctx.user.id);
    await recordAudit({
      actor: ctx.user,
      action: "settings.updated",
      entityType: "settings",
      requestId: ctx.requestId,
      metadata: { keys: Object.keys(parsed.data) },
    });
    invalidate("settings");
    revalidatePath("/admin/settings");
    return "Settings saved.";
  });
}
