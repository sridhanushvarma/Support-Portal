import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import {
  assignableUsers,
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  EXPORT_MAX_ROWS,
  listEnquiries,
  parseEnquiryFilters,
} from "@/lib/enquiries/admin";
import { ENQUIRY_STATUSES, STATUS_LABELS } from "@/lib/enquiries/status";
import { formatDateTime } from "@/lib/format";
import {
  EmptyState,
  EnquiryStatusBadge,
  Notice,
  PageHeader,
  Pagination,
  Panel,
} from "@/components/admin/ui";

export const metadata: Metadata = { title: "Enquiries" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EnquiriesPage({ searchParams }: Props) {
  const user = await requireAdminPage("enquiries.read");
  const sp = await searchParams;
  const filters = parseEnquiryFilters(sp);
  const [result, owners, services, settings] = await Promise.all([
    listEnquiries({ user }, filters),
    assignableUsers(),
    prisma.service.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    loadSettings(),
  ]);
  const { page: _page, ...active } = filters;
  const activeCount = Object.values(active).filter(Boolean).length;
  const qs = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(active)) if (v) params.set(k, String(v));
    if (page > 1) params.set("page", String(page));
    return `/admin/enquiries${params.toString() ? `?${params}` : ""}`;
  };
  const canExport = user.permissions.has("enquiries.export");

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Review, assign and progress incoming project enquiries. Follow-up happens through your normal business process."
      />
      {sp.deleted && (
        <div className="mb-4">
          <Notice tone="success">The enquiry was permanently deleted.</Notice>
        </div>
      )}
      {typeof sp.exportError === "string" && (
        <div className="mb-4">
          <Notice tone="danger">{sp.exportError.slice(0, 300)}</Notice>
        </div>
      )}

      <Panel className="mb-6">
        <form
          method="get"
          className="grid gap-4 md:grid-cols-3 lg:grid-cols-6"
          role="search"
          aria-label="Filter enquiries"
        >
          <div className="lg:col-span-2">
            <label htmlFor="q" className="field-label">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Reference, organisation, name or email"
              className="input"
              maxLength={100}
            />
          </div>
          <div>
            <label htmlFor="status" className="field-label">
              Status
            </label>
            <select id="status" name="status" defaultValue={filters.status ?? ""} className="input">
              <option value="">Any status</option>
              {ENQUIRY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="owner" className="field-label">
              Owner
            </label>
            <select id="owner" name="owner" defaultValue={filters.owner ?? ""} className="input">
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="service" className="field-label">
              Service
            </label>
            <select
              id="service"
              name="service"
              defaultValue={filters.service ?? ""}
              className="input"
            >
              <option value="">Any service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="from" className="field-label">
                From
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={filters.from ?? ""}
                className="input px-2"
              />
            </div>
            <div>
              <label htmlFor="to" className="field-label">
                To
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={filters.to ?? ""}
                className="input px-2"
              />
            </div>
          </div>
          <div className="flex items-end gap-2 md:col-span-3 lg:col-span-6">
            <button type="submit" className="btn-primary btn-sm">
              Apply filters
            </button>
            {activeCount > 0 && (
              <Link href="/admin/enquiries" className="btn-secondary btn-sm">
                Clear filters
              </Link>
            )}
          </div>
        </form>
      </Panel>

      <p className="mb-3 text-sm text-muted" role="status">
        {result.total} enquir{result.total === 1 ? "y" : "ies"}
        {activeCount ? " match these filters" : ""}.
      </p>

      {result.rows.length === 0 ? (
        <EmptyState title={activeCount ? "No enquiries match these filters" : "No enquiries yet"}>
          {activeCount ? (
            <Link className="link" href="/admin/enquiries">
              Clear filters
            </Link>
          ) : (
            "New enquiries from the website will appear here."
          )}
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <caption className="sr-only">Enquiries, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Received</th>
                <th scope="col">Organisation</th>
                <th scope="col">Services</th>
                <th scope="col">Status</th>
                <th scope="col">Owner</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface">
                  <td>
                    <Link href={`/admin/enquiries/${r.id}`} className="link font-mono">
                      {r.reference}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">
                    {formatDateTime(r.createdAt, settings.adminTimeZone)}
                  </td>
                  <td>
                    {r.anonymisedAt ? (
                      <span className="text-muted">[anonymised]</span>
                    ) : (
                      <>
                        {r.organisation}
                        <span className="block text-xs text-muted">{r.name}</span>
                      </>
                    )}
                  </td>
                  <td className="text-ink-soft">
                    {r.serviceInterests.map((s) => s.serviceLabel).join(", ")}
                  </td>
                  <td>
                    <EnquiryStatusBadge status={r.status} />
                  </td>
                  <td>
                    {r.assignedTo?.displayName ?? <span className="text-muted">Unassigned</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} href={qs} />

      {canExport && (
        <Panel title="Export to CSV" className="mt-8">
          <form method="post" action="/admin/enquiries-export" className="space-y-4">
            {Object.entries(active).map(([k, v]) =>
              v ? <input key={k} type="hidden" name={k} value={String(v)} /> : null,
            )}
            <p className="text-sm text-muted">
              Exports the enquiries matching the current filters (maximum {EXPORT_MAX_ROWS} rows).
              Include only the columns you need. Every export is recorded in the audit log. Store
              exported files securely and delete them when no longer needed.
            </p>
            <fieldset>
              <legend className="field-label">Columns</legend>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(EXPORT_COLUMNS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="columns"
                      value={key}
                      defaultChecked={(DEFAULT_EXPORT_COLUMNS as string[]).includes(key)}
                      className="h-4 w-4 accent-[var(--color-brand)]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="btn-secondary btn-sm">
              Download CSV
            </button>
          </form>
        </Panel>
      )}
    </>
  );
}
