import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedServices, getSettings } from "@/lib/content/public";
import { issueFormToken } from "@/lib/enquiries/form-token";
import { formConfig } from "@/lib/enquiries/submit";
import { pageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/site/blocks";
import { EnquiryForm } from "@/components/site/enquiry-form";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return pageMetadata({
    title: "Start a project",
    description: `Tell ${settings.siteName} about your project or request a consultation.`,
    path: "/contact",
  });
}

type Props = { searchParams: Promise<{ service?: string }> };

export default async function ContactPage({ searchParams }: Props) {
  const { service } = await searchParams;
  const [settings, services] = await Promise.all([getSettings(), getPublishedServices()]);
  const preselected = services.some((s) => s.slug === service) ? service! : null;
  const steps = [
    { title: "We review your brief", text: settings.responseExpectation },
    {
      title: "An initial conversation",
      text: "We discuss your goals, constraints and timeline, and answer your questions. There is no obligation.",
    },
    {
      title: "A clear proposal",
      text: "If there is a good fit, we suggest a scoped next step such as a discovery phase.",
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Tell us about your project"
        intro="Share a little about what you need. The more context you give, the more useful our first conversation will be."
      />
      <section className="container-page grid gap-12 py-14 lg:grid-cols-[1fr_22rem]">
        <div>
          <EnquiryForm
            services={services.map((s) => ({ slug: s.slug, name: s.name }))}
            config={formConfig(
              settings,
              services.map((s) => s.slug),
            )}
            preselected={preselected}
            initialToken={issueFormToken()}
            submitLabel={settings.primaryCtaLabel}
          />
        </div>
        <aside className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-navy">What happens next</h2>
            <ol className="mt-4 space-y-5">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-ink">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {(settings.contactEmail || settings.contactPhone || settings.contactAddress) && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-navy">Other ways to reach us</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {settings.contactEmail && (
                  <div>
                    <dt className="text-muted">Email</dt>
                    <dd>
                      <a className="link" href={`mailto:${settings.contactEmail}`}>
                        {settings.contactEmail}
                      </a>
                    </dd>
                  </div>
                )}
                {settings.contactPhone && (
                  <div>
                    <dt className="text-muted">Phone</dt>
                    <dd>
                      <a
                        className="link"
                        href={`tel:${settings.contactPhone.replace(/[^+\d]/g, "")}`}
                      >
                        {settings.contactPhone}
                      </a>
                    </dd>
                  </div>
                )}
                {settings.contactAddress && (
                  <div>
                    <dt className="text-muted">Address</dt>
                    <dd className="whitespace-pre-line text-ink-soft">{settings.contactAddress}</dd>
                  </div>
                )}
                {settings.businessHours && (
                  <div>
                    <dt className="text-muted">Hours</dt>
                    <dd className="text-ink-soft">{settings.businessHours}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
          <p className="text-sm text-muted">
            We use the details you provide only to respond to your enquiry. See our{" "}
            <Link href="/privacy" className="link">
              privacy notice
            </Link>
            .
          </p>
        </aside>
      </section>
    </>
  );
}
