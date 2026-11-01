import Link from "next/link";
import { getLivePageSlugs, getSettings } from "@/lib/content/public";
import { LogoMark } from "./logo";
import { DesktopNavLink, MobileNav, type NavItem } from "./mobile-nav";

export async function SiteHeader() {
  const [settings, liveSlugs] = await Promise.all([getSettings(), getLivePageSlugs()]);
  const items: NavItem[] = [
    { href: "/services", label: "Services" },
    { href: "/projects", label: "Projects" },
    ...(liveSlugs.includes("about") ? [{ href: "/about", label: "About" }] : []),
    ...(liveSlugs.includes("approach") ? [{ href: "/approach", label: "Approach" }] : []),
    { href: "/contact", label: "Contact" },
  ];
  const cta = { href: "/contact", label: settings.primaryCtaLabel };
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="container-page relative flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-navy"
        >
          <LogoMark />
          <span>{settings.siteName}</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <DesktopNavLink key={item.href} item={item} />
          ))}
        </nav>
        <div className="hidden md:block">
          <Link href={cta.href} className="btn-primary btn-sm">
            {cta.label}
          </Link>
        </div>
        <MobileNav items={items} cta={cta} />
      </div>
    </header>
  );
}
