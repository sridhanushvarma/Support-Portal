import type { Metadata } from "next";
import { env } from "./env";

/** Per-route metadata with canonical URL and social tags (FR-SEO-001). */
export function pageMetadata(opts: {
  title: string;
  description?: string | null;
  path: string;
  noindex?: boolean;
  absoluteTitle?: boolean;
}): Metadata {
  const url = `${env().SITE_URL}${opts.path === "/" ? "" : opts.path}` || env().SITE_URL;
  const description = opts.description ?? undefined;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: opts.title, description, url, type: "website" },
    twitter: { title: opts.title, description },
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
