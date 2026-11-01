import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader, Pagination } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Audit log" };
const PAGE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; actor?: string; page?: string }>;
}) {
  await requireAdminPage("audit.read");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const where = {
    ...(sp.action ? { action: { startsWith: sp.action.slice(0, 60) } } : {}),
    ...(sp.entity ? { entityType: sp.entity.slice(0, 30) } : {}),
    ...(sp.actor ? { actorEmail: { contains: sp.actor.slice(0, 100).toLowerCase() } } : {}),
  };
  const [rows, total, settings] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    prisma.auditEvent.count({ where }),
    loadSettings(),
  ]);
  const href = (p: number) => {
    const q = new URLSearchParams(
      Object.entries({ action: sp.action, entity: sp.entity, actor: sp.actor }).filter(
        ([, v]) => v,
      ) as [string, string][],
    );
    if (p > 1) q.set("page", String(p));
    return `/admin/audit${q.toString() ? `?${q}` : ""}`;
  };
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of sign-ins, publication, role changes, exports, lead updates and deletions. Contains no passwords, secrets or enquiry text."
      />
      <form
        method="get"
        className="card mb-6 grid gap-4 p-5 md:grid-cols-4 md:items-end"
        role="search"
        aria-label="Filter audit log"
      >
        <div>
          <label htmlFor="action" className="field-label">
            Action starts with
          </label>
          <input
            id="action"
            name="action"
            defaultValue={sp.action}
            placeholder="e.g. content.publish"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="entity" className="field-label">
            Entity type
          </label>
          <select id="entity" name="entity" defaultValue={sp.entity ?? ""} className="input">
            <option value="">Any</option>
            {["enquiry", "service", "project", "page", "user", "media", "redirect", "settings"].map(
              (e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label htmlFor="actor" className="field-label">
            Actor email contains
          </label>
          <input id="actor" name="actor" defaultValue={sp.actor} className="input" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary btn-sm">
            Filter
          </button>
          <Link href="/admin/audit" className="btn-secondary btn-sm">
            Reset
          </Link>
        </div>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No events match" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">
                    {formatDateTime(r.createdAt, settings.adminTimeZone)}
                  </td>
                  <td>{r.actorEmail ?? <span className="text-muted">system / visitor</span>}</td>
                  <td className="font-mono text-xs">{r.action}</td>
                  <td className="text-xs">
                    {r.entityType}
                    {r.entityId ? (
                      <span className="block font-mono text-muted">{r.entityId.slice(0, 8)}</span>
                    ) : null}
                  </td>
                  <td className="max-w-xs font-mono text-xs break-words text-muted">
                    {r.metadata ? JSON.stringify(r.metadata).slice(0, 240) : ""}
                    {r.requestId ? (
                      <span className="block">req {r.requestId.slice(0, 8)}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE))} href={href} />
    </>
  );
}
