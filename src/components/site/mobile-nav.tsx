"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface NavItem {
  href: string;
  label: string;
}

/** Disclosure-pattern mobile menu (FR-GEN-002): keyboard operable, announces state, Escape closes. */
export function MobileNav({ items, cta }: { items: NavItem[]; cta: NavItem }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={button}
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line text-ink"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <div
        id="mobile-menu"
        ref={panel}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-white shadow-lg"
      >
        <nav aria-label="Main" className="container-page flex flex-col py-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="rounded-lg px-2 py-3 text-lg font-medium text-ink hover:bg-surface aria-[current=page]:text-brand"
              >
                {item.label}
              </Link>
            );
          })}
          <Link href={cta.href} className="btn-primary mt-3">
            {cta.label}
          </Link>
        </nav>
      </div>
    </div>
  );
}

export function DesktopNavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="rounded-md px-3 py-2 text-[0.95rem] font-medium text-ink-soft hover:text-ink aria-[current=page]:text-brand aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
    >
      {item.label}
    </Link>
  );
}
