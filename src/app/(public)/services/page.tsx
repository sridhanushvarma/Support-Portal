import type { Metadata } from "next";
import { getPublishedServices, getSettings } from "@/lib/content/public";
import { pageMetadata } from "@/lib/seo";
import { CtaBand, PageHero, ServiceCard } from "@/components/site/blocks";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Services",
    description:
      "ERP, custom software, web applications, data analytics and AI automation services focused on measurable business outcomes.",
    path: "/services",
  });
}

export default async function ServicesPage() {
  const [services, settings] = await Promise.all([getPublishedServices(), getSettings()]);
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Technology services for the problems that slow your business down"
        intro="Choose the area closest to your challenge. Every service page explains the problems we address, how we deliver, and what you can expect."
      />
      <section className="container-page py-16">
        {services.length === 0 ? (
          <p className="text-lg text-ink-soft">
            Service information is being updated. Please contact us to discuss your needs.
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <li key={s.id}>
                <ServiceCard service={s} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <CtaBand
        heading="Not sure which service fits?"
        text="Tell us about the problem and we will suggest a sensible starting point."
        label={settings.secondaryCtaLabel}
        href="/contact"
        location="services_index"
      />
    </>
  );
}
