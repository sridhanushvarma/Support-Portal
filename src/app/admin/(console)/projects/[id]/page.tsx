import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import {
  projectContentSchema,
  projectHasEvidence,
  type ProjectContent,
} from "@/lib/content/schemas";
import { formatDateTime } from "@/lib/format";
import {
  AdminForm,
  Checkbox,
  Field,
  FormError,
  Select,
  SubmitButton,
} from "@/components/admin/form";
import { ListEditor } from "@/components/admin/list-editor";
import { Notice, PageHeader, Panel } from "@/components/admin/ui";
import { WorkflowPanel } from "@/components/admin/workflow-panel";
import { approveEvidenceAction, saveProjectAction } from "../../content-actions";

export const metadata: Metadata = { title: "Edit project" };

export default async function ProjectEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireAdminPage("content.edit");
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const record = isNew
    ? null
    : await prisma.project.findUnique({ where: { id }, include: { services: true } });
  if (!isNew && !record) notFound();
  const [settings, services, media, approver] = await Promise.all([
    loadSettings(),
    prisma.service.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, status: true },
    }),
    prisma.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, originalName: true, altText: true },
      take: 500,
    }),
    record?.evidenceApprovedById
      ? prisma.adminUser.findUnique({
          where: { id: record.evidenceApprovedById },
          select: { displayName: true },
        })
      : null,
  ]);
  const parsed = record ? projectContentSchema.safeParse(record.content) : null;
  const c: ProjectContent = parsed?.success ? parsed.data : projectContentSchema.parse({});
  const selected = new Set(record?.services.map((s) => s.serviceId) ?? []);
  const mediaOptions = [
    { value: "", label: "No image" },
    ...media.map((m) => ({ value: m.id, label: `${m.originalName} — ${m.altText.slice(0, 50)}` })),
  ];
  const archived = record?.status === "ARCHIVED";
  const needsEvidence = projectHasEvidence(c);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/projects", label: "Projects" }}
        title={isNew ? "New project" : record!.title}
      />
      {sp.created && (
        <div className="mb-4">
          <Notice tone="success">Project created as a draft.</Notice>
        </div>
      )}
      {archived && (
        <div className="mb-4">
          <Notice tone="warning">This project is archived. Restore it to draft to edit.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <AdminForm action={saveProjectAction}>
          {record && <input type="hidden" name="id" value={record.id} />}
          {record && (
            <input
              type="hidden"
              name="expectedUpdatedAt"
              value={record.updatedAt.toISOString()}
              readOnly
            />
          )}
          <Panel title="Basics">
            <div className="grid gap-4">
              <Field
                name="title"
                label="Title"
                required
                defaultValue={record?.title}
                maxLength={160}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="slug"
                  label="URL slug"
                  defaultValue={record?.slug}
                  maxLength={80}
                  hint="Leave empty to generate from the title."
                />
                <Field
                  name="sortDate"
                  label="Project date (for ordering)"
                  type="date"
                  defaultValue={(record?.sortDate ?? new Date()).toISOString().slice(0, 10)}
                />
              </div>
              <Field
                name="summary"
                label="Summary"
                required
                rows={3}
                defaultValue={record?.summary}
                maxLength={400}
                hint="Shown on project cards and at the top of the case study."
              />
              <fieldset>
                <legend className="field-label">Services</legend>
                <p className="field-hint -mt-1 mb-2">
                  Used for portfolio filters and related-project lists.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {services.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="serviceIds"
                        value={s.id}
                        defaultChecked={selected.has(s.id)}
                        className="h-4 w-4 accent-[var(--color-brand)]"
                      />
                      {s.name}
                      {s.status === "ARCHIVED" ? " (archived)" : ""}
                    </label>
                  ))}
                </div>
                <FormError name="serviceIds" />
              </fieldset>
              <Checkbox
                name="featured"
                label="Feature on the home page"
                defaultChecked={record?.featured}
              />
            </div>
          </Panel>

          <Panel title="Client and permissions">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="clientName"
                label="Client name"
                defaultValue={c.clientName}
                maxLength={120}
                hint="Leave empty to keep the client anonymous."
              />
              <Field
                name="anonymisedLabel"
                label="Anonymised description"
                defaultValue={c.anonymisedLabel}
                maxLength={120}
                hint='Shown when the client is not named, e.g. "Regional logistics provider".'
              />
              <Select
                name="clientPermission"
                label="Client permission"
                defaultValue={record?.clientPermission ?? "NOT_REQUIRED"}
                hint="Granted means written permission to name the client and use the supplied material is on file."
                options={[
                  { value: "NOT_REQUIRED", label: "Not required (anonymised)" },
                  { value: "PENDING", label: "Pending" },
                  { value: "GRANTED", label: "Granted" },
                ]}
              />
              <Field name="industry" label="Industry" defaultValue={c.industry} maxLength={80} />
              <Field
                name="engagement"
                label="Engagement type"
                defaultValue={c.engagement}
                maxLength={80}
              />
              <Field name="duration" label="Duration" defaultValue={c.duration} maxLength={40} />
            </div>
          </Panel>

          <Panel title="Case study">
            <p className="mb-4 text-sm text-muted">
              All sections are optional; empty sections are hidden on the website. Separate
              paragraphs with a blank line.
            </p>
            <div className="grid gap-4">
              <Field
                name="context"
                label="Context"
                rows={4}
                defaultValue={c.context}
                maxLength={4000}
              />
              <Field
                name="challenge"
                label="Challenge"
                rows={4}
                defaultValue={c.challenge}
                maxLength={4000}
              />
              <Field
                name="approach"
                label="Approach"
                rows={4}
                defaultValue={c.approach}
                maxLength={4000}
              />
              <Field
                name="solution"
                label="Solution"
                rows={4}
                defaultValue={c.solution}
                maxLength={4000}
              />
              <Field
                name="contribution"
                label="Our contribution"
                rows={3}
                defaultValue={c.contribution}
                maxLength={3000}
              />
              <Field
                name="technologies"
                label="Technologies"
                rows={3}
                defaultValue={c.technologies.join("\n")}
                hint="One per line."
              />
            </div>
          </Panel>

          <ListEditor
            name="outcomes"
            label="Results"
            hint="Only measured, substantiated results. Every result requires evidence approval before publication."
            initial={c.outcomes}
            max={10}
            fields={[
              { key: "label", label: "What was measured", maxLength: 120 },
              { key: "value", label: "Value (e.g. 30% faster)", maxLength: 60 },
              { key: "description", label: "Context", type: "textarea", maxLength: 300 },
            ]}
            addLabel="Add result"
          />

          <Panel title="Testimonial">
            <div className="grid gap-4">
              <Field
                name="testimonialQuote"
                label="Quote"
                rows={3}
                defaultValue={c.testimonial.quote}
                maxLength={1000}
                hint="Use the approved wording exactly. Requires evidence approval."
              />
              <Field
                name="testimonialAttribution"
                label="Attribution"
                defaultValue={c.testimonial.attribution}
                maxLength={160}
                hint='e.g. "Operations Director, regional distributor".'
              />
            </div>
          </Panel>

          <Panel title="Images">
            <div className="grid gap-4">
              <Select
                name="thumbnailId"
                label="Main image"
                options={mediaOptions}
                defaultValue={record?.thumbnailId ?? ""}
                hint="Upload images in the media library first. Alt text is managed there."
              />
            </div>
            <div className="mt-4">
              <ListEditor
                name="gallery"
                label="Gallery"
                initial={c.gallery.map((g) => ({ mediaId: g.mediaId, caption: g.caption }))}
                max={8}
                fields={[
                  {
                    key: "mediaId",
                    label: "Image",
                    type: "select",
                    options: mediaOptions.slice(1),
                  },
                  { key: "caption", label: "Caption", maxLength: 200 },
                ]}
                addLabel="Add image"
              />
            </div>
            <p className="mt-3 text-sm">
              <Link href="/admin/media" className="link">
                Open media library
              </Link>
            </p>
          </Panel>

          <Panel title="Search and sharing">
            <div className="grid gap-4">
              <Field
                name="seoTitle"
                label="SEO title"
                defaultValue={record?.seoTitle}
                maxLength={70}
              />
              <Field
                name="seoDescription"
                label="SEO description"
                rows={2}
                defaultValue={record?.seoDescription}
                maxLength={170}
                hint="Required before publishing."
              />
            </div>
          </Panel>

          {!archived && (
            <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-line bg-surface/95 py-3 backdrop-blur">
              <SubmitButton>{isNew ? "Create draft" : "Save draft"}</SubmitButton>
              <span className="text-sm text-muted">
                Changing evidence clears any existing approval.
              </span>
            </div>
          )}
        </AdminForm>

        {record && (
          <div className="space-y-6">
            <WorkflowPanel
              kind="project"
              item={record}
              permissions={user.permissions}
              timeZone={settings.adminTimeZone}
            />
            <Panel title="Evidence approval">
              {record.evidenceApprovedAt ? (
                <div className="text-sm">
                  <p className="font-semibold text-success">
                    Approved {formatDateTime(record.evidenceApprovedAt, settings.adminTimeZone)}
                    {approver ? ` by ${approver.displayName}` : ""}
                  </p>
                  {record.evidenceNote && (
                    <p className="mt-2 text-ink-soft">{record.evidenceNote}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {needsEvidence
                    ? "Not approved. Required before publishing because this project names a client or includes results, a testimonial or images."
                    : "Not needed while the project contains no client name, results, testimonial or images."}
                </p>
              )}
              {user.permissions.has("content.approve_evidence") &&
                needsEvidence &&
                !record.evidenceApprovedAt && (
                  <AdminForm action={approveEvidenceAction} className="mt-4 space-y-3">
                    <input type="hidden" name="id" value={record.id} />
                    <input
                      type="hidden"
                      name="expectedUpdatedAt"
                      value={record.updatedAt.toISOString()}
                      readOnly
                    />
                    <Field
                      name="evidenceNote"
                      label="What did you verify?"
                      rows={3}
                      maxLength={1000}
                      required
                      hint="e.g. signed permission letter on file, metrics confirmed with client report."
                    />
                    <Checkbox
                      name="confirm"
                      label="I confirm the client permission, results and quotes are accurate and approved"
                    />
                    <SubmitButton className="btn-primary btn-sm">Record approval</SubmitButton>
                  </AdminForm>
                )}
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
