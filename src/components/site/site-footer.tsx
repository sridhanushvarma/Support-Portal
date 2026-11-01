import Link from "next/link";
import {
  getFooterPages,
  getLivePageSlugs,
  getPublishedServices,
  getSettings,
} from "@/lib/content/public";
import { ConsentPreferencesButton } from "./analytics";
import { LogoMark } from "./logo";

export async function SiteFooter() {
  const [settings, services, footerPages, liveSlugs] = await Promise.all([
    getSettings(),
    getPublishedServices(),
    getFooterPages(),
    getLivePageSlugs(),
  ]);
  const year = new Date().getUTCFullYear();
  const company = [
    ...(liveSlugs.includes("about") ? [{ href: "/about", label: "About" }] : []),
    ...(liveSlugs.includes("approach") ? [{ href: "/approach", label: "Our approach" }] : []),
    { href: "/projects", label: "Projects" },
    { href: "/contact", label: "Contact" },
  ];
  const legal = footerPages.length
    ? footerPages.map((p) => ({ href: `/${p.slug}`, label: p.title }))
    : liveSlugs.includes("privacy")
      ? [{ href: "/privacy", label: "Privacy notice" }]
      : [];
  return (
    <footer className="bg-navy text-slate-300">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2.5 text-lg font-bold text-white">
            <LogoMark />
            {settings.siteName}
          </Link>
          {settings.tagline && <p className="mt-4 text-sm leading-relaxed">{settings.tagline}</p>}
          <address className="mt-5 space-y-1.5 text-sm not-italic">
            {settings.contactEmail && (
              <p>
                <a
                  className="hover:text-white hover:underline"
                  href={`mailto:${settings.contactEmail}`}
                >
                  {settings.contactEmail}
                </a>
              </p>
            )}
            {settings.contactPhone && (
              <p>
                <a
                  className="hover:text-white hover:underline"
                  href={`tel:${settings.contactPhone.replace(/[^+\d]/g, "")}`}
                >
                  {settings.contactPhone}
                </a>
              </p>
            )}
            {settings.contactAddress && (
              <p className="whitespace-pre-line">{settings.contactAddress}</p>
            )}
          </address>
        </div>
        <FooterColumn
          title="Services"
          links={services.map((s) => ({ href: `/services/${s.slug}`, label: s.name }))}
        />
        <FooterColumn title="Company" links={company} />
        <div>
          <FooterColumn title="Legal" links={legal} />
          {(settings.linkedinUrl || settings.githubUrl) && (
            <ul className="mt-6 flex gap-4 text-sm">
              {settings.linkedinUrl && (
                <li>
                  <a
                    href={settings.linkedinUrl}
                    rel="noopener noreferrer"
                    className="hover:text-white hover:underline"
                  >
                    LinkedIn
                  </a>
                </li>
              )}
              {settings.githubUrl && (
                <li>
                  <a
                    href={settings.githubUrl}
                    rel="noopener noreferrer"
                    className="hover:text-white hover:underline"
                  >
                    GitHub
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings.legalName || settings.siteName}. All rights reserved.
          </p>
          <ConsentPreferencesButton />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  if (links.length === 0) return <div />;
  return (
    <nav aria-label={title}>
      <h2 className="text-sm font-semibold tracking-wide text-white uppercase">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-white hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
