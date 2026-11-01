"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

/** Fires the conversion event once, after the server has confirmed persistence (FR-AN-001). */
export function SubmissionTracker() {
  useEffect(() => {
    track("enquiry_submitted");
  }, []);
  return null;
}
