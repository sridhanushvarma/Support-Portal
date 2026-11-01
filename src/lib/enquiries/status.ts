import type { EnquiryStatus } from "@prisma/client";

export const ENQUIRY_STATUSES: EnquiryStatus[] = [
  "NEW",
  "IN_REVIEW",
  "QUALIFIED",
  "IN_PROGRESS",
  "WON",
  "LOST",
  "NOT_QUALIFIED",
  "CLOSED",
];

export const STATUS_LABELS: Record<EnquiryStatus, string> = {
  NEW: "New",
  IN_REVIEW: "In review",
  QUALIFIED: "Qualified",
  IN_PROGRESS: "In progress",
  WON: "Won",
  LOST: "Lost",
  NOT_QUALIFIED: "Not qualified",
  CLOSED: "Closed",
};

/** Allowed lead status transitions (FR-LEAD-003). */
export const STATUS_TRANSITIONS: Record<EnquiryStatus, EnquiryStatus[]> = {
  NEW: ["IN_REVIEW", "QUALIFIED", "NOT_QUALIFIED", "CLOSED"],
  IN_REVIEW: ["QUALIFIED", "NOT_QUALIFIED", "CLOSED"],
  QUALIFIED: ["IN_PROGRESS", "LOST", "NOT_QUALIFIED", "CLOSED"],
  IN_PROGRESS: ["WON", "LOST", "CLOSED"],
  WON: ["CLOSED"],
  LOST: ["IN_PROGRESS", "CLOSED"],
  NOT_QUALIFIED: ["IN_REVIEW", "CLOSED"],
  CLOSED: ["IN_REVIEW"],
};

export const TERMINAL_STATUSES: EnquiryStatus[] = ["WON", "LOST", "NOT_QUALIFIED", "CLOSED"];

export function canTransition(from: EnquiryStatus, to: EnquiryStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}
