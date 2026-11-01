import { revalidatePath, revalidateTag } from "next/cache";
import { logger } from "./logger";

export const TAGS = {
  settings: "settings",
  pages: "pages",
  services: "services",
  projects: "projects",
  redirects: "redirects",
} as const;

/**
 * Invalidate cached public data after a publish (spec 10.4). Outside a Next.js
 * request context (worker, tests) there is no cache to invalidate, so failures
 * are logged at debug level rather than surfaced.
 */
export function invalidate(...tags: (keyof typeof TAGS)[]) {
  for (const t of tags) {
    try {
      revalidateTag(TAGS[t]);
    } catch (error) {
      logger.debug("cache.revalidate_skipped", { tag: t, error });
    }
  }
  try {
    revalidatePath("/sitemap.xml");
  } catch {
    /* outside request context */
  }
}
