import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { LogoMark } from "@/components/site/logo";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";
import { logoutAction } from "../auth-actions";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage(undefined, { allowMfaSetup: true });
  const p = user.permissions;
  const items: AdminNavItem[] = [
    { href: "/admin", label: "Dashboard", group: "Overview" },
    ...(p.has("enquiries.read")
      ? [{ href: "/admin/enquiries", label: "Enquiries", group: "Leads" }]
      : []),
    ...(p.has("content.edit")
      ? [
          { href: "/admin/services", label: "Services", group: "Content" },
          { href: "/admin/projects", label: "Projects", group: "Content" },
          { href: "/admin/pages", label: "Pages", group: "Content" },
        ]
      : []),
    ...(p.has("media.upload") || p.has("media.manage")
      ? [{ href: "/admin/media", label: "Media library", group: "Content" }]
      : []),
    ...(p.has("redirects.manage")
      ? [{ href: "/admin/redirects", label: "Redirects", group: "Content" }]
      : []),
    ...(p.has("users.manage")
      ? [{ href: "/admin/users", label: "Users and roles", group: "Administration" }]
      : []),
    ...(p.has("settings.manage")
      ? [{ href: "/admin/settings", label: "Site settings", group: "Administration" }]
      : []),
    ...(p.has("notifications.manage")
      ? [{ href: "/admin/notifications", label: "Notification health", group: "Administration" }]
      : []),
    ...(p.has("audit.read")
      ? [{ href: "/admin/audit", label: "Audit log", group: "Administration" }]
      : []),
    { href: "/admin/account", label: "My account", group: "You" },
  ];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#admin-main" className="skip-link">
        Skip to content
      </a>
      <aside className="relative border-b border-line bg-white lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-navy lg:mb-6">
            <LogoMark className="h-7 w-7" /> Admin
          </Link>
          <AdminNav items={items} />
        </div>
        <div className="hidden px-2 lg:block" />
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3 sm:px-8">
          <Link
            href="/"
            className="text-sm text-muted hover:text-ink hover:underline"
            target="_blank"
          >
            View public site<span className="sr-only"> (opens in a new tab)</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-ink-soft">
              <span className="font-semibold text-ink">{user.displayName}</span>
              <span className="hidden sm:inline">
                {" "}
                · {user.roles.map((r) => ROLE_LABELS[r].label).join(", ")}
              </span>
            </span>
            <form action={logoutAction}>
              <button type="submit" className="btn-secondary btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main
          id="admin-main"
          tabIndex={-1}
          className="mx-auto max-w-6xl px-5 py-8 focus:outline-none sm:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
