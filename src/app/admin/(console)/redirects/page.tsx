import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";
import { AdminForm, Field, Select, SubmitButton } from "@/components/admin/form";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import { createRedirectAction, toggleRedirectAction } from "./actions";

export const metadata: Metadata = { title: "Redirects" };

export default async function RedirectsPage() {
  await requireAdminPage("redirects.manage");
  const [rows, settings] = await Promise.all([
    prisma.redirect.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    loadSettings(),
  ]);
  return (
    <>
      <PageHeader
        title="Redirects"
        description="Keep old links working. Slug changes on published content create redirects automatically; add others here, for example for pages from a previous website."
      />
      <Panel title="Add a redirect" className="mb-6">
        <AdminForm
          action={createRedirectAction}
          resetOnSuccess
          className="grid gap-4 md:grid-cols-[1fr_1fr_12rem_auto] md:items-end"
        >
          <Field
            name="sourcePath"
            label="Old path"
            required
            placeholder="/old-page"
            maxLength={300}
          />
          <Field
            name="targetPath"
            label="New path"
            required
            placeholder="/services/erp-solutions"
            maxLength={300}
          />
          <Select
            name="statusCode"
            label="Type"
            defaultValue="308"
            options={[
              { value: "308", label: "Permanent (308)" },
              { value: "302", label: "Temporary (302)" },
            ]}
          />
          <SubmitButton>Save</SubmitButton>
        </AdminForm>
        <p className="mt-3 text-sm text-muted">
          Chains are flattened automatically and loops are rejected. Live content always takes
          priority over a redirect from the same path.
        </p>
      </Panel>
      {rows.length === 0 ? (
        <EmptyState title="No redirects" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Type</th>
                <th scope="col">Created</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.enabled ? "" : "opacity-60"}>
                  <td className="font-mono text-xs">{r.sourcePath}</td>
                  <td className="font-mono text-xs">{r.targetPath}</td>
                  <td>
                    {r.statusCode === 302 ? "Temporary" : "Permanent"}
                    {r.enabled ? "" : " (disabled)"}
                  </td>
                  <td className="whitespace-nowrap">
                    {formatDate(r.createdAt, settings.adminTimeZone)}
                  </td>
                  <td>
                    <AdminForm action={toggleRedirectAction} className="flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton
                        name="op"
                        value={r.enabled ? "disable" : "enable"}
                        className="btn-secondary btn-sm"
                      >
                        {r.enabled ? "Disable" : "Enable"}
                      </SubmitButton>
                      <SubmitButton
                        name="op"
                        value="delete"
                        className="btn-sm text-danger hover:underline"
                      >
                        Delete
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
