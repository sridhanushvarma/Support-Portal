import type { Role } from "@prisma/client";

/** Server-side permission policy (FR-ADM-002, BR-08). UI hiding is cosmetic only. */
export const PERMISSIONS = [
  "content.edit",
  "content.publish",
  "content.approve_evidence",
  "media.upload",
  "media.manage",
  "redirects.manage",
  "enquiries.read",
  "enquiries.update",
  "enquiries.export",
  "enquiries.delete",
  "reports.read",
  "users.manage",
  "settings.manage",
  "audit.read",
  "notifications.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "users.manage",
    "settings.manage",
    "audit.read",
    "redirects.manage",
    "notifications.manage",
    "media.manage",
    "reports.read",
  ],
  PUBLISHER: [
    "content.edit",
    "content.publish",
    "content.approve_evidence",
    "media.upload",
    "media.manage",
    "redirects.manage",
    "reports.read",
  ],
  EDITOR: ["content.edit", "media.upload"],
  SALES: ["enquiries.read", "enquiries.update", "reports.read"],
  SALES_MANAGER: [
    "enquiries.read",
    "enquiries.update",
    "enquiries.export",
    "enquiries.delete",
    "reports.read",
    "notifications.manage",
  ],
  MARKETING: ["reports.read"],
};

export const ROLE_LABELS: Record<Role, { label: string; description: string }> = {
  ADMIN: {
    label: "Administrator",
    description: "Users, roles, settings, audit log, redirects and notification health.",
  },
  PUBLISHER: {
    label: "Publisher",
    description: "Reviews, approves evidence, publishes, unpublishes and archives content.",
  },
  EDITOR: { label: "Editor", description: "Creates and edits content and submits it for review." },
  SALES: {
    label: "Business development",
    description: "Reviews enquiries, updates status, assigns owners and adds notes.",
  },
  SALES_MANAGER: {
    label: "Business development manager",
    description: "Business development plus CSV export and enquiry deletion/anonymisation.",
  },
  MARKETING: {
    label: "Marketing / analytics",
    description: "Aggregated enquiry and conversion reporting without personal data.",
  },
};

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role] ?? []) out.add(p);
  return out;
}

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}
