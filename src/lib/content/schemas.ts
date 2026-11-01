import { z } from "zod";
import { isValidSlug } from "../slug";

/** Plain text: trimmed, control characters removed (except newlines/tabs), bounded length. */
export const text = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().max(max, `Must be ${max} characters or fewer.`));

export const requiredText = (max: number, label = "This field") =>
  text(max).pipe(z.string().min(1, `${label} is required.`));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidSlug, "Use lower-case letters, numbers and single hyphens (max 80 characters).");

const item = z.object({ title: requiredText(120, "Title"), description: text(800).default("") });
export type ContentItem = z.infer<typeof item>;

// ---------------------------------------------------------------- Pages

export const pageSectionSchema = z.object({
  heading: text(160).default(""),
  body: text(8000).default(""),
  layout: z.enum(["text", "cards", "steps"]).default("text"),
  items: z.array(item).max(12).default([]),
});

export const pageContentSchema = z.object({
  heroTitle: requiredText(160, "Hero title"),
  heroIntro: text(800).default(""),
  sections: z.array(pageSectionSchema).max(20).default([]),
});
export type PageContent = z.infer<typeof pageContentSchema>;

// ---------------------------------------------------------------- Services

export const outcomeSchema = z.object({
  text: requiredText(300, "Outcome"),
  // Outcomes are "illustrative" unless backed by approved evidence (spec 5.3, FR-SRV-005).
  evidence: z.enum(["illustrative", "verified"]).default("illustrative"),
  evidenceNote: text(500).default(""),
});

export const serviceContentSchema = z.object({
  headline: requiredText(160, "Headline"),
  summary: requiredText(400, "Summary"),
  intro: text(1500).default(""),
  audiences: z.array(requiredText(80)).max(8).default([]),
  problems: z.array(requiredText(300)).max(10).default([]),
  capabilities: z.array(item).max(12).default([]),
  outcomes: z.array(outcomeSchema).max(10).default([]),
  deliveryApproach: z.array(item).max(10).default([]),
  technologies: z.array(requiredText(60)).max(30).default([]),
  faqs: z
    .array(
      z.object({ question: requiredText(200, "Question"), answer: requiredText(1500, "Answer") }),
    )
    .max(12)
    .default([]),
  ctaHeading: text(160).default(""),
  ctaText: text(400).default(""),
  ctaLabel: text(40).default(""),
});
export type ServiceContent = z.infer<typeof serviceContentSchema>;

// ---------------------------------------------------------------- Projects

export const projectOutcomeSchema = z.object({
  label: requiredText(120, "Outcome label"),
  value: text(60).default(""),
  description: text(300).default(""),
});

export const projectContentSchema = z.object({
  // Identifying the client requires recorded permission (FR-PORT-004).
  clientName: text(120).default(""),
  anonymisedLabel: text(120).default(""),
  industry: text(80).default(""),
  engagement: text(80).default(""),
  duration: text(40).default(""),
  context: text(4000).default(""),
  challenge: text(4000).default(""),
  approach: text(4000).default(""),
  solution: text(4000).default(""),
  contribution: text(3000).default(""),
  technologies: z.array(requiredText(60)).max(30).default([]),
  outcomes: z.array(projectOutcomeSchema).max(10).default([]),
  testimonial: z
    .object({ quote: text(1000).default(""), attribution: text(160).default("") })
    .default({ quote: "", attribution: "" }),
  gallery: z
    .array(z.object({ mediaId: z.uuid(), caption: text(200).default("") }))
    .max(8)
    .default([]),
});
export type ProjectContent = z.infer<typeof projectContentSchema>;

/** Does the project contain evidence that needs a recorded approval before publication (BR-07)? */
export function projectHasEvidence(c: ProjectContent): boolean {
  return Boolean(
    c.clientName || c.outcomes.length > 0 || c.testimonial.quote || c.gallery.length > 0,
  );
}

export function evidenceFingerprint(c: ProjectContent, thumbnailId: string | null): string {
  return JSON.stringify([c.clientName, c.outcomes, c.testimonial, c.gallery, thumbnailId]);
}

// ---------------------------------------------------------------- Published snapshots

export interface PublishedPage {
  slug: string;
  title: string;
  content: PageContent;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

export interface PublishedService {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  content: ServiceContent;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

export interface PublishedMedia {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface PublishedProject {
  id: string;
  slug: string;
  title: string;
  summary: string;
  featured: boolean;
  sortDate: string;
  displayClient: string;
  content: Omit<ProjectContent, "clientName" | "anonymisedLabel" | "gallery">;
  thumbnail: PublishedMedia | null;
  gallery: (PublishedMedia & { caption: string })[];
  services: { slug: string; name: string }[];
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}
