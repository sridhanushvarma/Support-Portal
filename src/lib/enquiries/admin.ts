import "server-only";
import type { EnquiryStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { recordAudit } from "../audit";
import type { SessionUser } from "../auth/session";
import { hasPermission } from "../auth/permissions";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from "../errors";
import { consumeRateLimit, RATE_LIMITS } from "../rate-limit";
import { toCsv } from "../csv";
import { BUDGETS, labelFor, TIMELINES } from "./schema";
import { canTransition, ENQUIRY_STATUSES, STATUS_LABELS, TERMINAL_STATUSES } from "./status";

interface Ctx {
  user: SessionUser;
  requestId?: string;
}

function need(user: SessionUser, permission: Parameters<typeof hasPermission>[1]) {
  if (!user.permissions.has(permission)) throw ForbiddenError();
}

// ---------------------------------------------------------------- Filters

export const enquiryFilterSchema = z.object({
  status: z
    .enum(ENQUIRY_STATUSES as [EnquiryStatus, ...EnquiryStatus[]])
    .optional()
    .catch(undefined),
  owner: z
    .union([z.literal("me"), z.literal("unassigned"), z.uuid()])
    .optional()
    .catch(undefined),
  service: z.uuid().optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type EnquiryFilters = z.infer<typeof enquiryFilterSchema>;

export function parseEnquiryFilters(
  params: Record<string, string | string[] | undefined>,
): EnquiryFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]),
  );
  return enquiryFilterSchema.parse(flat);
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

function whereFor(user: SessionUser, f: EnquiryFilters): Prisma.EnquiryWhereInput {
  const and: Prisma.EnquiryWhereInput[] = [];
  if (f.status) and.push({ status: f.status });
  if (f.owner === "me") and.push({ assignedToId: user.id });
  else if (f.owner === "unassigned") and.push({ assignedToId: null });
  else if (f.owner) and.push({ assignedToId: f.owner });
  if (f.service) and.push({ serviceInterests: { some: { serviceId: f.service } } });
  if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00.000Z`) } });
  if (f.to)
    and.push({
      createdAt: { lt: new Date(new Date(`${f.to}T00:00:00.000Z`).getTime() + 86400_000) },
    });
  if (f.q) {
    const q = escapeLike(f.q);
    and.push({
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { organisation: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { emailNormalized: { contains: q.toLowerCase() } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export const PAGE_SIZE = 25;

/** Lead inbox (FR-LEAD-001, FR-LEAD-006). Bounded, paginated queries only (NFR-05). */
export async function listEnquiries(ctx: Ctx, f: EnquiryFilters) {
  need(ctx.user, "enquiries.read");
  const where = whereFor(ctx.user, f);
  const [total, rows] = await Promise.all([
    prisma.enquiry.count({ where }),
    prisma.enquiry.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        createdAt: true,
        organisation: true,
        name: true,
        status: true,
        anonymisedAt: true,
        assignedTo: { select: { id: true, displayName: true } },
        serviceInterests: { select: { serviceLabel: true } },
      },
    }),
  ]);
  return { total, rows, page: f.page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Full detail (FR-LEAD-002). Values are rendered as escaped text by React. */
export async function getEnquiryDetail(ctx: Ctx, id: string) {
  need(ctx.user, "enquiries.read");
  if (!z.uuid().safeParse(id).success) throw NotFoundError();
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, displayName: true, email: true } },
      serviceInterests: { select: { serviceId: true, serviceLabel: true } },
      consents: { orderBy: { createdAt: "asc" } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { displayName: true } } },
      },
      notifications: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          status: true,
          attempts: true,
          lastError: true,
          sentAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!enquiry) throw NotFoundError();
  return enquiry;
}

/** Users who may own leads: active users with enquiry access. */
export async function assignableUsers() {
  const users = await prisma.adminUser.findMany({
    where: { active: true, roles: { some: { role: { in: ["SALES", "SALES_MANAGER"] } } } },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
  return users;
}

// ---------------------------------------------------------------- Updates

export const enquiryUpdateSchema = z.object({
  status: z.enum(ENQUIRY_STATUSES as [EnquiryStatus, ...EnquiryStatus[]]).optional(),
  assignedToId: z.union([z.uuid(), z.literal("")]).optional(),
  version: z.coerce.number().int().positive(),
});

/**
 * Change status and/or owner (FR-LEAD-003/004). Uses optimistic concurrency on
 * `version` so two users cannot silently overwrite each other (UC-04).
 */
export async function updateEnquiry(
  ctx: Ctx,
  id: string,
  input: z.infer<typeof enquiryUpdateSchema>,
) {
  need(ctx.user, "enquiries.update");
  const current = await prisma.enquiry.findUnique({ where: { id } });
  if (!current) throw NotFoundError();
  if (current.anonymisedAt) throw ConflictError("Anonymised enquiries cannot be changed.");

  const data: Prisma.EnquiryUncheckedUpdateManyInput = {};
  const activities: Prisma.EnquiryActivityCreateManyInput[] = [];
  const now = new Date();

  if (input.status && input.status !== current.status) {
    if (!canTransition(current.status, input.status)) {
      throw ValidationError(
        `Status cannot change from ${STATUS_LABELS[current.status]} to ${STATUS_LABELS[input.status]}.`,
        { status: ["That status change is not allowed."] },
      );
    }
    data.status = input.status;
    if (current.status === "NEW" && !current.firstResponseAt) data.firstResponseAt = now;
    data.closedAt = TERMINAL_STATUSES.includes(input.status) ? now : null;
    activities.push({
      enquiryId: id,
      type: "status_change",
      actorId: ctx.user.id,
      metadata: { from: current.status, to: input.status },
    });
  }

  if (input.assignedToId !== undefined) {
    const newOwner = input.assignedToId || null;
    if (newOwner !== current.assignedToId) {
      if (newOwner) {
        const owner = await prisma.adminUser.findFirst({
          where: {
            id: newOwner,
            active: true,
            roles: { some: { role: { in: ["SALES", "SALES_MANAGER"] } } },
          },
          select: { displayName: true },
        });
        if (!owner)
          throw ValidationError("Choose an active business development user.", {
            assignedToId: ["Choose an active business development user."],
          });
        activities.push({
          enquiryId: id,
          type: "assignment",
          actorId: ctx.user.id,
          body: `Assigned to ${owner.displayName}`,
          metadata: { to: newOwner },
        });
      } else {
        activities.push({
          enquiryId: id,
          type: "assignment",
          actorId: ctx.user.id,
          body: "Unassigned",
          metadata: { to: null },
        });
      }
      data.assignedToId = newOwner;
    }
  }

  if (activities.length === 0) return current;

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.enquiry.updateMany({
      where: { id, version: input.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (count === 0)
      throw ConflictError(
        "This enquiry was updated by someone else. Reload to see the latest version before changing it.",
      );
    await tx.enquiryActivity.createMany({ data: activities });
    await recordAudit(
      {
        actor: ctx.user,
        action: "enquiry.updated",
        entityType: "enquiry",
        entityId: id,
        requestId: ctx.requestId,
        metadata: {
          status: input.status ?? null,
          assignedToChanged: input.assignedToId !== undefined,
        },
      },
      tx,
    );
  });
  return prisma.enquiry.findUniqueOrThrow({ where: { id } });
}

export const activitySchema = z.object({
  type: z.enum(["note", "follow_up"]),
  body: z.string().trim().min(1, "Write a note.").max(5000, "Use 5000 characters or fewer."),
});

/** Internal notes and follow-up records (FR-LEAD-005). Never shown publicly or emailed. */
export async function addEnquiryActivity(
  ctx: Ctx,
  id: string,
  input: z.infer<typeof activitySchema>,
) {
  need(ctx.user, "enquiries.update");
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    select: { id: true, anonymisedAt: true, firstResponseAt: true },
  });
  if (!enquiry) throw NotFoundError();
  if (enquiry.anonymisedAt) throw ConflictError("Anonymised enquiries cannot be changed.");
  await prisma.$transaction(async (tx) => {
    await tx.enquiryActivity.create({
      data: { enquiryId: id, type: input.type, body: input.body, actorId: ctx.user.id },
    });
    await tx.enquiry.update({
      where: { id },
      data: {
        version: { increment: 1 },
        ...(input.type === "follow_up" && !enquiry.firstResponseAt
          ? { firstResponseAt: new Date() }
          : {}),
      },
    });
    await recordAudit(
      {
        actor: ctx.user,
        action: `enquiry.${input.type}_added`,
        entityType: "enquiry",
        entityId: id,
        requestId: ctx.requestId,
      },
      tx,
    );
  });
}

// ---------------------------------------------------------------- Export

export const EXPORT_COLUMNS = {
  reference: "Reference",
  createdAt: "Received (UTC)",
  status: "Status",
  owner: "Owner",
  services: "Service interest",
  organisation: "Organisation",
  name: "Name",
  email: "Email",
  phone: "Phone",
  country: "Country",
  timeline: "Timeline",
  budget: "Budget range",
  source: "Source",
  summary: "Project summary",
} as const;
export type ExportColumn = keyof typeof EXPORT_COLUMNS;
export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  "reference",
  "createdAt",
  "status",
  "owner",
  "services",
  "organisation",
  "source",
];
export const EXPORT_MAX_ROWS = 5000;

/** CSV export of the filtered inbox (FR-LEAD-007, BR-09): permission, column selection, volume limit, audited. */
export async function exportEnquiries(ctx: Ctx, f: EnquiryFilters, columns: ExportColumn[]) {
  need(ctx.user, "enquiries.export");
  const cols = columns.filter((c): c is ExportColumn => c in EXPORT_COLUMNS);
  if (cols.length === 0)
    throw ValidationError("Choose at least one column.", {
      columns: ["Choose at least one column."],
    });
  const rl = await consumeRateLimit(RATE_LIMITS.exportUser, `user:${ctx.user.id}`);
  if (!rl.allowed) throw RateLimitedError("Export limit reached. Try again later.");

  const where = whereFor(ctx.user, f);
  const total = await prisma.enquiry.count({ where });
  if (total > EXPORT_MAX_ROWS) {
    throw ValidationError(
      `This export would include ${total} rows. Narrow the filters to ${EXPORT_MAX_ROWS} rows or fewer.`,
    );
  }
  const rows = await prisma.enquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: EXPORT_MAX_ROWS,
    include: {
      assignedTo: { select: { displayName: true } },
      serviceInterests: { select: { serviceLabel: true } },
    },
  });
  const value = (r: (typeof rows)[number], c: ExportColumn): unknown => {
    switch (c) {
      case "reference":
        return r.reference;
      case "createdAt":
        return r.createdAt.toISOString();
      case "status":
        return STATUS_LABELS[r.status];
      case "owner":
        return r.assignedTo?.displayName ?? "";
      case "services":
        return r.serviceInterests.map((s) => s.serviceLabel).join("; ");
      case "organisation":
        return r.organisation;
      case "name":
        return r.name;
      case "email":
        return r.email;
      case "phone":
        return r.phone ?? "";
      case "country":
        return r.country ?? "";
      case "timeline":
        return labelFor(TIMELINES, r.timeline);
      case "budget":
        return labelFor(BUDGETS, r.budgetRange);
      case "source":
        return r.utmSource ?? r.referrerHost ?? r.sourcePath ?? "";
      case "summary":
        return r.projectSummary;
    }
  };
  const csv = toCsv(
    cols.map((c) => EXPORT_COLUMNS[c]),
    rows.map((r) => cols.map((c) => value(r, c))),
  );
  const { page: _p, ...filters } = f;
  await recordAudit({
    actor: ctx.user,
    action: "enquiry.exported",
    entityType: "enquiry",
    requestId: ctx.requestId,
    metadata: { rows: rows.length, columns: cols, filters },
  });
  return { csv, rows: rows.length };
}

// ---------------------------------------------------------------- Retention

const ANON = "[anonymised]";

async function anonymiseInTx(tx: Prisma.TransactionClient, id: string) {
  await tx.enquiry.update({
    where: { id },
    data: {
      name: ANON,
      email: `anonymised+${id}@invalid.invalid`,
      emailNormalized: `anonymised+${id}@invalid.invalid`,
      organisation: ANON,
      phone: null,
      country: null,
      projectSummary: ANON,
      referrerHost: null,
      anonymisedAt: new Date(),
      version: { increment: 1 },
    },
  });
  await tx.enquiryActivity.updateMany({
    where: { enquiryId: id, body: { not: null }, type: { in: ["note", "follow_up"] } },
    data: { body: "[removed during anonymisation]" },
  });
  await tx.notification.updateMany({
    where: { enquiryId: id, kind: "enquiry_ack" },
    data: { recipient: ANON, payload: {} },
  });
}

/** Authorised anonymisation (FR-LEAD-008). Keeps aggregate data (dates, services, status) for reporting. */
export async function anonymiseEnquiry(ctx: Ctx, id: string, reason: string) {
  need(ctx.user, "enquiries.delete");
  if (!reason.trim())
    throw ValidationError("Record the reason for anonymising.", {
      reason: ["A reason is required."],
    });
  const e = await prisma.enquiry.findUnique({ where: { id }, select: { anonymisedAt: true } });
  if (!e) throw NotFoundError();
  if (e.anonymisedAt) return;
  await prisma.$transaction(async (tx) => {
    await anonymiseInTx(tx, id);
    await recordAudit(
      {
        actor: ctx.user,
        action: "enquiry.anonymised",
        entityType: "enquiry",
        entityId: id,
        requestId: ctx.requestId,
        metadata: { reason: reason.slice(0, 200) },
      },
      tx,
    );
  });
}

/** Permanent deletion, e.g. for an erasure request. Only the audit event (without personal data) remains. */
export async function deleteEnquiry(ctx: Ctx, id: string, reason: string) {
  need(ctx.user, "enquiries.delete");
  if (!reason.trim())
    throw ValidationError("Record the reason for deletion.", { reason: ["A reason is required."] });
  const e = await prisma.enquiry.findUnique({ where: { id }, select: { reference: true } });
  if (!e) throw NotFoundError();
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { enquiryId: id } });
    await tx.enquiry.delete({ where: { id } });
    await recordAudit(
      {
        actor: ctx.user,
        action: "enquiry.deleted",
        entityType: "enquiry",
        entityId: id,
        requestId: ctx.requestId,
        metadata: { reference: e.reference, reason: reason.slice(0, 200) },
      },
      tx,
    );
  });
}

/**
 * Scheduled retention (NFR-14): enquiries in a terminal status with no
 * activity for the configured number of days are anonymised.
 */
export async function runEnquiryRetention(retentionDays: number, batch = 200): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86400_000);
  const due = await prisma.enquiry.findMany({
    where: { anonymisedAt: null, status: { in: TERMINAL_STATUSES }, updatedAt: { lt: cutoff } },
    select: { id: true },
    take: batch,
  });
  for (const { id } of due) {
    await prisma.$transaction(async (tx) => {
      await anonymiseInTx(tx, id);
      await recordAudit(
        {
          action: "enquiry.anonymised",
          entityType: "enquiry",
          entityId: id,
          metadata: { reason: "retention_policy", retentionDays },
        },
        tx,
      );
    });
  }
  return due.length;
}
