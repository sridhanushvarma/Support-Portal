import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { publicPath } from "@/lib/content/snapshots";
import { ContentList } from "@/components/admin/content-list";
import { Notice, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireAdminPage("content.edit");
  const sp = await searchParams;
  const [rows, settings] = await Promise.all([
    prisma.page.findMany({ orderBy: { title: "asc" } }),
    loadSettings(),
  ]);
  return (
    <>
      <PageHeader
        title="Pages"
        description="Home, About, Approach, legal and other standalone pages."
        actions={
          <Link href="/admin/pages/new" className="btn-primary btn-sm">
            New page
          </Link>
        }
      />
      {sp.deleted && (
        <div className="mb-4">
          <Notice tone="success">The draft was deleted.</Notice>
        </div>
      )}
      <ContentList
        base="/admin/pages"
        timeZone={settings.adminTimeZone}
        emptyText="No pages yet."
        rows={rows.map((r) => ({
          id: r.id,
          title: r.title,
          path: publicPath("page", r.slug),
          status: r.status,
          live: r.publishedSlug !== null,
          updatedAt: r.updatedAt,
          extra: r.showInFooter ? "Footer link" : undefined,
        }))}
      />
    </>
  );
}
