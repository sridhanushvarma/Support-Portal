import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { publicPath } from "@/lib/content/snapshots";
import { ContentList } from "@/components/admin/content-list";
import { Notice, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireAdminPage("content.edit");
  const sp = await searchParams;
  const [rows, settings] = await Promise.all([
    prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    loadSettings(),
  ]);
  return (
    <>
      <PageHeader
        title="Services"
        description="The service pillars shown on the website. Order controls their position in menus and listings."
        actions={
          <Link href="/admin/services/new" className="btn-primary btn-sm">
            New service
          </Link>
        }
      />
      {sp.deleted && (
        <div className="mb-4">
          <Notice tone="success">The draft was deleted.</Notice>
        </div>
      )}
      <ContentList
        base="/admin/services"
        timeZone={settings.adminTimeZone}
        emptyText="No services yet."
        rows={rows.map((r) => ({
          id: r.id,
          title: r.name,
          path: publicPath("service", r.slug),
          status: r.status,
          live: r.publishedSlug !== null,
          updatedAt: r.updatedAt,
          extra: `Order ${r.sortOrder}`,
        }))}
      />
    </>
  );
}
