"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requestContext } from "@/lib/request-context";
import { isAppError, type FieldErrors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { issueFormToken, verifyFormToken } from "@/lib/enquiries/form-token";
import { enquiryRawFromFormData } from "@/lib/enquiries/schema";
import { SPAM_MESSAGE, submitEnquiry } from "@/lib/enquiries/submit";
import { processDueNotifications } from "@/lib/notifications/outbox";

export interface EnquiryFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  formToken: string;
}

const str = (fd: FormData, k: string, max = 200) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
};

export async function submitEnquiryAction(
  _prev: EnquiryFormState,
  fd: FormData,
): Promise<EnquiryFormState> {
  const ctx = await requestContext();
  const token = verifyFormToken(fd.get("formToken"));
  if (!token.ok) {
    if (token.reason === "too_fast")
      return {
        status: "error",
        message: SPAM_MESSAGE,
        formToken: issueFormToken(Date.now() - 60_000),
      };
    return {
      status: "error",
      message:
        "This form expired before it was sent. Your answers are still here. Please submit again.",
      formToken: issueFormToken(Date.now() - 60_000),
    };
  }

  let reference: string;
  try {
    const result = await submitEnquiry(enquiryRawFromFormData(fd), {
      ip: ctx.ip,
      requestId: ctx.requestId,
      submissionKey: token.nonce,
      honeypot: str(fd, "website"),
      source: {
        path: str(fd, "sourcePath", 300),
        service: str(fd, "sourceService", 80),
        utmSource: str(fd, "utm_source", 100),
        utmMedium: str(fd, "utm_medium", 100),
        utmCampaign: str(fd, "utm_campaign", 150),
        utmTerm: str(fd, "utm_term", 150),
        utmContent: str(fd, "utm_content", 150),
        referrerHost: str(fd, "referrerHost", 253),
      },
    });
    reference = result.reference;
  } catch (error) {
    if (isAppError(error)) {
      return {
        status: "error",
        message: error.message,
        fieldErrors: error.fieldErrors,
        formToken: fd.get("formToken") as string,
      };
    }
    logger.error("enquiry.action_failed", { requestId: ctx.requestId, error });
    return {
      status: "error",
      message:
        "Something went wrong and your enquiry was not sent. Please try again, or contact us by email.",
      formToken: fd.get("formToken") as string,
    };
  }

  // Deliver notifications after the response is sent; the worker retries any failures.
  after(async () => {
    try {
      await processDueNotifications(10);
    } catch (error) {
      logger.warn("notifications.inline_process_failed", { error });
    }
  });
  redirect(`/thank-you?ref=${encodeURIComponent(reference)}`);
}
