import type { MediaAsset, Page, Project, Service } from "@prisma/client";
import {
  pageContentSchema,
  projectContentSchema,
  serviceContentSchema,
  type PublishedMedia,
  type PublishedPage,
  type PublishedProject,
  type PublishedService,
} from "./schemas";

export type ProjectSnapshot = Omit<PublishedProject, "services">;

export function publicPath(kind: "page" | "service" | "project", slug: string): string {
  if (kind === "page") return slug === "home" ? "/" : `/${slug}`;
  return kind === "service" ? `/services/${slug}` : `/projects/${slug}`;
}

export const mediaUrl = (id: string) => `/media/${id}`;

function toMedia(m: Pick<MediaAsset, "id" | "width" | "height" | "altText">): PublishedMedia {
  return { id: m.id, url: mediaUrl(m.id), width: m.width, height: m.height, alt: m.altText };
}

/** Build the public representation of a page from its working copy (also used for preview). */
export function buildPageSnapshot(p: Page): PublishedPage {
  return {
    slug: p.slug,
    title: p.title,
    content: pageContentSchema.parse(p.content),
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    updatedAt: new Date().toISOString(),
  };
}

export function buildServiceSnapshot(s: Service): PublishedService {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    sortOrder: s.sortOrder,
    content: serviceContentSchema.parse(s.content),
    seoTitle: s.seoTitle,
    seoDescription: s.seoDescription,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Only approved, public-safe fields are copied. The client name is included
 * only when permission is GRANTED; otherwise the anonymised label is shown.
 */
export function buildProjectSnapshot(p: Project, media: Map<string, MediaAsset>): ProjectSnapshot {
  const c = projectContentSchema.parse(p.content);
  const { clientName, anonymisedLabel, gallery, ...rest } = c;
  const displayClient =
    clientName && p.clientPermission === "GRANTED"
      ? clientName
      : anonymisedLabel || "Confidential client";
  const thumb = p.thumbnailId ? media.get(p.thumbnailId) : undefined;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    featured: p.featured,
    sortDate: p.sortDate.toISOString(),
    displayClient,
    content: rest,
    thumbnail: thumb ? toMedia(thumb) : null,
    gallery: gallery.flatMap((g) => {
      const m = media.get(g.mediaId);
      return m ? [{ ...toMedia(m), caption: g.caption }] : [];
    }),
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    updatedAt: new Date().toISOString(),
  };
}

export function projectMediaIds(p: Project): string[] {
  const c = projectContentSchema.parse(p.content);
  return [...(p.thumbnailId ? [p.thumbnailId] : []), ...c.gallery.map((g) => g.mediaId)];
}
