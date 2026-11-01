import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Non-production deployments are never indexable (SITE_INDEXABLE=false). */
export default function robots(): MetadataRoute.Robots {
  const e = env();
  if (!e.SITE_INDEXABLE) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/thank-you"] }],
    sitemap: `${e.SITE_URL}/sitemap.xml`,
    host: e.SITE_URL,
  };
}
