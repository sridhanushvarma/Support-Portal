import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getPublishedPage, getSettings } from "@/lib/content/public";
import { resolveRedirect } from "@/lib/redirects";
import { pageMetadata } from "@/lib/seo";
import { CtaBand, PageHero, PageSections } from "@/components/site/blocks";

type Props = { params: Promise<{ slug: string[] }> };

/**
 * CMS pages (About, Approach, Privacy, custom pages) at /{slug}. Any other path
 * is checked against the redirect table before returning 404 (URS-023).
 */
async function load(segments: string[]) {
  if (segments.length !== 1) return null;
  const slug = segments[0]!;
  if (slug === "home") return null; // the home page is served at /
  return getPublishedPage(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) return { title: "Page not found" };
  return pageMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.content.heroIntro,
    path: `/${page.slug}`,
  });
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) {
    const target = await resolveRedirect(`/${slug.map(encodeURIComponent).join("/")}`);
    if (target) {
      if (target.statusCode === 301 || target.statusCode === 308)
        permanentRedirect(target.targetPath);
      redirect(target.targetPath);
    }
    notFound();
  }
  const settings = await getSettings();
  const isLegal = ["privacy", "cookies", "terms"].includes(page.slug);
  return (
    <>
      <PageHero
        eyebrow={isLegal ? "Legal" : undefined}
        title={page.content.heroTitle}
        intro={page.content.heroIntro}
      />
      <PageSections sections={page.content.sections} />
      {isLegal ? (
        <p className="container-page pb-16 text-sm text-muted">
          Last updated{" "}
          {new Date(page.updatedAt).toLocaleDateString("en-GB", {
            dateStyle: "long",
            timeZone: "UTC",
          })}
          .
        </p>
      ) : (
        <CtaBand
          heading="Let's talk about your goals"
          text={settings.responseExpectation}
          label={settings.primaryCtaLabel}
          href="/contact"
          location={`page:${page.slug}`}
        />
      )}
    </>
  );
}
