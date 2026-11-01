import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/lib/env";
import {
  getFeaturedProjects,
  getPublishedPage,
  getPublishedServices,
  getSettings,
} from "@/lib/content/public";
import { pageMetadata } from "@/lib/seo";
import {
  CtaBand,
  JsonLd,
  PageSections,
  ProjectCard,
  SectionHeading,
  ServiceCard,
} from "@/components/site/blocks";
import { TrackedLink } from "@/components/site/tracked-link";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSettings(), getPublishedPage("home")]);
  return pageMetadata({
    title: page?.seoTitle || `${settings.siteName} | ${settings.tagline}`,
    description: page?.seoDescription || settings.tagline,
    path: "/",
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  const [settings, page, services, projects] = await Promise.all([
    getSettings(),
    getPublishedPage("home"),
    getPublishedServices(),
    getFeaturedProjects(3),
  ]);
  const heroTitle = page?.content.heroTitle || settings.tagline;
  const heroIntro = page?.content.heroIntro;
  const sameAs = [settings.linkedinUrl, settings.githubUrl].filter(Boolean);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: settings.legalName || settings.siteName,
          url: env().SITE_URL,
          ...(settings.contactEmail ? { email: settings.contactEmail } : {}),
          ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
          ...(sameAs.length ? { sameAs } : {}),
        }}
      />
      <section className="relative overflow-hidden bg-navy text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.25),transparent_55%)]"
        />
        <div className="container-page relative py-20 sm:py-28">
          <p className="text-sm font-semibold tracking-wide text-teal-300 uppercase">
            {settings.siteName}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            {heroTitle}
          </h1>
          {heroIntro && (
            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-slate-200">{heroIntro}</p>
          )}
          <div className="mt-10 flex flex-wrap gap-4">
            <TrackedLink href="/contact" className="btn-inverse" location="home_hero">
              {settings.primaryCtaLabel}
            </TrackedLink>
            <Link
              href="/services"
              className="btn border border-white/40 text-white hover:bg-white/10"
            >
              Explore our services
            </Link>
          </div>
        </div>
      </section>

      {services.length > 0 && (
        <section aria-labelledby="services-heading" className="container-page py-20">
          <SectionHeading
            id="services-heading"
            eyebrow="What we do"
            title="Services built around business outcomes"
            intro="Each engagement starts from the operational problem you need to solve, not from a technology."
          />
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <li key={s.id}>
                <ServiceCard service={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {page && page.content.sections.length > 0 && (
        <PageSections sections={page.content.sections} />
      )}

      {projects.length > 0 && (
        <section aria-labelledby="work-heading" className="bg-surface">
          <div className="container-page py-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading id="work-heading" eyebrow="Selected work" title="Recent projects" />
              <Link href="/projects" className="link shrink-0">
                View all projects
              </Link>
            </div>
            <ul className="mt-12 grid gap-6 md:grid-cols-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand
        heading="Have a project in mind?"
        text={settings.responseExpectation}
        label={settings.primaryCtaLabel}
        href="/contact"
        location="home_footer"
      />
    </>
  );
}
