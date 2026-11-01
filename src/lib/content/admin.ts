import "server-only";
import { Prisma, type ClientPermission, type ContentStatus } from "@prisma/client";
import { prisma } from "../db";
import { recordAudit } from "../audit";
import type { SessionUser } from "../auth/session";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { onContentLive } from "../redirects";
import { RESERVED_PAGE_SLUGS } from "../slug";
import { invalidate } from "../cache-tags";
import {
  evidenceFingerprint,
  projectContentSchema,
  projectHasEvidence,
  serviceContentSchema,
  type PageContent,
  type ProjectContent,
  type ServiceContent,
} from "./schemas";
import {
  buildPageSnapshot,
  buildProjectSnapshot,
  buildServiceSnapshot,
  projectMediaIds,
  publicPath,
} from "./snapshots";
import {
  canPerform,
  isEditable,
  statusAfterEdit,
  type ContentAction,
  type WorkflowState,
} from "./workflow";

export type ContentKind = "page" | "service" | "project";

/** System pages whose slug is fixed because other features link to them. */
export const LOCKED_PAGE_SLUGS = new Set(["home", "privacy"]);

interface Ctx {
  user: SessionUser;
  requestId?: string;
}

function requireEdit(user: SessionUser) {
  if (!user.permissions.has("content.edit")) throw ForbiddenError();
}

function checkVersion(current: Date, expected: string | null | undefined) {
  if (expected && current.toISOString() !== expected) {
    throw ConflictError(
      "This item was changed by someone else after you opened it. Reload to see the latest version, then reapply your changes.",
    );
  }
}

function slugConflict(error: unknown, field = "slug"): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw ValidationError("That URL slug is already in use.", {
      [field]: ["That slug is already used by another item."],
    });
  }
  throw error;
}

function stateOf(r: {
  status: ContentStatus;
  publishedSlug: string | null;
  publishedAt: Date | null;
}): WorkflowState {
  return {
    status: r.status,
    isLive: r.publishedSlug !== null,
    everPublished: r.publishedAt !== null,
  };
}

// ---------------------------------------------------------------- Services

export interface ServiceInput {
  name: string;
  slug: string;
  sortOrder: number;
  content: ServiceContent;
  seoTitle: string | null;
  seoDescription: string | null;
}

export async function saveService(
  ctx: Ctx,
  id: string | null,
  input: ServiceInput,
  expectedUpdatedAt?: string | null,
) {
  requireEdit(ctx.user);
  const content = serviceContentSchema.parse(input.content) as Prisma.InputJsonValue;
  try {
    if (!id) {
      const created = await prisma.service.create({
        data: { ...input, content, status: "DRAFT", authorId: ctx.user.id },
      });
      await recordAudit({
        actor: ctx.user,
        action: "content.created",
        entityType: "service",
        entityId: created.id,
        requestId: ctx.requestId,
      });
      return created;
    }
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) throw NotFoundError();
    if (!isEditable(existing.status))
      throw ConflictError("Archived items must be restored before editing.");
    checkVersion(existing.updatedAt, expectedUpdatedAt);
    const updated = await prisma.service.update({
      where: { id },
      data: {
        ...input,
        content,
        status: statusAfterEdit(existing.status),
        hasUnpublishedChanges: existing.publishedSlug !== null,
        authorId: ctx.user.id,
      },
    });
    await recordAudit({
      actor: ctx.user,
      action: "content.updated",
      entityType: "service",
      entityId: id,
      requestId: ctx.requestId,
    });
    return updated;
  } catch (e) {
    slugConflict(e);
  }
}

// ---------------------------------------------------------------- Pages

export interface PageInput {
  title: string;
  slug: string;
  content: PageContent;
  seoTitle: string | null;
  seoDescription: string | null;
  showInFooter: boolean;
}

export async function savePage(
  ctx: Ctx,
  id: string | null,
  input: PageInput,
  expectedUpdatedAt?: string | null,
) {
  requireEdit(ctx.user);
  if (RESERVED_PAGE_SLUGS.has(input.slug) && input.slug !== "home") {
    throw ValidationError("That slug is reserved.", {
      slug: ["This URL is used by the application. Choose another slug."],
    });
  }
  const content = input.content as unknown as Prisma.InputJsonValue;
  try {
    if (!id) {
      const created = await prisma.page.create({
        data: { ...input, content, status: "DRAFT", authorId: ctx.user.id },
      });
      await recordAudit({
        actor: ctx.user,
        action: "content.created",
        entityType: "page",
        entityId: created.id,
        requestId: ctx.requestId,
      });
      return created;
    }
    const existing = await prisma.page.findUnique({ where: { id } });
    if (!existing) throw NotFoundError();
    if (!isEditable(existing.status))
      throw ConflictError("Archived items must be restored before editing.");
    checkVersion(existing.updatedAt, expectedUpdatedAt);
    if (LOCKED_PAGE_SLUGS.has(existing.slug) && input.slug !== existing.slug) {
      throw ValidationError("This system page's URL cannot change.", {
        slug: ["The URL of this system page is fixed."],
      });
    }
    const updated = await prisma.page.update({
      where: { id },
      data: {
        ...input,
        content,
        status: statusAfterEdit(existing.status),
        hasUnpublishedChanges: existing.publishedSlug !== null,
        authorId: ctx.user.id,
      },
    });
    await recordAudit({
      actor: ctx.user,
      action: "content.updated",
      entityType: "page",
      entityId: id,
      requestId: ctx.requestId,
    });
    return updated;
  } catch (e) {
    slugConflict(e);
  }
}

// ---------------------------------------------------------------- Projects

export interface ProjectInput {
  title: string;
  slug: string;
  summary: string;
  featured: boolean;
  sortDate: Date;
  clientPermission: ClientPermission;
  thumbnailId: string | null;
  serviceIds: string[];
  content: ProjectContent;
  seoTitle: string | null;
  seoDescription: string | null;
}

async function assertMediaExists(ids: string[]) {
  if (ids.length === 0) return;
  const unique = [...new Set(ids)];
  const count = await prisma.mediaAsset.count({ where: { id: { in: unique } } });
  if (count !== unique.length)
    throw ValidationError("One or more selected images no longer exist.", {
      thumbnailId: ["Select an existing image."],
    });
}

export async function saveProject(
  ctx: Ctx,
  id: string | null,
  input: ProjectInput,
  expectedUpdatedAt?: string | null,
) {
  requireEdit(ctx.user);
  const content = projectContentSchema.parse(input.content);
  if (content.clientName && input.clientPermission === "NOT_REQUIRED") {
    throw ValidationError("A named client requires a permission status.", {
      clientPermission: [
        "Set permission to Pending or Granted when the client is named, or remove the client name.",
      ],
    });
  }
  await assertMediaExists([
    ...(input.thumbnailId ? [input.thumbnailId] : []),
    ...content.gallery.map((g) => g.mediaId),
  ]);
  const serviceIds = [...new Set(input.serviceIds)];
  if (serviceIds.length) {
    const n = await prisma.service.count({ where: { id: { in: serviceIds } } });
    if (n !== serviceIds.length)
      throw ValidationError("Unknown service selected.", {
        serviceIds: ["Select services from the list."],
      });
  }
  const { serviceIds: _ignored, content: _c, ...fields } = input;
  const json = content as unknown as Prisma.InputJsonValue;
  const fingerprint = (c: ProjectContent, thumb: string | null, perm: ClientPermission) =>
    evidenceFingerprint(c, thumb) + perm;

  try {
    return await prisma.$transaction(async (tx) => {
      if (!id) {
        const created = await tx.project.create({
          data: {
            ...fields,
            content: json,
            status: "DRAFT",
            authorId: ctx.user.id,
            services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
          },
        });
        await recordAudit(
          {
            actor: ctx.user,
            action: "content.created",
            entityType: "project",
            entityId: created.id,
            requestId: ctx.requestId,
          },
          tx,
        );
        return created;
      }
      const existing = await tx.project.findUnique({ where: { id } });
      if (!existing) throw NotFoundError();
      if (!isEditable(existing.status))
        throw ConflictError("Archived items must be restored before editing.");
      checkVersion(existing.updatedAt, expectedUpdatedAt);
      // Any change to evidence (client identity, metrics, testimonial, images, permission) voids the approval.
      const evidenceChanged =
        fingerprint(
          projectContentSchema.parse(existing.content),
          existing.thumbnailId,
          existing.clientPermission,
        ) !== fingerprint(content, input.thumbnailId, input.clientPermission);
      await tx.projectService.deleteMany({ where: { projectId: id } });
      const updated = await tx.project.update({
        where: { id },
        data: {
          ...fields,
          content: json,
          status: statusAfterEdit(existing.status),
          hasUnpublishedChanges: existing.publishedSlug !== null,
          authorId: ctx.user.id,
          services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
          ...(evidenceChanged ? { evidenceApprovedAt: null, evidenceApprovedById: null } : {}),
        },
      });
      await recordAudit(
        {
          actor: ctx.user,
          action: "content.updated",
          entityType: "project",
          entityId: id,
          requestId: ctx.requestId,
          metadata: {
            evidenceApprovalCleared: evidenceChanged && existing.evidenceApprovedAt !== null,
          },
        },
        tx,
      );
      return updated;
    });
  } catch (e) {
    slugConflict(e);
  }
}

/** Publisher records that client permission and claims have been verified (FR-PORT-004, BR-07). */
export async function approveProjectEvidence(
  ctx: Ctx,
  id: string,
  note: string,
  expectedUpdatedAt?: string | null,
) {
  if (!ctx.user.permissions.has("content.approve_evidence")) throw ForbiddenError();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw NotFoundError();
  checkVersion(project.updatedAt, expectedUpdatedAt);
  const content = projectContentSchema.parse(project.content);
  if (content.clientName && project.clientPermission !== "GRANTED") {
    throw ValidationError(
      "Client permission must be Granted before evidence that names the client can be approved.",
    );
  }
  if (!note.trim())
    throw ValidationError("Describe the evidence you checked.", {
      evidenceNote: ["Record what was verified and where the evidence is held."],
    });
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        evidenceApprovedAt: new Date(),
        evidenceApprovedById: ctx.user.id,
        evidenceNote: note.trim().slice(0, 1000),
      },
    });
    await recordAudit(
      {
        actor: ctx.user,
        action: "project.evidence_approved",
        entityType: "project",
        entityId: id,
        requestId: ctx.requestId,
      },
      tx,
    );
  });
}

// ---------------------------------------------------------------- Publish checks

/** Returns human-readable blockers; publication proceeds only when empty. */
export async function publishBlockers(kind: ContentKind, id: string): Promise<string[]> {
  const blockers: string[] = [];
  if (kind === "service") {
    const s = await prisma.service.findUnique({ where: { id } });
    if (!s) return ["Item not found."];
    const parsed = serviceContentSchema.safeParse(s.content);
    if (!parsed.success)
      return ["Content is incomplete or invalid. Open the editor and save again."];
    parsed.data.outcomes.forEach((o, i) => {
      if (o.evidence === "verified" && !o.evidenceNote)
        blockers.push(`Outcome ${i + 1} is marked verified but has no evidence note.`);
    });
    if (!s.seoDescription) blockers.push("Add an SEO description.");
  } else if (kind === "project") {
    const p = await prisma.project.findUnique({ where: { id } });
    if (!p) return ["Item not found."];
    const parsed = projectContentSchema.safeParse(p.content);
    if (!parsed.success)
      return ["Content is incomplete or invalid. Open the editor and save again."];
    const c = parsed.data;
    if (!p.summary.trim()) blockers.push("Add a summary.");
    if (c.clientName && p.clientPermission !== "GRANTED")
      blockers.push("The client is named but permission is not recorded as Granted.");
    if (projectHasEvidence(c) && !p.evidenceApprovedAt)
      blockers.push(
        "Client name, outcomes, testimonial or images need evidence approval by a publisher.",
      );
    if (c.testimonial.quote && !c.testimonial.attribution)
      blockers.push("The testimonial needs an attribution.");
    if (!p.seoDescription) blockers.push("Add an SEO description.");
    const services = await prisma.projectService.count({ where: { projectId: id } });
    if (services === 0) blockers.push("Link the project to at least one service.");
  } else {
    const p = await prisma.page.findUnique({ where: { id } });
    if (!p) return ["Item not found."];
    if (!p.seoDescription) blockers.push("Add an SEO description.");
  }
  return blockers;
}

// ---------------------------------------------------------------- Transitions

async function loadState(kind: ContentKind, id: string) {
  const select = {
    status: true,
    publishedSlug: true,
    publishedAt: true,
    slug: true,
    updatedAt: true,
  } as const;
  const r =
    kind === "service"
      ? await prisma.service.findUnique({ where: { id }, select })
      : kind === "project"
        ? await prisma.project.findUnique({ where: { id }, select })
        : await prisma.page.findUnique({ where: { id }, select });
  if (!r) throw NotFoundError();
  return r;
}

const TAG_FOR: Record<ContentKind, "pages" | "services" | "projects"> = {
  page: "pages",
  service: "services",
  project: "projects",
};

/**
 * Apply a workflow action (FR-ADM-006, UC-05, UC-06, UC-10). Permission and
 * state are re-validated on the server. Publishing writes an immutable snapshot
 * and, when the slug changed, a permanent redirect from the previous URL.
 */
export async function transitionContent(
  ctx: Ctx,
  kind: ContentKind,
  id: string,
  action: ContentAction,
  note?: string,
) {
  const current = await loadState(kind, id);
  const state = stateOf(current);
  if (!canPerform(action, state, ctx.user.permissions)) {
    if (
      !ctx.user.permissions.has(
        action === "submit" || action === "withdraw" ? "content.edit" : "content.publish",
      )
    )
      throw ForbiddenError();
    throw ConflictError(
      "That action is not available in the item's current state. Reload the page.",
    );
  }
  const audit = (tx: Prisma.TransactionClient, extra?: Prisma.InputJsonValue) =>
    recordAudit(
      {
        actor: ctx.user,
        action: `content.${action}`,
        entityType: kind,
        entityId: id,
        requestId: ctx.requestId,
        metadata: extra,
      },
      tx,
    );

  if (action === "publish") {
    const blockers = await publishBlockers(kind, id);
    if (blockers.length) throw ValidationError(`Cannot publish yet: ${blockers.join(" ")}`);
  }
  if (action === "reject" && !note?.trim())
    throw ValidationError("Give a reason so the editor knows what to change.", {
      note: ["A reason is required."],
    });

  const clearLive = { published: Prisma.DbNull, publishedSlug: null, hasUnpublishedChanges: false };
  const prevPath = current.publishedSlug ? publicPath(kind, current.publishedSlug) : null;

  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const simple = async (data: Record<string, unknown>) => {
        if (kind === "service") await tx.service.update({ where: { id }, data });
        else if (kind === "project") await tx.project.update({ where: { id }, data });
        else await tx.page.update({ where: { id }, data });
      };
      switch (action) {
        case "submit":
          await simple({ status: "IN_REVIEW", reviewNote: null });
          break;
        case "withdraw":
          await simple({ status: "DRAFT" });
          break;
        case "reject":
          await simple({ status: "DRAFT", reviewNote: note!.trim().slice(0, 1000) });
          break;
        case "restore":
          await simple({ status: "DRAFT" });
          break;
        case "unpublish":
          await simple({
            ...clearLive,
            status: "DRAFT",
            ...(kind === "project" ? { publishedServiceIds: [] } : {}),
          });
          break;
        case "archive":
          await simple({
            ...clearLive,
            status: "ARCHIVED",
            ...(kind === "project" ? { publishedServiceIds: [] } : {}),
          });
          break;
        case "delete":
          if (kind === "service") {
            const used = await tx.enquiryServiceInterest.count({ where: { serviceId: id } });
            if (used)
              throw ConflictError("This service is referenced by enquiries. Archive it instead.");
            await tx.service.delete({ where: { id } });
          } else if (kind === "project") await tx.project.delete({ where: { id } });
          else {
            if (LOCKED_PAGE_SLUGS.has(current.slug))
              throw ConflictError("System pages cannot be deleted.");
            await tx.page.delete({ where: { id } });
          }
          break;
        case "publish": {
          const base = {
            status: "PUBLISHED" as const,
            publishedSlug: current.slug,
            publishedAt: now,
            hasUnpublishedChanges: false,
            reviewNote: null,
            approverId: ctx.user.id,
            lastReviewedAt: now,
          };
          if (kind === "service") {
            const s = await tx.service.findUniqueOrThrow({ where: { id } });
            await tx.service.update({
              where: { id },
              data: {
                ...base,
                published: buildServiceSnapshot(s) as unknown as Prisma.InputJsonValue,
              },
            });
          } else if (kind === "page") {
            const p = await tx.page.findUniqueOrThrow({ where: { id } });
            await tx.page.update({
              where: { id },
              data: {
                ...base,
                published: buildPageSnapshot(p) as unknown as Prisma.InputJsonValue,
              },
            });
          } else {
            const p = await tx.project.findUniqueOrThrow({
              where: { id },
              include: { services: true },
            });
            const media = await tx.mediaAsset.findMany({
              where: { id: { in: projectMediaIds(p) } },
            });
            const snapshot = buildProjectSnapshot(p, new Map(media.map((m) => [m.id, m])));
            await tx.project.update({
              where: { id },
              data: {
                ...base,
                published: snapshot as unknown as Prisma.InputJsonValue,
                publishedServiceIds: p.services.map((s) => s.serviceId),
              },
            });
          }
          await onContentLive(tx, publicPath(kind, current.slug), prevPath, ctx.user.id);
          break;
        }
      }
      await audit(tx, {
        ...(action === "publish" && prevPath && prevPath !== publicPath(kind, current.slug)
          ? { redirectFrom: prevPath, redirectTo: publicPath(kind, current.slug) }
          : {}),
        ...(note ? { note: note.slice(0, 200) } : {}),
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw ConflictError(
        "Another live item already uses this URL. Change the slug before publishing.",
      );
    }
    throw e;
  }
  invalidate(TAG_FOR[kind], "redirects", ...(kind === "service" ? (["projects"] as const) : []));
}

/** Record that a live item's content was reviewed and is still accurate (content freshness measure). */
export async function markReviewed(ctx: Ctx, kind: ContentKind, id: string) {
  if (!ctx.user.permissions.has("content.publish")) throw ForbiddenError();
  const data = { lastReviewedAt: new Date() };
  if (kind === "service") await prisma.service.update({ where: { id }, data });
  else if (kind === "project") await prisma.project.update({ where: { id }, data });
  else await prisma.page.update({ where: { id }, data });
  await recordAudit({
    actor: ctx.user,
    action: "content.reviewed",
    entityType: kind,
    entityId: id,
    requestId: ctx.requestId,
  });
}
