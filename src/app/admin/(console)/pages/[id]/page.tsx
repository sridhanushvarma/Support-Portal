import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { LOCKED_PAGE_SLUGS } from "@/lib/content/admin";
import { pageContentSchema, type PageContent } from "@/lib/content/schemas";
import { AdminForm, Checkbox, Field, SubmitButton } from "@/components/admin/form";
import { ListEditor } from "@/components/admin/list-editor";
import { Notice, PageHeader, Panel } from "@/components/admin/ui";
import { WorkflowPanel } from "@/components/admin/workflow-panel";
import { savePageAction } from "../../content-actions";

export const metadata: Metadata = { title: "Edit page" };

export default async function PageEditor({
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
  const record = isNew ? null : await prisma.page.findUnique({ where: { id } });
  if (!isNew && !record) notFound();
  const settings = await loadSettings();
  const parsed = record ? pageContentSchema.safeParse(record.content) : null;
  const c: PageContent = parsed?.success
    ? parsed.data
    : { heroTitle: "", heroIntro: "", sections: [] };
  const locked = record ? LOCKED_PAGE_SLUGS.has(record.slug) : false;
  const archived = record?.status === "ARCHIVED";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/pages", label: "Pages" }}
        title={isNew ? "New page" : record!.title}
      />
      {sp.created && (
        <div className="mb-4">
          <Notice tone="success">Page created as a draft.</Notice>
        </div>
      )}
      {record?.slug === "privacy" && (
        <div className="mb-4">
          <Notice tone="warning">
            Privacy wording must be approved by your privacy or legal adviser. After publishing
            approved wording, update the policy version and approval flag in Site settings.
          </Notice>
        </div>
      )}
      {archived && (
        <div className="mb-4">
          <Notice tone="warning">This page is archived. Restore it to draft to edit.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <AdminForm action={savePageAction}>
          {record && <input type="hidden" name="id" value={record.id} />}
          {record && (
            <input
              type="hidden"
              name="expectedUpdatedAt"
              value={record.updatedAt.toISOString()}
              readOnly
            />
          )}
          {locked && <input type="hidden" name="slug" value={record!.slug} />}
          <Panel title="Basics">
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="title"
                  label="Page name"
                  required
                  defaultValue={record?.title}
                  maxLength={120}
                  hint="Used in menus, the footer and the admin area."
                />
                {locked ? (
                  <Field
                    name="slug-display"
                    label="URL slug"
                    defaultValue={record!.slug}
                    disabled
                    hint="This system page has a fixed URL."
                  />
                ) : (
                  <Field
                    name="slug"
                    label="URL slug"
                    defaultValue={record?.slug}
                    maxLength={80}
                    hint="Leave empty to generate from the name."
                  />
                )}
              </div>
              <Field
                name="heroTitle"
                label="Main heading"
                required
                defaultValue={c.heroTitle}
                maxLength={160}
              />
              <Field
                name="heroIntro"
                label="Introduction"
                rows={3}
                defaultValue={c.heroIntro}
                maxLength={800}
              />
              <Checkbox
                name="showInFooter"
                label="Link from the footer (legal section)"
                defaultChecked={record?.showInFooter}
              />
            </div>
          </Panel>
          <ListEditor
            name="sections"
            label="Sections"
            hint='Body text: separate paragraphs with a blank line. Items: one per line as "Title | Description".'
            max={20}
            initial={c.sections.map((s) => ({
              heading: s.heading,
              body: s.body,
              layout: s.layout,
              items: s.items
                .map((i) => (i.description ? `${i.title} | ${i.description}` : i.title))
                .join("\n"),
            }))}
            fields={[
              { key: "heading", label: "Heading", maxLength: 160 },
              { key: "body", label: "Body text", type: "textarea", maxLength: 8000 },
              {
                key: "layout",
                label: "Item layout",
                type: "select",
                options: [
                  { value: "text", label: "Text only" },
                  { value: "cards", label: "Cards" },
                  { value: "steps", label: "Numbered steps" },
                ],
              },
              {
                key: "items",
                label: "Items",
                type: "textarea",
                hint: 'One per line: "Title | Description"',
              },
            ]}
            addLabel="Add section"
          />
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
            </div>
          )}
        </AdminForm>
        {record && (
          <WorkflowPanel
            kind="page"
            item={record}
            permissions={user.permissions}
            timeZone={settings.adminTimeZone}
          />
        )}
      </div>
    </>
  );
}
