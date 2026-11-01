import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import {
  enquiryReport,
  launchReadiness,
  notificationHealth,
  reviewQueue,
  staleContent,
} from "@/lib/reports";
import { formatDate, formatDateTime } from "@/lib/format";
import { Notice, PageHeader, Panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Dashboard" };

const kindPath = { service: "services", project: "projects", page: "pages" } as const;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; mfa?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireAdminPage();
  const p = user.permissions;
  const settings = await loadSettings();
  const tz = settings.adminTimeZone;

  const [readiness, report, queue, stale, health, recent] = await Promise.all([
    p.has("settings.manage") || p.has("users.manage") ? launchReadiness(settings) : null,
    p.has("reports.read") ? enquiryReport(90) : null,
    p.has("content.publish") ? reviewQueue() : null,
    p.has("content.publish") ? staleContent(settings.contentReviewDays) : null,
    p.has("notifications.manage") ? notificationHealth() : null,
    p.has("enquiries.read")
      ? prisma.enquiry.findMany({
          where: { status: "NEW" },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            reference: true,
            organisation: true,
            createdAt: true,
            status: true,
            assignedToId: true,
          },
        })
      : null,
  ]);
  const maxWeekly = Math.max(1, ...(report?.weekly.map((w) => w.n) ?? [1]));
  const readinessOk = readiness?.filter((r) => r.ok).length ?? 0;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.displayName.split(" ")[0]}`}
        description="An overview of enquiries, content and site health relevant to your role."
      />
      <div className="space-y-6">
        {sp.denied && (
          <Notice tone="warning">
            You do not have permission to open that page. Ask an administrator if you need access.
          </Notice>
        )}
        {sp.mfa && (
          <Notice tone="success">
            Multi-factor authentication is now enabled for your account.
          </Notice>
        )}

        {health && (health.dead > 0 || health.stalePending > 0) && (
          <Notice tone="danger">
            {health.dead} notification(s) could not be delivered
            {health.stalePending
              ? ` and ${health.stalePending} are waiting longer than expected`
              : ""}
            . Enquiries are stored safely, but someone may not have been told.{" "}
            <Link href="/admin/notifications" className="font-semibold underline">
              Review notification health
            </Link>
          </Notice>
        )}

        {recent && (
          <Panel
            title="New enquiries"
            actions={
              <Link href="/admin/enquiries?status=NEW" className="link text-sm">
                Open inbox
              </Link>
            }
          >
            {recent.length === 0 ? (
              <p className="text-sm text-muted">No new enquiries waiting for review.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-admin">
                  <thead>
                    <tr>
                      <th scope="col">Reference</th>
                      <th scope="col">Organisation</th>
                      <th scope="col">Received</th>
                      <th scope="col">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <Link className="link font-mono" href={`/admin/enquiries/${e.id}`}>
                            {e.reference}
                          </Link>
                        </td>
                        <td>{e.organisation}</td>
                        <td>{formatDateTime(e.createdAt, tz)}</td>
                        <td>
                          {e.assignedToId ? (
                            "Assigned"
                          ) : (
                            <span className="text-warning">Unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {report && (
          <Panel title="Enquiries in the last 90 days">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Stat label="Enquiries received" value={String(report.total)} />
              <Stat label="Qualified or better" value={String(report.qualified)} />
              <Stat
                label="Median time to first response"
                value={
                  report.medianFirstResponseHours === null
                    ? "—"
                    : `${report.medianFirstResponseHours.toFixed(1)} h`
                }
                hint={`${report.responded} with a recorded response; elapsed hours, not business hours`}
              />
            </dl>
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <BarList title="By service interest" rows={report.byService} />
              <BarList title="By source" rows={report.bySource} />
              <BarList title="By status" rows={report.byStatus} />
            </div>
            {report.weekly.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-ink-soft">
                  Weekly enquiries (last 12 weeks)
                </h3>
                <table className="mt-2 w-full text-sm">
                  <caption className="sr-only">Enquiries per week</caption>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Week starting</th>
                      <th scope="col">Enquiries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.weekly.map((w) => (
                      <tr key={w.week}>
                        <th scope="row" className="w-28 py-1 pr-3 text-left font-normal text-muted">
                          {formatDate(w.week, "UTC")}
                        </th>
                        <td className="py-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 rounded bg-brand"
                              style={{ width: `${(w.n / maxWeekly) * 100}%`, minWidth: 4 }}
                              aria-hidden="true"
                            />
                            <span>{w.n}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-4 text-xs text-muted">
              Aggregated from stored enquiries. Traffic and conversion rates are reported in the
              analytics platform. Treat trends as directional, not proof of cause.
            </p>
          </Panel>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {queue && (
            <Panel title="Waiting for review">
              {queue.length === 0 ? (
                <p className="text-sm text-muted">Nothing is waiting for review.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {queue.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <Link href={`/admin/${kindPath[q.kind]}/${q.id}`} className="link">
                        {q.title}
                      </Link>
                      <span className="text-muted capitalize">{q.kind}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
          {stale && (
            <Panel title="Content due for review">
              {stale.length === 0 ? (
                <p className="text-sm text-muted">
                  All live content was reviewed within the last {settings.contentReviewDays} days.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {stale.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <Link href={`/admin/${kindPath[s.kind]}/${s.id}`} className="link">
                        {s.title}
                      </Link>
                      <span className="text-muted">
                        Last reviewed {formatDate(s.lastReviewedAt, tz)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>

        {readiness && (
          <Panel title={`Launch readiness (${readinessOk} of ${readiness.length} checks pass)`}>
            <p className="mb-4 text-sm text-muted">
              Checks the application can verify itself. Legal sign-off, UAT, restore tests and
              accessibility review are tracked outside the system (see docs/go-live-checklist.md).
            </p>
            <ul className="grid gap-2 md:grid-cols-2">
              {readiness.map((r) => (
                <li key={r.label} className="flex gap-3 rounded-lg border border-line p-3 text-sm">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${r.ok ? "bg-success" : "bg-warning"}`}
                  >
                    {r.ok ? "✓" : "!"}
                  </span>
                  <div>
                    <p className="font-semibold text-ink">
                      <span className="sr-only">{r.ok ? "Passed: " : "Needs attention: "}</span>
                      {r.label}
                    </p>
                    {!r.ok && <p className="text-muted">{r.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {!recent && !report && !queue && !readiness && (
          <Panel>
            <p className="text-ink-soft">Use the menu to open the areas available to your role.</p>
          </Panel>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-navy">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-soft">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No data yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{r.label}</span>
                <span className="font-semibold">{r.n}</span>
              </div>
              <div aria-hidden="true" className="mt-1 h-1.5 rounded bg-surface-strong">
                <div
                  className="h-1.5 rounded bg-brand"
                  style={{ width: `${(r.n / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
