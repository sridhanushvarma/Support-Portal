import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";
import { mediaUrl } from "@/lib/content/snapshots";
import { AdminForm, Field, SubmitButton } from "@/components/admin/form";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import { deleteMediaAction, updateAltAction, uploadMediaAction } from "./actions";

export const metadata: Metadata = { title: "Media library" };

export default async function MediaPage() {
  const user = await requireAdminPage();
  if (!user.permissions.has("media.upload") && !user.permissions.has("media.manage")) {
    const { redirect } = await import("next/navigation");
    redirect("/admin?denied=1");
  }
  const [assets, settings] = await Promise.all([
    prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    loadSettings(),
  ]);
  const canUpload = user.permissions.has("media.upload");
  const canDelete = user.permissions.has("media.manage");

  return (
    <>
      <PageHeader
        title="Media library"
        description="Images are checked, resized, converted to WebP and stripped of embedded metadata (such as location) on upload."
      />
      {canUpload && (
        <Panel title="Upload an image" className="mb-6">
          <AdminForm
            action={uploadMediaAction}
            resetOnSuccess
            className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
          >
            <div>
              <label htmlFor="file" className="field-label">
                Image file
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                className="input py-1.5"
              />
              <p className="field-hint">
                JPEG, PNG or WebP, up to 5 MB. Only use images you have rights to publish.
              </p>
            </div>
            <Field
              name="altText"
              label="Alternative text"
              required
              maxLength={250}
              hint="Describe what the image shows for people who cannot see it."
            />
            <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
          </AdminForm>
        </Panel>
      )}
      {assets.length === 0 ? (
        <EmptyState title="No images yet" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <li key={a.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of stored media */}
              <img
                src={mediaUrl(a.id)}
                alt={a.altText}
                width={a.width}
                height={a.height}
                loading="lazy"
                className="aspect-video w-full bg-surface object-contain"
              />
              <div className="space-y-3 p-4 text-sm">
                <p className="truncate font-medium" title={a.originalName}>
                  {a.originalName}
                </p>
                <p className="text-muted">
                  {a.width}×{a.height} · {Math.round(a.sizeBytes / 1024)} KB ·{" "}
                  {formatDate(a.createdAt, settings.adminTimeZone)}
                </p>
                {canUpload && (
                  <AdminForm action={updateAltAction} className="space-y-2">
                    <input type="hidden" name="id" value={a.id} />
                    <Field
                      id={`alt-${a.id}`}
                      name="altText"
                      label="Alternative text"
                      defaultValue={a.altText}
                      maxLength={250}
                    />
                    <SubmitButton className="btn-secondary btn-sm">Save alt text</SubmitButton>
                  </AdminForm>
                )}
                {canDelete && (
                  <AdminForm action={deleteMediaAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <SubmitButton
                      className="btn-sm text-danger hover:underline"
                      pendingLabel="Deleting…"
                    >
                      Delete image
                    </SubmitButton>
                  </AdminForm>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
