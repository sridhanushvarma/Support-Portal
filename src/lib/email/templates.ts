import type { EmailMessage } from "./providers";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function layout(siteName: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1d2a36">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px">
<tr><td><p style="margin:0 0 16px;font-weight:bold;color:#0f2a43">${esc(siteName)}</p>${bodyHtml}</td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 14px;line-height:1.5">${esc(t)}</p>`;

export interface InternalEnquiryVars {
  siteName: string;
  reference: string;
  services: string[];
  adminUrl: string;
  receivedAt: string;
}

/** Internal notification: reference, service interest and a secure link only. No contact details or brief (UC-03 rule). */
export function internalEnquiryEmail(v: InternalEnquiryVars, to: string): EmailMessage {
  const services = v.services.join(", ") || "Not specified";
  const text = [
    `A new project enquiry has been received.`,
    ``,
    `Reference: ${v.reference}`,
    `Service interest: ${services}`,
    `Received: ${v.receivedAt} (UTC)`,
    ``,
    `Review it in the admin area (sign-in required):`,
    v.adminUrl,
  ].join("\n");
  const html = layout(
    v.siteName,
    p("A new project enquiry has been received.") +
      p(`Reference: ${v.reference}`) +
      p(`Service interest: ${services}`) +
      p(`Received: ${v.receivedAt} (UTC)`) +
      `<p style="margin:20px 0"><a href="${esc(v.adminUrl)}" style="background:#0f766e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Review enquiry</a></p>` +
      p(
        "Sign-in is required. Contact details and the project brief are only shown in the admin area.",
      ),
  );
  return { to, subject: `New enquiry ${v.reference}`, text, html };
}

export interface AckVars {
  siteName: string;
  firstName: string;
  reference: string;
  responseExpectation: string;
  siteUrl: string;
}

/** Submitter receipt. Not an acceptance, quote or commitment (BR-06). Never repeats the brief. */
export function acknowledgementEmail(v: AckVars, to: string): EmailMessage {
  const lines = [
    `Hello ${v.firstName},`,
    ``,
    `Thank you for contacting ${v.siteName}. We have received your enquiry (reference ${v.reference}).`,
    v.responseExpectation,
    ``,
    `This message confirms receipt only. It is not an acceptance of the project, a quotation or a commitment.`,
    ``,
    `If you did not submit this enquiry, you can ignore this email.`,
    ``,
    `${v.siteName}`,
    v.siteUrl,
  ];
  const html = layout(
    v.siteName,
    p(`Hello ${v.firstName},`) +
      p(
        `Thank you for contacting ${v.siteName}. We have received your enquiry (reference ${v.reference}).`,
      ) +
      (v.responseExpectation ? p(v.responseExpectation) : "") +
      p(
        "This message confirms receipt only. It is not an acceptance of the project, a quotation or a commitment.",
      ) +
      p("If you did not submit this enquiry, you can ignore this email."),
  );
  return { to, subject: `We received your enquiry (${v.reference})`, text: lines.join("\n"), html };
}

export interface OpsAlertVars {
  siteName: string;
  failureClass: string;
  reference: string | null;
  notificationId: string;
  occurredAt: string;
  adminUrl: string;
}

export function opsAlertEmail(v: OpsAlertVars, to: string): EmailMessage {
  const text = [
    `Notification delivery failed and retries are exhausted.`,
    ``,
    `Failure class: ${v.failureClass}`,
    `Enquiry reference: ${v.reference ?? "n/a"}`,
    `Notification id: ${v.notificationId}`,
    `Time: ${v.occurredAt} (UTC)`,
    ``,
    `The enquiry itself is stored safely. Follow up manually and review notification health:`,
    v.adminUrl,
  ].join("\n");
  const html = layout(v.siteName, text.split("\n").filter(Boolean).map(p).join(""));
  return {
    to,
    subject: `[Alert] Notification delivery failed${v.reference ? ` for ${v.reference}` : ""}`,
    text,
    html,
  };
}

export interface InviteVars {
  siteName: string;
  displayName: string;
  setupUrl: string;
  expiresHours: number;
  purpose: "invite" | "reset";
}

export function userSetupEmail(v: InviteVars, to: string): EmailMessage {
  const intro =
    v.purpose === "invite"
      ? `You have been given access to the ${v.siteName} website administration area.`
      : `A password reset was requested for your ${v.siteName} administration account.`;
  const text = [
    `Hello ${v.displayName},`,
    ``,
    intro,
    `Set your password using this link (valid for ${v.expiresHours} hours, single use):`,
    v.setupUrl,
    ``,
    `If you were not expecting this, contact your administrator.`,
  ].join("\n");
  const html = layout(
    v.siteName,
    p(`Hello ${v.displayName},`) +
      p(intro) +
      `<p style="margin:20px 0"><a href="${esc(v.setupUrl)}" style="background:#0f766e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Set password</a></p>` +
      p(`The link is valid for ${v.expiresHours} hours and can be used once.`) +
      p("If you were not expecting this, contact your administrator."),
  );
  return {
    to,
    subject:
      v.purpose === "invite"
        ? `Your ${v.siteName} admin access`
        : `Reset your ${v.siteName} admin password`,
    text,
    html,
  };
}
