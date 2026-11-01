"use client";

import { useEffect } from "react";
import { analyticsAllowed, readConsent } from "@/lib/analytics/client";

const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

/**
 * Remembers campaign tags from the landing URL for the duration of the tab
 * session so the enquiry can be attributed to its source (FR-LEAD-002).
 * Stored only when analytics is permitted by the visitor's choice.
 */
export function UtmCapture() {
  useEffect(() => {
    try {
      if (!analyticsAllowed(window.__cwConsentMode, readConsent())) return;
      const params = new URLSearchParams(location.search);
      const found = Object.fromEntries(
        KEYS.flatMap((k) => (params.get(k) ? [[k, params.get(k)!.slice(0, 150)]] : [])),
      );
      if (Object.keys(found).length) sessionStorage.setItem("cw_utm", JSON.stringify(found));
    } catch {
      /* storage may be unavailable */
    }
  }, []);
  return null;
}
