import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedProjects, getPublishedServices, getSettings } from "@/lib/content/public";
import { pageMetadata } from "@/lib/seo";
import { CtaBand, PageHero, ProjectCard } from "@/components/site/blocks";

type Props = { searchParams: Promise<{ service?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { service, page } = await searchParams;
  return {
    ...pageMetadata({
      title: "Projects and case studies",
      description:
        "Selected, approved examples of our delivery work across ERP, software, web, data and AI automation.",
      path: "/projects",
    }),
    // Filtered and paginated variants canonicalise to the main listing.
    ...(service || page ? { robots: { index: false, follow: true } } : {}),
  };
}

function hrefFor(service: string | null, page = 1) {
  const params = new URLSearchParams();
  if (service) params.set("service", service);
  if (page > 1) params.set("page", String(page));
  const q = params.toString();
  return `/projects${q ? `?${q}` : ""}`;
}

/**
 * Portfolio listing (FR-PORT-001/002/005). Filters are plain links, so they
 * work without JavaScript, are shareable and keep state in the URL.
 */
export default async function ProjectsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const services = await getPublishedServices();
  const active = services.find((s) => s.slug === sp.service) ?? null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [result, settings] = await Promise.all([
    getPublishedProjects({ serviceSlug: active?.slug ?? null, page, pageSize: 9 }),
    getSettings(),
  ]);
  const unknownFilter = Boolean(sp.service) && !active;

  return (
    <>
      <PageHero
        eyebrow="Projects"
        title="Work we can show you"
        intro="Every project here is published with the client's permission or anonymised, and outcomes are shown only where they have been verified."
      />
      <section className="container-page py-12" aria-labelledby="filter-heading">
        <h2 id="filter-heading" className="text-sm font-semibold text-ink-soft">
          Filter by service
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          <li>
            <Link
              href="/projects"
              aria-current={!active ? "true" : undefined}
              className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm font-medium text-ink-soft hover:border-ink-soft aria-[current=true]:border-brand aria-[current=true]:bg-brand aria-[current=true]:text-white"
            >
              All projects
            </Link>
          </li>
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={hrefFor(s.slug)}
                aria-current={active?.slug === s.slug ? "true" : undefined}
                className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm font-medium text-ink-soft hover:border-ink-soft aria-[current=true]:border-brand aria-[current=true]:bg-brand aria-[current=true]:text-white"
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-muted" role="status">
          {result.total === 1 ? "1 project" : `${result.total} projects`}
          {active ? ` for ${active.name}` : ""}
        </p>

        {result.items.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
            <h2 className="text-xl font-semibold text-navy">
              {unknownFilter
                ? "That filter is no longer available"
                : "No projects match this filter yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-ink-soft">
              {active
                ? `We have not published a ${active.name.toLowerCase()} case study yet, but we may still have relevant experience.`
                : "We are preparing case studies for publication."}{" "}
              Ask us about similar work.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {(active || unknownFilter) && (
                <Link href="/projects" className="btn-secondary">
                  Clear filter
                </Link>
              )}
              <Link href="/contact" className="btn-primary">
                {settings.secondaryCtaLabel}
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((p) => (
              <li key={p.id}>
                <ProjectCard project={p} headingLevel={2} />
              </li>
            ))}
          </ul>
        )}

        {result.pageCount > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4">
            {result.page > 1 ? (
              <Link
                className="btn-secondary btn-sm"
                href={hrefFor(active?.slug ?? null, result.page - 1)}
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted">
              Page {result.page} of {result.pageCount}
            </span>
            {result.page < result.pageCount ? (
              <Link
                className="btn-secondary btn-sm"
                href={hrefFor(active?.slug ?? null, result.page + 1)}
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
      <CtaBand
        heading="Want results like these?"
        text={settings.responseExpectation}
        label={settings.primaryCtaLabel}
        href="/contact"
        location="projects_index"
      />
    </>
  );
}
