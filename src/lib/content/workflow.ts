import type { ContentStatus } from "@prisma/client";
import type { Permission } from "../auth/permissions";

export type ContentAction =
  "submit" | "withdraw" | "publish" | "reject" | "unpublish" | "archive" | "restore" | "delete";

export interface WorkflowState {
  status: ContentStatus;
  isLive: boolean;
  everPublished: boolean;
}

const RULES: Record<
  ContentAction,
  { permission: Permission; allowed: (s: WorkflowState) => boolean; label: string }
> = {
  submit: {
    permission: "content.edit",
    allowed: (s) => s.status === "DRAFT",
    label: "Submit for review",
  },
  withdraw: {
    permission: "content.edit",
    allowed: (s) => s.status === "IN_REVIEW",
    label: "Withdraw from review",
  },
  publish: {
    permission: "content.publish",
    allowed: (s) => s.status === "DRAFT" || s.status === "IN_REVIEW",
    label: "Publish",
  },
  reject: {
    permission: "content.publish",
    allowed: (s) => s.status === "IN_REVIEW",
    label: "Return to draft",
  },
  unpublish: { permission: "content.publish", allowed: (s) => s.isLive, label: "Unpublish" },
  archive: {
    permission: "content.publish",
    allowed: (s) => s.status !== "ARCHIVED",
    label: "Archive",
  },
  restore: {
    permission: "content.publish",
    allowed: (s) => s.status === "ARCHIVED",
    label: "Restore to draft",
  },
  delete: {
    permission: "content.publish",
    allowed: (s) => !s.isLive && !s.everPublished,
    label: "Delete draft",
  },
};

export const ACTION_LABELS: Record<ContentAction, string> = Object.fromEntries(
  Object.entries(RULES).map(([k, v]) => [k, v.label]),
) as Record<ContentAction, string>;

/** Allowed state transitions for a role set (FR-ADM-006). Enforced server-side for every action. */
export function allowedActions(
  state: WorkflowState,
  permissions: Set<Permission>,
): ContentAction[] {
  return (Object.keys(RULES) as ContentAction[]).filter(
    (a) => RULES[a].allowed(state) && permissions.has(RULES[a].permission),
  );
}

export function canPerform(
  action: ContentAction,
  state: WorkflowState,
  permissions: Set<Permission>,
): boolean {
  return allowedActions(state, permissions).includes(action);
}

/** Status after an edit: editing live content creates a draft revision; the live snapshot is unaffected. */
export function statusAfterEdit(status: ContentStatus): ContentStatus {
  if (status === "ARCHIVED") return "ARCHIVED";
  if (status === "IN_REVIEW") return "IN_REVIEW";
  return "DRAFT";
}

export const isEditable = (status: ContentStatus) => status !== "ARCHIVED";
