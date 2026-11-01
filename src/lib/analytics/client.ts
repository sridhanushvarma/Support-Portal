"use client";

/**
 * Consent-aware analytics wrapper (FR-AN-001/002, BR-12). Event properties are
 * restricted to short, non-personal values; form contents are never sent.
 */
export type AnalyticsEvent =
  | "cta_click"
  | "enquiry_form_start"
  | "enquiry_validation_error"
  | "enquiry_submitted"
  | "project_filter";

type Props = Record<string, string | number | boolean>;
export const CONSENT_COOKIE = "cw_consent";
export type ConsentMode = "opt-in" | "notice-only" | "disabled";

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Props }) => void;
    dataLayer?: unknown[];
    __cwConsentMode?: ConsentMode;
  }
}

export function readConsent(): "granted" | "denied" | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )cw_consent=(granted|denied)/);
  return (m?.[1] as "granted" | "denied") ?? null;
}

export function writeConsent(value: "granted" | "denied") {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${180 * 86400}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("cw:consent", { detail: value }));
}

export function analyticsAllowed(
  mode: ConsentMode | undefined,
  consent: "granted" | "denied" | null,
): boolean {
  if (mode === "disabled" || mode === undefined) return false;
  if (mode === "notice-only") return consent !== "denied";
  return consent === "granted";
}

const SAFE_VALUE = /^[\w .,:/-]{0,80}$/;

export function sanitizeProps(props: Props = {}): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props).slice(0, 8)) {
    if (!/^[a-z_]{1,32}$/.test(k)) continue;
    if (typeof v === "string") {
      if (SAFE_VALUE.test(v) && !v.includes("@")) out[k] = v;
    } else out[k] = v;
  }
  return out;
}

export function track(event: AnalyticsEvent, props?: Props) {
  if (typeof window === "undefined") return;
  const clean = sanitizeProps(props);
  // Always emitted locally for automated tests; never leaves the browser.
  window.dispatchEvent(new CustomEvent("cw:analytics", { detail: { event, props: clean } }));
  if (!analyticsAllowed(window.__cwConsentMode, readConsent())) return;
  window.plausible?.(event, { props: clean });
  window.dataLayer?.push({ event, ...clean });
}
