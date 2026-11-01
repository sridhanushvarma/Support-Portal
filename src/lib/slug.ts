export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Top-level paths owned by the application; custom pages cannot claim them. */
export const RESERVED_PAGE_SLUGS = new Set([
  "admin",
  "api",
  "services",
  "projects",
  "case-studies",
  "contact",
  "thank-you",
  "media",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
  "_next",
  "home",
  "login",
  "logout",
  "preview",
  "opengraph-image",
  "icon",
  "manifest.webmanifest",
]);

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 80 && SLUG_PATTERN.test(slug);
}
