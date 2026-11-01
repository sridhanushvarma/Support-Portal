"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  analyticsAllowed,
  readConsent,
  writeConsent,
  type ConsentMode,
} from "@/lib/analytics/client";

const SCRIPT_URL = process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL ?? "";
const DOMAIN = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN ?? "";

export const analyticsConfigured = () => Boolean(SCRIPT_URL);

function loadScript() {
  if (!SCRIPT_URL || document.getElementById("cw-analytics")) return;
  const s = document.createElement("script");
  s.id = "cw-analytics";
  s.defer = true;
  s.src = SCRIPT_URL;
  if (DOMAIN) s.dataset.domain = DOMAIN;
  document.head.appendChild(s);
  if (!window.plausible) {
    // Queue events until the script loads (standard Plausible stub).
    const queue: unknown[] = [];
    const stub = Object.assign((...args: unknown[]) => void queue.push(args), { q: queue });
    window.plausible = stub as unknown as Window["plausible"];
  }
}

/**
 * Loads the analytics script only when permitted by the configured consent
 * mode (FR-AN-002) and shows a banner when an explicit choice is required.
 */
export function AnalyticsConsent({ mode }: { mode: ConsentMode }) {
  const [needsChoice, setNeedsChoice] = useState(false);

  useEffect(() => {
    window.__cwConsentMode = mode;
    const sync = () => {
      const consent = readConsent();
      if (analyticsConfigured() && analyticsAllowed(mode, consent)) loadScript();
      setNeedsChoice(analyticsConfigured() && mode === "opt-in" && consent === null);
    };
    sync();
    const reopen = () => setNeedsChoice(true);
    window.addEventListener("cw:consent", sync);
    window.addEventListener("cw:consent-open", reopen);
    return () => {
      window.removeEventListener("cw:consent", sync);
      window.removeEventListener("cw:consent-open", reopen);
    };
  }, [mode]);

  if (!needsChoice) return null;
  return (
    <div
      role="region"
      aria-label="Analytics preferences"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white shadow-[0_-8px_24px_rgba(11,31,51,0.08)]"
    >
      <div className="container-page flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
        <p className="max-w-3xl text-sm text-ink-soft">
          We would like to use privacy-friendly analytics to understand which pages are useful. No
          form contents are collected.{" "}
          <Link href="/privacy" className="link">
            Privacy notice
          </Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => writeConsent("denied")}
          >
            Decline
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => writeConsent("granted")}
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConsentPreferencesButton() {
  if (!analyticsConfigured()) return null;
  return (
    <button
      type="button"
      className="hover:text-white hover:underline"
      onClick={() => window.dispatchEvent(new Event("cw:consent-open"))}
    >
      Analytics preferences
    </button>
  );
}
