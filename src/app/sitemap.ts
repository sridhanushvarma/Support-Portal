import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { fetchSitemapEntries } from "@/lib/content/public-data";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/** Published, indexable routes only (FR-SEO-002, BR-01). Utility, admin and thank-you routes are excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env().SITE_URL;
  const { pages, services, projects } = await fetchSitemapEntries();
  const lastMod = (r: { publishedAt: Date | null; updatedAt: Date }) =>
    r.publishedAt ?? r.updatedAt;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/services`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/projects`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.7 },
    ...services.map((s) => ({
      url: `${base}/services/${s.publishedSlug}`,
      lastModified: lastMod(s),
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...projects.map((p) => ({
      url: `${base}/projects/${p.publishedSlug}`,
      lastModified: lastMod(p),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...pages
      .filter((p) => p.publishedSlug !== "home")
      .map((p) => ({
        url: `${base}/${p.publishedSlug}`,
        lastModified: lastMod(p),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
  ];
}
