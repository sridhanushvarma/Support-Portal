"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface AdminNavItem {
  href: string;
  label: string;
  group: string;
}

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const groups = [...new Set(items.map((i) => i.group))];
  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        type="button"
        className="btn-secondary btn-sm lg:hidden"
        aria-expanded={open}
        aria-controls="admin-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close menu" : "Menu"}
      </button>
      <nav
        id="admin-nav"
        aria-label="Admin"
        className={`${open ? "block" : "hidden"} absolute inset-x-0 top-full z-30 border-b border-line bg-white p-4 shadow-lg lg:static lg:block lg:border-0 lg:p-0 lg:shadow-none`}
      >
        {groups.map((g) => (
          <div key={g} className="mb-5">
            <p className="mb-1.5 px-3 text-xs font-semibold tracking-wide text-muted uppercase">
              {g}
            </p>
            <ul className="space-y-0.5">
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={isActive(i.href) ? "page" : undefined}
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface hover:text-ink aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong"
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
