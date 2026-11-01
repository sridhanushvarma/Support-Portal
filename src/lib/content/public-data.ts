import { prisma } from "../db";
import type { PublishedPage, PublishedProject, PublishedService } from "./schemas";
import type { ProjectSnapshot } from "./snapshots";

// Every public query filters on `publishedSlug: { not: null }` and reads the
// immutable snapshot, so drafts and archived items can never leak (BR-01).

export async function fetchPublishedServices(): Promise<PublishedService[]> {
  const rows = await prisma.service.findMany({
    where: { publishedSlug: { not: null }, status: { not: "ARCHIVED" } },
    select: { published: true },
  });
  return rows
    .map((r) => r.published as unknown as PublishedService)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function fetchPublishedService(slug: string): Promise<PublishedService | null> {
  const row = await prisma.service.findUnique({
    where: { publishedSlug: slug },
    select: { published: true, status: true },
  });
  if (!row || row.status === "ARCHIVED" || !row.published) return null;
  return row.published as unknown as PublishedService;
}

async function serviceLookup() {
  const services = await fetchPublishedServices();
  return new Map(services.map((s) => [s.id, { slug: s.slug, name: s.name }]));
}

function withServices(
  snapshot: ProjectSnapshot,
  ids: string[],
  lookup: Map<string, { slug: string; name: string }>,
): PublishedProject {
  return { ...snapshot, services: ids.flatMap((id) => lookup.get(id) ?? []) };
}

export interface ProjectListResult {
  items: PublishedProject[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

export async function fetchPublishedProjects(
  opts: { serviceSlug?: string | null; page?: number; pageSize?: number } = {},
): Promise<ProjectListResult> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 9, 1), 50);
  const lookup = await serviceLookup();
  let serviceId: string | undefined;
  if (opts.serviceSlug) {
    serviceId = [...lookup.entries()].find(([, v]) => v.slug === opts.serviceSlug)?.[0];
    if (!serviceId) return { items: [], total: 0, page: 1, pageCount: 0, pageSize };
  }
  const where = {
    publishedSlug: { not: null },
    status: { not: "ARCHIVED" as const },
    ...(serviceId ? { publishedServiceIds: { has: serviceId } } : {}),
  };
  const total = await prisma.project.count({ where });
  const pageCount = Math.ceil(total / pageSize);
  const page = Math.min(Math.max(opts.page ?? 1, 1), Math.max(pageCount, 1));
  const rows = await prisma.project.findMany({
    where,
    orderBy: [{ sortDate: "desc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { published: true, publishedServiceIds: true },
  });
  return {
    items: rows.map((r) =>
      withServices(r.published as unknown as ProjectSnapshot, r.publishedServiceIds, lookup),
    ),
    total,
    page,
    pageCount,
    pageSize,
  };
}

export async function fetchFeaturedProjects(limit = 3): Promise<PublishedProject[]> {
  const lookup = await serviceLookup();
  const rows = await prisma.project.findMany({
    where: { publishedSlug: { not: null }, status: { not: "ARCHIVED" } },
    orderBy: [{ featured: "desc" }, { sortDate: "desc" }],
    take: limit,
    select: { published: true, publishedServiceIds: true },
  });
  return rows.map((r) =>
    withServices(r.published as unknown as ProjectSnapshot, r.publishedServiceIds, lookup),
  );
}

export async function fetchRelatedProjects(
  serviceId: string,
  limit = 3,
): Promise<PublishedProject[]> {
  const lookup = await serviceLookup();
  const rows = await prisma.project.findMany({
    where: {
      publishedSlug: { not: null },
      status: { not: "ARCHIVED" },
      publishedServiceIds: { has: serviceId },
    },
    orderBy: [{ featured: "desc" }, { sortDate: "desc" }],
    take: limit,
    select: { published: true, publishedServiceIds: true },
  });
  return rows.map((r) =>
    withServices(r.published as unknown as ProjectSnapshot, r.publishedServiceIds, lookup),
  );
}

export async function fetchPublishedProject(slug: string): Promise<PublishedProject | null> {
  const row = await prisma.project.findUnique({
    where: { publishedSlug: slug },
    select: { published: true, publishedServiceIds: true, status: true },
  });
  if (!row || row.status === "ARCHIVED" || !row.published) return null;
  return withServices(
    row.published as unknown as ProjectSnapshot,
    row.publishedServiceIds,
    await serviceLookup(),
  );
}

export async function fetchPublishedPage(slug: string): Promise<PublishedPage | null> {
  const row = await prisma.page.findUnique({
    where: { publishedSlug: slug },
    select: { published: true, status: true },
  });
  if (!row || row.status === "ARCHIVED" || !row.published) return null;
  return row.published as unknown as PublishedPage;
}

export async function fetchFooterPages(): Promise<{ slug: string; title: string }[]> {
  const rows = await prisma.page.findMany({
    where: { publishedSlug: { not: null }, status: { not: "ARCHIVED" }, showInFooter: true },
    select: { publishedSlug: true, title: true },
    orderBy: { title: "asc" },
  });
  return rows.map((r) => ({ slug: r.publishedSlug!, title: r.title }));
}

export async function fetchLivePageSlugs(): Promise<string[]> {
  const rows = await prisma.page.findMany({
    where: { publishedSlug: { not: null }, status: { not: "ARCHIVED" } },
    select: { publishedSlug: true },
  });
  return rows.map((r) => r.publishedSlug!);
}

export async function fetchSitemapEntries() {
  const select = { publishedSlug: true, publishedAt: true, updatedAt: true } as const;
  const live = { publishedSlug: { not: null }, status: { not: "ARCHIVED" as const } };
  const [pages, services, projects] = await Promise.all([
    prisma.page.findMany({ where: live, select }),
    prisma.service.findMany({ where: live, select }),
    prisma.project.findMany({ where: live, select }),
  ]);
  return { pages, services, projects };
}
