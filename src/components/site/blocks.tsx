import Link from "next/link";
import type { PageContent, PublishedProject, PublishedService } from "@/lib/content/schemas";
import { paragraphs } from "@/lib/format";
import { TrackedLink } from "./tracked-link";

export function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  const ps = paragraphs(text);
  if (ps.length === 0) return null;
  return (
    <div className={`space-y-4 text-lg leading-relaxed text-ink-soft ${className}`}>
      {ps.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  id,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  id?: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={id} className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-4 text-lg leading-relaxed text-ink-soft">{intro}</p>}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-line bg-gradient-to-b from-surface to-white">
      <div className="container-page py-16 sm:py-20">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-navy sm:text-5xl">
          {title}
        </h1>
        {intro && <p className="mt-6 max-w-3xl text-xl leading-relaxed text-ink-soft">{intro}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="container-page pt-6 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink-soft">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ServiceCard({ service }: { service: PublishedService }) {
  return (
    <article className="card group relative flex h-full flex-col p-6 transition-shadow hover:shadow-[0_12px_32px_rgba(11,31,51,0.08)]">
      <h3 className="text-xl font-semibold text-navy">
        <Link
          href={`/services/${service.slug}`}
          className="after:absolute after:inset-0 focus-visible:outline-none"
        >
          {service.name}
        </Link>
      </h3>
      <p className="mt-3 flex-1 leading-relaxed text-ink-soft">{service.content.summary}</p>
      <span
        aria-hidden="true"
        className="mt-5 inline-flex items-center gap-1 font-semibold text-brand group-hover:gap-2 transition-all"
      >
        Explore service <span>→</span>
      </span>
    </article>
  );
}

export function ProjectCard({
  project,
  headingLevel = 3,
}: {
  project: PublishedProject;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="card group relative flex h-full flex-col overflow-hidden">
      {project.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- media is pre-optimised WebP served with dimensions
        <img
          src={project.thumbnail.url}
          alt={project.thumbnail.alt}
          width={project.thumbnail.width}
          height={project.thumbnail.height}
          loading="lazy"
          decoding="async"
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="aspect-[16/9] w-full bg-gradient-to-br from-navy to-brand-strong"
        />
      )}
      <div className="flex flex-1 flex-col p-6">
        {project.services.length > 0 && (
          <p className="text-sm font-medium text-brand">
            {project.services.map((s) => s.name).join(" · ")}
          </p>
        )}
        <H className="mt-2 text-xl font-semibold text-navy">
          <Link
            href={`/projects/${project.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {project.title}
          </Link>
        </H>
        <p className="mt-1 text-sm text-muted">{project.displayClient}</p>
        <p className="mt-3 flex-1 leading-relaxed text-ink-soft">{project.summary}</p>
      </div>
    </article>
  );
}

export function CtaBand({
  heading,
  text,
  label,
  href,
  location,
}: {
  heading: string;
  text?: string;
  label: string;
  href: string;
  location: string;
}) {
  return (
    <section aria-labelledby={`cta-${location}`} className="bg-navy">
      <div className="container-page flex flex-col gap-6 py-14 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 id={`cta-${location}`} className="text-3xl font-bold tracking-tight text-white">
            {heading}
          </h2>
          {text && <p className="mt-3 text-lg text-slate-300">{text}</p>}
        </div>
        <TrackedLink href={href} className="btn-inverse shrink-0" location={location}>
          {label}
        </TrackedLink>
      </div>
    </section>
  );
}

export function ItemGrid({
  items,
  numbered = false,
}: {
  items: { title: string; description: string }[];
  numbered?: boolean;
}) {
  const List = numbered ? "ol" : "ul";
  return (
    <List
      className={`mt-10 grid gap-5 sm:grid-cols-2 ${items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      {items.map((item, i) => (
        <li key={i} className="card p-6">
          {numbered && (
            <span
              aria-hidden="true"
              className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft font-bold text-brand"
            >
              {i + 1}
            </span>
          )}
          <h3 className="text-lg font-semibold text-navy">{item.title}</h3>
          {item.description && (
            <p className="mt-2 leading-relaxed text-ink-soft">{item.description}</p>
          )}
        </li>
      ))}
    </List>
  );
}

/** Renders editor-managed page sections. All content is plain text; nothing is interpreted as HTML. */
export function PageSections({ sections }: { sections: PageContent["sections"] }) {
  return (
    <>
      {sections.map((section, i) => (
        <section key={i} className={i % 2 === 1 ? "bg-surface" : ""}>
          <div className="container-page py-16">
            {section.heading && <SectionHeading title={section.heading} />}
            {section.body && (
              <Paragraphs
                text={section.body}
                className={`max-w-3xl ${section.heading ? "mt-6" : ""}`}
              />
            )}
            {section.items.length > 0 && (
              <ItemGrid items={section.items} numbered={section.layout === "steps"} />
            )}
          </div>
        </section>
      ))}
    </>
  );
}

/** JSON-LD script with `<` escaped so content cannot break out of the script element. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
