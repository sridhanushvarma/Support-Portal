import Link from "next/link";
import type { PublishedProject } from "@/lib/content/schemas";
import type { SiteSettings } from "@/lib/settings";
import { Breadcrumbs, CtaBand, Paragraphs } from "./blocks";

/** Case-study template (FR-PORT-003). Empty optional sections are omitted, never shown as empty labels. */
export function ProjectDetail({
  project,
  settings,
}: {
  project: PublishedProject;
  settings: SiteSettings;
}) {
  const c = project.content;
  const facts = [
    { label: "Client", value: project.displayClient },
    { label: "Industry", value: c.industry },
    { label: "Engagement", value: c.engagement },
    { label: "Duration", value: c.duration },
  ].filter((f) => f.value);
  const sections = [
    { id: "context", title: "Context", text: c.context },
    { id: "challenge", title: "The challenge", text: c.challenge },
    { id: "approach", title: "Our approach", text: c.approach },
    { id: "solution", title: "The solution", text: c.solution },
    { id: "contribution", title: "Our contribution", text: c.contribution },
  ].filter((s) => s.text);
  const primaryService = project.services[0];
  const enquiryHref = `/contact${primaryService ? `?service=${encodeURIComponent(primaryService.slug)}` : ""}`;

  return (
    <article>
      <div className="bg-surface">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/projects", label: "Projects" },
            { label: project.title },
          ]}
        />
        <header className="container-page pt-8 pb-14">
          {project.services.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {project.services.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-strong hover:underline"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight text-navy sm:text-5xl">
            {project.title}
          </h1>
          <p className="mt-5 max-w-3xl text-xl leading-relaxed text-ink-soft">{project.summary}</p>
          {facts.length > 0 && (
            <dl className="mt-10 grid max-w-4xl grid-cols-2 gap-6 border-t border-line pt-6 md:grid-cols-4">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-sm text-muted">{f.label}</dt>
                  <dd className="mt-1 font-semibold text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </header>
      </div>

      {project.thumbnail && (
        <div className="container-page -mt-2 pt-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised media */}
          <img
            src={project.thumbnail.url}
            alt={project.thumbnail.alt}
            width={project.thumbnail.width}
            height={project.thumbnail.height}
            className="w-full rounded-xl border border-line object-cover"
            fetchPriority="high"
          />
        </div>
      )}

      <div className="container-page grid gap-12 py-16 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-12">
          {sections.map((s) => (
            <section key={s.id} aria-labelledby={s.id}>
              <h2 id={s.id} className="text-2xl font-bold text-navy">
                {s.title}
              </h2>
              <Paragraphs text={s.text} className="mt-4" />
            </section>
          ))}

          {c.outcomes.length > 0 && (
            <section aria-labelledby="results">
              <h2 id="results" className="text-2xl font-bold text-navy">
                Results
              </h2>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {c.outcomes.map((o, i) => (
                  <li key={i} className="rounded-xl border border-line bg-surface p-5">
                    {o.value && <p className="text-3xl font-bold text-brand">{o.value}</p>}
                    <p className="mt-1 font-semibold text-navy">{o.label}</p>
                    {o.description && (
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{o.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.testimonial.quote && (
            <figure className="rounded-xl border-l-4 border-brand bg-surface p-8">
              <blockquote className="text-xl leading-relaxed text-ink">
                &ldquo;{c.testimonial.quote}&rdquo;
              </blockquote>
              {c.testimonial.attribution && (
                <figcaption className="mt-4 font-semibold text-ink-soft">
                  — {c.testimonial.attribution}
                </figcaption>
              )}
            </figure>
          )}

          {project.gallery.length > 0 && (
            <section aria-labelledby="gallery">
              <h2 id="gallery" className="text-2xl font-bold text-navy">
                Gallery
              </h2>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                {project.gallery.map((g) => (
                  <li key={g.id}>
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised media */}
                      <img
                        src={g.url}
                        alt={g.alt}
                        width={g.width}
                        height={g.height}
                        loading="lazy"
                        className="w-full rounded-lg border border-line"
                      />
                      {g.caption && (
                        <figcaption className="mt-2 text-sm text-muted">{g.caption}</figcaption>
                      )}
                    </figure>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {c.technologies.length > 0 && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                Technology
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {c.technologies.map((t) => (
                  <li
                    key={t}
                    className="rounded-md bg-surface-strong px-2.5 py-1 text-sm text-ink-soft"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="card bg-brand-soft p-6">
            <h2 className="font-semibold text-navy">Facing a similar challenge?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Tell us about your situation and we will tell you honestly whether we can help.
            </p>
            <Link href={enquiryHref} className="btn-primary btn-sm mt-4 w-full">
              {settings.primaryCtaLabel}
            </Link>
          </div>
        </aside>
      </div>

      <CtaBand
        heading="Discuss a similar project"
        text={settings.responseExpectation}
        label={settings.primaryCtaLabel}
        href={enquiryHref}
        location={`project:${project.slug}`}
      />
    </article>
  );
}
