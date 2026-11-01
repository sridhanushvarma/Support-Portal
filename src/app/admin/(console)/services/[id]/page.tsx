import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { serviceContentSchema, type ServiceContent } from "@/lib/content/schemas";
import { AdminForm, Field, SubmitButton } from "@/components/admin/form";
import { ListEditor } from "@/components/admin/list-editor";
import { Notice, PageHeader, Panel } from "@/components/admin/ui";
import { WorkflowPanel } from "@/components/admin/workflow-panel";
import { saveServiceAction } from "../../content-actions";

export const metadata: Metadata = { title: "Edit service" };

const EMPTY: ServiceContent = serviceContentSchema.parse({
  headline: "New service",
  summary: "Summary",
});

export default async function ServiceEditor({
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
  const record = isNew ? null : await prisma.service.findUnique({ where: { id } });
  if (!isNew && !record) notFound();
  const settings = await loadSettings();
  const parsed = record ? serviceContentSchema.safeParse(record.content) : null;
  const c: ServiceContent = parsed?.success
    ? parsed.data
    : isNew
      ? { ...EMPTY, headline: "", summary: "" }
      : EMPTY;
  const archived = record?.status === "ARCHIVED";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/services", label: "Services" }}
        title={isNew ? "New service" : record!.name}
      />
      {sp.created && (
        <div className="mb-4">
          <Notice tone="success">Service created as a draft.</Notice>
        </div>
      )}
      {archived && (
        <div className="mb-4">
          <Notice tone="warning">This service is archived. Restore it to draft to edit.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <AdminForm action={saveServiceAction}>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="name"
                label="Service name"
                required
                defaultValue={record?.name}
                maxLength={120}
              />
              <Field
                name="slug"
                label="URL slug"
                defaultValue={record?.slug}
                maxLength={80}
                hint="Leave empty to generate from the name. Lower-case letters, numbers and hyphens."
              />
              <Field
                name="sortOrder"
                label="Display order"
                type="number"
                defaultValue={record?.sortOrder ?? 10}
              />
            </div>
            <div className="mt-4 grid gap-4">
              <Field
                name="headline"
                label="Headline"
                required
                defaultValue={c.headline}
                maxLength={160}
                hint="Concise value proposition shown as the page heading."
              />
              <Field
                name="summary"
                label="Summary"
                required
                rows={3}
                defaultValue={c.summary}
                maxLength={400}
                hint="Used on service cards and as the page introduction."
              />
              <Field
                name="intro"
                label="Problem framing"
                rows={5}
                defaultValue={c.intro}
                maxLength={1500}
                hint="Explain the business problem in plain language. Separate paragraphs with a blank line."
              />
              <Field
                name="audiences"
                label="Who it is for"
                rows={3}
                defaultValue={c.audiences.join("\n")}
                hint="One audience per line."
              />
              <Field
                name="problems"
                label="Problems and symptoms"
                rows={5}
                defaultValue={c.problems.join("\n")}
                hint="One per line."
              />
            </div>
          </Panel>

          <ListEditor
            name="capabilities"
            label="Capabilities"
            initial={c.capabilities}
            fields={[
              { key: "title", label: "Title", maxLength: 120 },
              { key: "description", label: "Description", type: "textarea", maxLength: 800 },
            ]}
            addLabel="Add capability"
          />
          <ListEditor
            name="outcomes"
            label="Business outcomes"
            hint="Outcomes are labelled illustrative on the site unless marked verified. Verified outcomes need an evidence note and are checked by a publisher. Never include unsupported numbers."
            initial={c.outcomes}
            max={10}
            fields={[
              { key: "text", label: "Outcome", maxLength: 300 },
              {
                key: "evidence",
                label: "Evidence",
                type: "select",
                options: [
                  { value: "illustrative", label: "Illustrative (typical aim)" },
                  { value: "verified", label: "Verified (evidence on file)" },
                ],
              },
              {
                key: "evidenceNote",
                label: "Evidence note (internal)",
                maxLength: 500,
                hint: "Where the evidence is held and who approved it. Not shown publicly.",
              },
            ]}
            addLabel="Add outcome"
          />
          <ListEditor
            name="deliveryApproach"
            label="Delivery approach"
            initial={c.deliveryApproach}
            max={10}
            fields={[
              { key: "title", label: "Step", maxLength: 120 },
              { key: "description", label: "Description", type: "textarea", maxLength: 800 },
            ]}
            addLabel="Add step"
          />
          <Panel title="Technology">
            <Field
              name="technologies"
              label="Technologies and integrations"
              rows={4}
              defaultValue={c.technologies.join("\n")}
              hint="One per line. Only list technologies you can genuinely support."
            />
          </Panel>
          <ListEditor
            name="faqs"
            label="Frequently asked questions"
            initial={c.faqs}
            fields={[
              { key: "question", label: "Question", maxLength: 200 },
              { key: "answer", label: "Answer", type: "textarea", maxLength: 1500 },
            ]}
            addLabel="Add question"
          />

          <Panel title="Call to action">
            <div className="grid gap-4">
              <Field
                name="ctaHeading"
                label="Heading"
                defaultValue={c.ctaHeading}
                maxLength={160}
              />
              <Field
                name="ctaText"
                label="Supporting text"
                rows={2}
                defaultValue={c.ctaText}
                maxLength={400}
              />
              <Field
                name="ctaLabel"
                label="Button label"
                defaultValue={c.ctaLabel}
                maxLength={40}
                hint={`Defaults to "${settings.primaryCtaLabel}".`}
              />
            </div>
          </Panel>
          <Panel title="Search and sharing">
            <div className="grid gap-4">
              <Field
                name="seoTitle"
                label="SEO title"
                defaultValue={record?.seoTitle}
                maxLength={70}
                hint="Up to 70 characters. Defaults to the service name."
              />
              <Field
                name="seoDescription"
                label="SEO description"
                rows={2}
                defaultValue={record?.seoDescription}
                maxLength={170}
                hint="Up to 170 characters. Required before publishing."
              />
            </div>
          </Panel>
          {!archived && (
            <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 border-t border-line bg-surface/95 px-1 py-3 backdrop-blur">
              <SubmitButton>{isNew ? "Create draft" : "Save draft"}</SubmitButton>
              <span className="text-sm text-muted">Saving never changes the public site.</span>
            </div>
          )}
        </AdminForm>
        {record && (
          <div className="space-y-6">
            <WorkflowPanel
              kind="service"
              item={record}
              permissions={user.permissions}
              timeZone={settings.adminTimeZone}
            />
          </div>
        )}
      </div>
    </>
  );
}
