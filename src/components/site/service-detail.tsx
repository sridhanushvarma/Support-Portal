import Link from "next/link";
import type { PublishedProject, PublishedService } from "@/lib/content/schemas";
import type { SiteSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import {
  Breadcrumbs,
  CtaBand,
  ItemGrid,
  JsonLd,
  Paragraphs,
  ProjectCard,
  SectionHeading,
} from "./blocks";
import { TrackedLink } from "./tracked-link";

/** Service page template following the content pattern in spec section 5.3 (FR-SRV-002). */
export function ServiceDetail({
  service,
  related,
  settings,
  preview = false,
}: {
  service: PublishedService;
  related: PublishedProject[];
  settings: SiteSettings;
  preview?: boolean;
}) {
  const c = service.content;
  const path = `/services/${service.slug}`;
  const enquiryHref = `/contact?service=${encodeURIComponent(service.slug)}`;
  const ctaLabel = c.ctaLabel || settings.primaryCtaLabel;
  const hasIllustrative = c.outcomes.some((o) => o.evidence === "illustrative");

  return (
    <>
      {!preview && c.faqs.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: c.faqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          }}
        />
      )}
      {!preview && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Service",
            name: service.name,
            description: c.summary,
            url: `${env().SITE_URL}${path}`,
            provider: { "@type": "Organization", name: settings.legalName || settings.siteName },
          }}
        />
      )}
      <div className="bg-surface">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/services", label: "Services" },
            { label: service.name },
          ]}
        />
        <section className="container-page pt-8 pb-16 sm:pb-20">
          <p className="eyebrow">{service.name}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-navy sm:text-5xl">
            {c.headline}
          </h1>
          <p className="mt-6 max-w-3xl text-xl leading-relaxed text-ink-soft">{c.summary}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <TrackedLink
              href={enquiryHref}
              className="btn-primary"
              location={`service_hero:${service.slug}`}
            >
              {ctaLabel}
            </TrackedLink>
            {related.length > 0 && (
              <a href="#related-work" className="btn-secondary">
                See related work
              </a>
            )}
          </div>
          {c.audiences.length > 0 && (
            <div className="mt-10">
              <h2 className="text-sm font-semibold text-ink-soft">Who this is for</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {c.audiences.map((a) => (
                  <li
                    key={a}
                    className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-ink-soft"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {(c.intro || c.problems.length > 0) && (
        <section
          aria-labelledby="problems"
          className="container-page grid gap-12 py-16 lg:grid-cols-2"
        >
          <div>
            <SectionHeading id="problems" eyebrow="The challenge" title="Problems we help solve" />
            {c.intro && <Paragraphs text={c.intro} className="mt-6" />}
          </div>
          {c.problems.length > 0 && (
            <ul className="space-y-3 self-center">
              {c.problems.map((p, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-lg border border-line bg-white p-4 leading-relaxed text-ink-soft"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand"
                  />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {c.capabilities.length > 0 && (
        <section aria-labelledby="capabilities" className="bg-surface">
          <div className="container-page py-16">
            <SectionHeading id="capabilities" eyebrow="Capabilities" title="What we deliver" />
            <ItemGrid items={c.capabilities} />
          </div>
        </section>
      )}

      {c.outcomes.length > 0 && (
        <section aria-labelledby="outcomes" className="container-page py-16">
          <SectionHeading id="outcomes" eyebrow="Business value" title="Outcomes we work towards" />
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {c.outcomes.map((o, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-line p-5">
                <svg
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-brand"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="leading-relaxed text-ink">{o.text}</p>
                  {o.evidence === "verified" && (
                    <p className="mt-1 text-sm font-medium text-success">Verified result</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {hasIllustrative && (
            <p className="mt-6 max-w-3xl text-sm text-muted">
              Outcomes are illustrative of what this kind of engagement aims to achieve. Actual
              results depend on each organisation&apos;s context and are agreed during discovery.
            </p>
          )}
        </section>
      )}

      {c.deliveryApproach.length > 0 && (
        <section aria-labelledby="approach" className="bg-surface">
          <div className="container-page py-16">
            <SectionHeading id="approach" eyebrow="How we deliver" title="Our delivery approach" />
            <ItemGrid items={c.deliveryApproach} numbered />
          </div>
        </section>
      )}

      {c.technologies.length > 0 && (
        <section aria-labelledby="technology" className="container-page py-16">
          <SectionHeading
            id="technology"
            eyebrow="Technology"
            title="Technology and integration capability"
          />
          <ul className="mt-8 flex flex-wrap gap-2">
            {c.technologies.map((t) => (
              <li
                key={t}
                className="rounded-md bg-surface-strong px-3 py-1.5 text-sm font-medium text-ink-soft"
              >
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section id="related-work" aria-labelledby="related" className="bg-surface">
          <div className="container-page py-16">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading id="related" eyebrow="Proof" title="Related projects" />
              <Link href={`/projects?service=${service.slug}`} className="link shrink-0">
                All {service.name.toLowerCase()} projects
              </Link>
            </div>
            <ul className="mt-10 grid gap-6 md:grid-cols-3">
              {related.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {c.faqs.length > 0 && (
        <section aria-labelledby="faq" className="container-page py-16">
          <SectionHeading id="faq" eyebrow="FAQ" title="Frequently asked questions" />
          <div className="mt-8 max-w-3xl divide-y divide-line border-y border-line">
            {c.faqs.map((f, i) => (
              <details key={i} className="group py-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-navy">
                  {f.question}
                  <span
                    aria-hidden="true"
                    className="text-brand transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <Paragraphs text={f.answer} className="mt-3 text-base" />
              </details>
            ))}
          </div>
        </section>
      )}

      <CtaBand
        heading={c.ctaHeading || `Discuss your ${service.name.toLowerCase()} needs`}
        text={c.ctaText || settings.responseExpectation}
        label={ctaLabel}
        href={enquiryHref}
        location={`service_footer:${service.slug}`}
      />
    </>
  );
}
