"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminAction,
  fdJson,
  fdLines,
  fdOptional,
  fdString,
  type ActionState,
} from "@/lib/actions";
import {
  approveProjectEvidence,
  markReviewed,
  savePage,
  saveProject,
  saveService,
  transitionContent,
  type ContentKind,
} from "@/lib/content/admin";
import {
  pageContentSchema,
  projectContentSchema,
  serviceContentSchema,
  slugSchema,
} from "@/lib/content/schemas";
import type { ContentAction } from "@/lib/content/workflow";
import { ValidationError, type FieldErrors } from "@/lib/errors";
import { slugify } from "@/lib/slug";

const LIST_PATH: Record<ContentKind, string> = {
  service: "/admin/services",
  project: "/admin/projects",
  page: "/admin/pages",
};

/** Map nested Zod paths (e.g. capabilities.2.title) to the editor field, with the item number in the message. */
function contentErrors(issues: z.core.$ZodIssue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const i of issues) {
    const [first, index, ...rest] = i.path.map(String);
    const key = first ?? "form";
    const prefix =
      index !== undefined && /^\d+$/.test(index)
        ? `Item ${Number(index) + 1}${rest.length ? ` (${rest.join(".")})` : ""}: `
        : "";
    (out[key] ??= []).push(prefix + i.message);
  }
  return out;
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success)
    throw ValidationError("Please fix the highlighted fields.", contentErrors(r.error.issues));
  return r.data;
}

const common = z.object({
  slug: slugSchema,
  seoTitle: z.string().trim().max(70, "Keep SEO titles to 70 characters or fewer.").nullable(),
  seoDescription: z
    .string()
    .trim()
    .max(170, "Keep SEO descriptions to 170 characters or fewer.")
    .nullable(),
});

function slugFrom(fd: FormData, fallback: string) {
  return fdString(fd, "slug").trim() || slugify(fallback);
}

// ------------------------------------------------------------------ Services

export async function saveServiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = fdOptional(fd, "id");
  let createdId: string | null = null;
  const result = await adminAction("content.edit", async (ctx) => {
    const name = fdString(fd, "name").trim();
    if (!name || name.length > 120)
      throw ValidationError("Enter a name.", {
        name: ["Enter a name of 120 characters or fewer."],
      });
    const base = parseOrThrow(common, {
      slug: slugFrom(fd, name),
      seoTitle: fdOptional(fd, "seoTitle"),
      seoDescription: fdOptional(fd, "seoDescription"),
    });
    const content = parseOrThrow(serviceContentSchema, {
      headline: fdString(fd, "headline"),
      summary: fdString(fd, "summary"),
      intro: fdString(fd, "intro"),
      audiences: fdLines(fd, "audiences"),
      problems: fdLines(fd, "problems"),
      capabilities: fdJson(fd, "capabilities", []),
      outcomes: fdJson(fd, "outcomes", []),
      deliveryApproach: fdJson(fd, "deliveryApproach", []),
      technologies: fdLines(fd, "technologies"),
      faqs: fdJson(fd, "faqs", []),
      ctaHeading: fdString(fd, "ctaHeading"),
      ctaText: fdString(fd, "ctaText"),
      ctaLabel: fdString(fd, "ctaLabel"),
    });
    const sortOrder = Math.max(
      0,
      Math.min(999, Number.parseInt(fdString(fd, "sortOrder") || "0", 10) || 0),
    );
    const saved = await saveService(
      ctx,
      id,
      { name, sortOrder, content, ...base },
      fdOptional(fd, "expectedUpdatedAt"),
    );
    createdId = id ? null : saved!.id;
    revalidatePath("/admin/services");
    return "Saved. Changes are not public until the item is published.";
  });
  if (result.ok && createdId) redirect(`/admin/services/${createdId}?created=1`);
  return result;
}

// ------------------------------------------------------------------ Pages

export async function savePageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = fdOptional(fd, "id");
  let createdId: string | null = null;
  const result = await adminAction("content.edit", async (ctx) => {
    const title = fdString(fd, "title").trim();
    if (!title || title.length > 120)
      throw ValidationError("Enter a title.", {
        title: ["Enter a title of 120 characters or fewer."],
      });
    const base = parseOrThrow(common, {
      slug: slugFrom(fd, title),
      seoTitle: fdOptional(fd, "seoTitle"),
      seoDescription: fdOptional(fd, "seoDescription"),
    });
    const sections = fdJson<{ heading?: string; body?: string; layout?: string; items?: string }[]>(
      fd,
      "sections",
      [],
    ).map((s) => ({
      heading: s.heading ?? "",
      body: s.body ?? "",
      layout: s.layout ?? "text",
      // Items are entered one per line as "Title | Description".
      items: (s.items ?? "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [t, ...d] = l.split("|");
          return { title: (t ?? "").trim(), description: d.join("|").trim() };
        }),
    }));
    const content = parseOrThrow(pageContentSchema, {
      heroTitle: fdString(fd, "heroTitle"),
      heroIntro: fdString(fd, "heroIntro"),
      sections,
    });
    const saved = await savePage(
      ctx,
      id,
      { title, content, showInFooter: fd.get("showInFooter") === "on", ...base },
      fdOptional(fd, "expectedUpdatedAt"),
    );
    createdId = id ? null : saved!.id;
    revalidatePath("/admin/pages");
    return "Saved. Changes are not public until the page is published.";
  });
  if (result.ok && createdId) redirect(`/admin/pages/${createdId}?created=1`);
  return result;
}

// ------------------------------------------------------------------ Projects

export async function saveProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = fdOptional(fd, "id");
  let createdId: string | null = null;
  const result = await adminAction("content.edit", async (ctx) => {
    const title = fdString(fd, "title").trim();
    const summary = fdString(fd, "summary").trim();
    const errors: FieldErrors = {};
    if (!title || title.length > 160) errors.title = ["Enter a title of 160 characters or fewer."];
    if (!summary || summary.length > 400)
      errors.summary = ["Enter a summary of 400 characters or fewer."];
    if (Object.keys(errors).length)
      throw ValidationError("Please fix the highlighted fields.", errors);
    const base = parseOrThrow(common, {
      slug: slugFrom(fd, title),
      seoTitle: fdOptional(fd, "seoTitle"),
      seoDescription: fdOptional(fd, "seoDescription"),
    });
    const permission = z
      .enum(["NOT_REQUIRED", "PENDING", "GRANTED"])
      .catch("NOT_REQUIRED")
      .parse(fdString(fd, "clientPermission"));
    const content = parseOrThrow(projectContentSchema, {
      clientName: fdString(fd, "clientName"),
      anonymisedLabel: fdString(fd, "anonymisedLabel"),
      industry: fdString(fd, "industry"),
      engagement: fdString(fd, "engagement"),
      duration: fdString(fd, "duration"),
      context: fdString(fd, "context"),
      challenge: fdString(fd, "challenge"),
      approach: fdString(fd, "approach"),
      solution: fdString(fd, "solution"),
      contribution: fdString(fd, "contribution"),
      technologies: fdLines(fd, "technologies"),
      outcomes: fdJson(fd, "outcomes", []),
      testimonial: {
        quote: fdString(fd, "testimonialQuote"),
        attribution: fdString(fd, "testimonialAttribution"),
      },
      gallery: fdJson(fd, "gallery", []),
    });
    const sortDateRaw = fdString(fd, "sortDate");
    const sortDate = /^\d{4}-\d{2}-\d{2}$/.test(sortDateRaw)
      ? new Date(`${sortDateRaw}T00:00:00.000Z`)
      : new Date();
    const thumbnailId = fdOptional(fd, "thumbnailId");
    if (thumbnailId && !z.uuid().safeParse(thumbnailId).success)
      throw ValidationError("Choose a valid image.", {
        thumbnailId: ["Choose an image from the list."],
      });
    const saved = await saveProject(
      ctx,
      id,
      {
        title,
        summary,
        featured: fd.get("featured") === "on",
        sortDate,
        clientPermission: permission,
        thumbnailId,
        serviceIds: fd
          .getAll("serviceIds")
          .map(String)
          .filter((s) => z.uuid().safeParse(s).success),
        content,
        ...base,
      },
      fdOptional(fd, "expectedUpdatedAt"),
    );
    createdId = id ? null : saved!.id;
    revalidatePath("/admin/projects");
    return "Saved. Changes are not public until the project is published.";
  });
  if (result.ok && createdId) redirect(`/admin/projects/${createdId}?created=1`);
  return result;
}

export async function approveEvidenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("content.approve_evidence", async (ctx) => {
    const id = fdString(fd, "id");
    if (fd.get("confirm") !== "on")
      throw ValidationError("Confirm that you have checked the evidence.", {
        confirm: ["Tick to confirm."],
      });
    await approveProjectEvidence(
      ctx,
      id,
      fdString(fd, "evidenceNote"),
      fdOptional(fd, "expectedUpdatedAt"),
    );
    revalidatePath(`/admin/projects/${id}`);
    return "Evidence approval recorded.";
  });
}

// ------------------------------------------------------------------ Workflow

const ACTIONS: ContentAction[] = [
  "submit",
  "withdraw",
  "publish",
  "reject",
  "unpublish",
  "archive",
  "restore",
  "delete",
];

export async function transitionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const kind = fdString(fd, "kind") as ContentKind;
  const id = fdString(fd, "id");
  const action = fdString(fd, "action") as ContentAction;
  const result = await adminAction("content.edit", async (ctx) => {
    if (!(kind in LIST_PATH) || !ACTIONS.includes(action)) throw ValidationError("Unknown action.");
    if (
      (action === "delete" || action === "archive" || action === "unpublish") &&
      fd.get("confirm") !== "on"
    ) {
      throw ValidationError("Tick the confirmation box first.", {
        confirm: ["Confirm this action."],
      });
    }
    await transitionContent(ctx, kind, id, action, fdOptional(fd, "note") ?? undefined);
    revalidatePath(LIST_PATH[kind]);
    revalidatePath(`${LIST_PATH[kind]}/${id}`);
    const messages: Record<ContentAction, string> = {
      submit: "Submitted for review.",
      withdraw: "Withdrawn from review.",
      publish: "Published. The public site now shows this version.",
      reject: "Returned to the editor with your note.",
      unpublish: "Unpublished. It is no longer visible on the public site.",
      archive: "Archived and removed from the public site.",
      restore: "Restored as a draft.",
      delete: "Deleted.",
    };
    return messages[action];
  });
  if (result.ok && action === "delete") redirect(`${LIST_PATH[kind]}?deleted=1`);
  return result;
}

export async function markReviewedAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("content.publish", async (ctx) => {
    const kind = fdString(fd, "kind") as ContentKind;
    const id = fdString(fd, "id");
    if (!(kind in LIST_PATH)) throw ValidationError("Unknown item.");
    await markReviewed(ctx, kind, id);
    revalidatePath(`${LIST_PATH[kind]}/${id}`);
    return "Marked as reviewed today.";
  });
}
