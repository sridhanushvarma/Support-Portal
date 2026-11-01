import Link from "next/link";
import type { ContentStatus } from "@prisma/client";
import type { Permission } from "@/lib/auth/permissions";
import { publishBlockers, type ContentKind } from "@/lib/content/admin";
import { publicPath } from "@/lib/content/snapshots";
import { ACTION_LABELS, allowedActions } from "@/lib/content/workflow";
import { formatDateTime } from "@/lib/format";
import { markReviewedAction, transitionAction } from "@/app/admin/(console)/content-actions";
import { AdminForm, Checkbox, Field, SubmitButton } from "./form";
import { ContentStatusBadge, Panel } from "./ui";

interface Item {
  id: string;
  slug: string;
  status: ContentStatus;
  publishedSlug: string | null;
  publishedAt: Date | null;
  reviewNote: string | null;
  lastReviewedAt: Date | null;
  hasUnpublishedChanges: boolean;
}

const BUTTON_CLASS: Record<string, string> = {
  publish: "btn-primary btn-sm",
  submit: "btn-primary btn-sm",
  delete: "btn-danger btn-sm",
};

/** Publication controls (FR-ADM-006/007). Only actions valid for the role and state are offered; the server re-checks. */
export async function WorkflowPanel({
  kind,
  item,
  permissions,
  timeZone,
}: {
  kind: ContentKind;
  item: Item;
  permissions: Set<Permission>;
  timeZone: string;
}) {
  const live = item.publishedSlug !== null;
  const actions = allowedActions(
    { status: item.status, isLive: live, everPublished: item.publishedAt !== null },
    permissions,
  );
  const blockers = actions.includes("publish") ? await publishBlockers(kind, item.id) : [];
  const destructive = actions.some((a) => a === "delete" || a === "archive" || a === "unpublish");
  const previewHref = `/admin/preview/${kind}/${item.id}`;

  return (
    <Panel title="Publication">
      <div className="space-y-3 text-sm">
        <ContentStatusBadge status={item.status} live={live} />
        {live && (
          <p>
            Live at{" "}
            <Link href={publicPath(kind, item.publishedSlug!)} className="link" target="_blank">
              {publicPath(kind, item.publishedSlug!)}
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
            {item.publishedAt && (
              <span className="block text-muted">
                Published {formatDateTime(item.publishedAt, timeZone)}
              </span>
            )}
          </p>
        )}
        {live && item.publishedSlug !== item.slug && (
          <p className="rounded-md bg-warning-soft p-2 text-warning">
            The URL will change to {publicPath(kind, item.slug)} when published. A permanent
            redirect from the old URL is created automatically.
          </p>
        )}
        {item.hasUnpublishedChanges && live && (
          <p className="text-warning">This draft has changes that are not yet public.</p>
        )}
        {item.reviewNote && item.status === "DRAFT" && (
          <p className="rounded-md border border-warning/30 bg-warning-soft p-2 text-warning">
            <strong>Returned by reviewer:</strong> {item.reviewNote}
          </p>
        )}
        <p>
          <Link href={previewHref} className="link" target="_blank">
            Preview this draft<span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </p>
      </div>

      {blockers.length > 0 && (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          <p className="font-semibold">Before publishing:</p>
          <ul className="mt-1 list-disc pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {actions.length > 0 && (
        <AdminForm action={transitionAction} className="mt-4 space-y-3">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={item.id} />
          {actions.includes("reject") && (
            <Field
              name="note"
              label="Note for the editor"
              rows={2}
              maxLength={1000}
              hint="Required when returning to draft."
            />
          )}
          {destructive && (
            <Checkbox
              name="confirm"
              label="Confirm unpublish, archive or delete"
              hint="Required for actions that remove content from the site."
            />
          )}
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <SubmitButton
                key={a}
                name="action"
                value={a}
                className={BUTTON_CLASS[a] ?? "btn-secondary btn-sm"}
                pendingLabel="Working…"
              >
                {ACTION_LABELS[a]}
              </SubmitButton>
            ))}
          </div>
        </AdminForm>
      )}

      {live && permissions.has("content.publish") && (
        <AdminForm action={markReviewedAction} className="mt-4 border-t border-line pt-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={item.id} />
          <p className="mb-2 text-sm text-muted">
            Last reviewed {formatDateTime(item.lastReviewedAt, timeZone)}
          </p>
          <SubmitButton className="btn-secondary btn-sm">Mark content as reviewed</SubmitButton>
        </AdminForm>
      )}
    </Panel>
  );
}
