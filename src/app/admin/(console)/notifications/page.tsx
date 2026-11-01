import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { formatDateTime, humanize } from "@/lib/format";
import { MAX_ATTEMPTS } from "@/lib/notifications/outbox";
import { AdminForm, SubmitButton } from "@/components/admin/form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/admin/ui";
import { retryNotificationAction } from "./actions";

export const metadata: Metadata = { title: "Notification health" };

export default async function NotificationsPage() {
  await requireAdminPage("notifications.manage");
  const [problems, counts, settings] = await Promise.all([
    prisma.notification.findMany({
      where: { status: { in: ["FAILED", "DEAD"] } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { enquiry: { select: { id: true, reference: true } } },
    }),
    prisma.notification.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
    }),
    loadSettings(),
  ]);
  const e = env();
  return (
    <>
      <PageHeader
        title="Notification health"
        description={`Email is not the system of record: enquiries are always stored first. Failed deliveries retry automatically up to ${MAX_ATTEMPTS} times with increasing delays, then alert the operations address.`}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Panel title="Provider">
          <p className="text-sm">
            {e.EMAIL_PROVIDER === "smtp"
              ? `SMTP via ${e.SMTP_HOST}`
              : e.EMAIL_PROVIDER === "console"
                ? "Console (development only)"
                : "Disabled"}
          </p>
        </Panel>
        <Panel title="Operations alerts">
          <p className="text-sm">
            {e.OPS_ALERT_EMAIL || (
              <span className="text-warning">Not configured (set OPS_ALERT_EMAIL)</span>
            )}
          </p>
        </Panel>
        <Panel title="Last 30 days">
          <ul className="text-sm">
            {counts.map((c) => (
              <li key={c.status}>
                {humanize(c.status)}: {c._count._all}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {settings.enquiryRecipients.length === 0 && (
        <div className="mb-6">
          <Notice tone="warning">
            No team recipients are configured. Add them in{" "}
            <Link className="underline" href="/admin/settings">
              Site settings
            </Link>
            .
          </Notice>
        </div>
      )}
      {problems.length === 0 ? (
        <EmptyState title="No failed notifications">
          All recent notifications were delivered or are queued.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <thead>
              <tr>
                <th scope="col">Enquiry</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Attempts</th>
                <th scope="col">Last error</th>
                <th scope="col">Updated</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {problems.map((n) => (
                <tr key={n.id}>
                  <td>
                    {n.enquiry ? (
                      <Link className="link font-mono" href={`/admin/enquiries/${n.enquiry.id}`}>
                        {n.enquiry.reference}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{humanize(n.kind)}</td>
                  <td
                    className={n.status === "DEAD" ? "font-semibold text-danger" : "text-warning"}
                  >
                    {n.status === "DEAD" ? "Gave up" : "Retrying"}
                  </td>
                  <td>{n.attempts}</td>
                  <td className="max-w-xs text-xs break-words text-muted">{n.lastError}</td>
                  <td className="whitespace-nowrap">
                    {formatDateTime(n.updatedAt, settings.adminTimeZone)}
                  </td>
                  <td>
                    <AdminForm action={retryNotificationAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <SubmitButton className="btn-secondary btn-sm" pendingLabel="Retrying…">
                        Retry now
                      </SubmitButton>
                    </AdminForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
