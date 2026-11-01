import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guard";
import { isAppError } from "@/lib/errors";
import { loadSettings } from "@/lib/settings";
import { assignableUsers, getEnquiryDetail } from "@/lib/enquiries/admin";
import { BUDGETS, labelFor, TIMELINES } from "@/lib/enquiries/schema";
import { STATUS_LABELS, STATUS_TRANSITIONS } from "@/lib/enquiries/status";
import { formatDateTime, humanize } from "@/lib/format";
import { EnquiryStatusBadge, Notice, PageHeader, Panel } from "@/components/admin/ui";
import { AdminForm, Checkbox, Field, Select, SubmitButton } from "@/components/admin/form";
import { addActivityAction, removePersonalDataAction, updateEnquiryAction } from "../actions";

export const metadata: Metadata = { title: "Enquiry" };

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPage("enquiries.read");
  const { id } = await params;
  const enquiry = await getEnquiryDetail({ user }, id).catch((e) => {
    if (isAppError(e) && e.status === 404) notFound();
    throw e;
  });
  const [owners, settings] = await Promise.all([assignableUsers(), loadSettings()]);
  const tz = settings.adminTimeZone;
  const canUpdate = user.permissions.has("enquiries.update") && !enquiry.anonymisedAt;
  const canDelete = user.permissions.has("enquiries.delete");
  const statusOptions = [enquiry.status, ...STATUS_TRANSITIONS[enquiry.status]].map((s) => ({
    value: s,
    label: s === enquiry.status ? `${STATUS_LABELS[s]} (current)` : STATUS_LABELS[s],
  }));
  const ownerOptions = [
    { value: "", label: "Unassigned" },
    ...owners.map((o) => ({ value: o.id, label: o.displayName })),
  ];
  if (enquiry.assignedTo && !owners.some((o) => o.id === enquiry.assignedTo!.id))
    ownerOptions.push({
      value: enquiry.assignedTo.id,
      label: `${enquiry.assignedTo.displayName} (inactive)`,
    });

  const details: [string, React.ReactNode][] = [
    ["Name", enquiry.name],
    [
      "Email",
      enquiry.anonymisedAt ? (
        "—"
      ) : (
        <a className="link" href={`mailto:${enquiry.email}`}>
          {enquiry.email}
        </a>
      ),
    ],
    ["Organisation", enquiry.organisation],
    ["Phone", enquiry.phone ?? "—"],
    ["Country", enquiry.country ?? "—"],
    ["Services", enquiry.serviceInterests.map((s) => s.serviceLabel).join(", ") || "—"],
    ["Timeline", labelFor(TIMELINES, enquiry.timeline) || "—"],
    ["Budget", labelFor(BUDGETS, enquiry.budgetRange) || "—"],
    ["Preferred contact", humanize(enquiry.contactPreference)],
  ];
  const source: [string, string | null][] = [
    ["Came from page", enquiry.sourcePath],
    ["Service page", enquiry.sourceService],
    ["Referrer", enquiry.referrerHost],
    ["Campaign source", enquiry.utmSource],
    ["Campaign medium", enquiry.utmMedium],
    ["Campaign", enquiry.utmCampaign],
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/enquiries", label: "All enquiries" }}
        title={enquiry.reference}
        description={`Received ${formatDateTime(enquiry.createdAt, tz)}${enquiry.firstResponseAt ? ` · first response ${formatDateTime(enquiry.firstResponseAt, tz)}` : ""}`}
        actions={<EnquiryStatusBadge status={enquiry.status} />}
      />
      {enquiry.anonymisedAt && (
        <div className="mb-6">
          <Notice tone="warning">
            Personal data was removed on {formatDateTime(enquiry.anonymisedAt, tz)}. Aggregate
            details are kept for reporting.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Submitted details">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="font-medium break-words text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-6 text-sm text-muted">Project summary</h3>
            <p className="mt-1 rounded-lg bg-surface p-4 leading-relaxed whitespace-pre-wrap break-words text-ink">
              {enquiry.projectSummary}
            </p>
          </Panel>

          <Panel title="Activity">
            {canUpdate && (
              <AdminForm action={addActivityAction} resetOnSuccess className="mb-6 space-y-3">
                <input type="hidden" name="id" value={enquiry.id} />
                <Field
                  name="body"
                  label="Add an internal note"
                  rows={3}
                  maxLength={5000}
                  hint="Internal only. Never shown publicly or sent to the submitter."
                />
                <div className="flex flex-wrap gap-2">
                  <SubmitButton name="type" value="note" className="btn-primary btn-sm">
                    Add note
                  </SubmitButton>
                  <SubmitButton name="type" value="follow_up" className="btn-secondary btn-sm">
                    Record follow-up contact
                  </SubmitButton>
                </div>
              </AdminForm>
            )}
            <ol className="space-y-4">
              {enquiry.activities.map((a) => (
                <li key={a.id} className="border-l-2 border-line pl-4">
                  <p className="text-xs text-muted">
                    {formatDateTime(a.createdAt, tz)} · {a.actor?.displayName ?? "System"}
                    {a.type !== "system" ? ` · ${humanize(a.type)}` : ""}
                  </p>
                  {a.type === "status_change" &&
                  a.metadata &&
                  typeof a.metadata === "object" &&
                  "to" in a.metadata ? (
                    <p className="mt-1 text-sm">
                      Status changed from{" "}
                      {STATUS_LABELS[(a.metadata as { from: keyof typeof STATUS_LABELS }).from]} to{" "}
                      {STATUS_LABELS[(a.metadata as { to: keyof typeof STATUS_LABELS }).to]}
                    </p>
                  ) : (
                    a.body && (
                      <p className="mt-1 text-sm whitespace-pre-wrap break-words text-ink">
                        {a.body}
                      </p>
                    )
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          {canUpdate && (
            <Panel title="Manage">
              <AdminForm action={updateEnquiryAction} className="space-y-4">
                <input type="hidden" name="id" value={enquiry.id} />
                <input type="hidden" name="version" value={enquiry.version} readOnly />
                <Select
                  name="status"
                  label="Status"
                  options={statusOptions}
                  defaultValue={enquiry.status}
                />
                <Select
                  name="assignedToId"
                  label="Owner"
                  options={ownerOptions}
                  defaultValue={enquiry.assignedToId ?? ""}
                />
                <SubmitButton className="btn-primary btn-sm w-full">Save changes</SubmitButton>
              </AdminForm>
            </Panel>
          )}

          <Panel title="Source">
            <dl className="space-y-2 text-sm">
              {source
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted">{k}</dt>
                    <dd className="break-words">{v}</dd>
                  </div>
                ))}
              {source.every(([, v]) => !v) && (
                <p className="text-muted">No attribution recorded.</p>
              )}
            </dl>
          </Panel>

          <Panel title="Consent">
            <ul className="space-y-2 text-sm">
              {enquiry.consents.map((c) => (
                <li key={c.id}>
                  {humanize(c.purpose)}: <strong>{c.choice ? "yes" : "no"}</strong>
                  <span className="block text-xs text-muted">
                    Policy version {c.policyVersion} · {formatDateTime(c.createdAt, tz)} ·{" "}
                    {humanize(c.captureSource)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Notifications">
            {enquiry.notifications.length === 0 ? (
              <p className="text-sm text-muted">
                No notifications were queued. Check the recipients in Site settings.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {enquiry.notifications.map((n) => (
                  <li key={n.id}>
                    {n.kind === "enquiry_ack"
                      ? "Acknowledgement to submitter"
                      : n.kind === "enquiry_internal"
                        ? "Team notification"
                        : "Operations alert"}
                    :{" "}
                    <strong
                      className={n.status === "DEAD" || n.status === "FAILED" ? "text-danger" : ""}
                    >
                      {humanize(n.status)}
                    </strong>
                    {n.attempts > 0 && (
                      <span className="text-muted">
                        {" "}
                        ({n.attempts} attempt{n.attempts === 1 ? "" : "s"})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {canDelete && (
            <Panel title="Remove personal data" className="border-danger/30">
              <AdminForm action={removePersonalDataAction} className="space-y-3">
                <input type="hidden" name="id" value={enquiry.id} />
                <p className="text-sm text-muted">
                  Use for erasure requests or when the data is no longer needed. Anonymising keeps
                  aggregate reporting; deleting removes the record entirely. Both are audited and
                  cannot be undone.
                </p>
                <Field name="reason" label="Reason" required maxLength={200} />
                <Checkbox name="confirm" label="I understand this cannot be undone" />
                <div className="flex flex-wrap gap-2">
                  {!enquiry.anonymisedAt && (
                    <SubmitButton
                      name="mode"
                      value="anonymise"
                      className="btn-secondary btn-sm"
                      pendingLabel="Working…"
                    >
                      Anonymise
                    </SubmitButton>
                  )}
                  <SubmitButton
                    name="mode"
                    value="delete"
                    className="btn-danger btn-sm"
                    pendingLabel="Working…"
                  >
                    Delete permanently
                  </SubmitButton>
                </div>
              </AdminForm>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
