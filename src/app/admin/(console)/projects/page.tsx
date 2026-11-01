import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { publicPath } from "@/lib/content/snapshots";
import { ContentList } from "@/components/admin/content-list";
import { Notice, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireAdminPage("content.edit");
  const sp = await searchParams;
  const [rows, settings] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ sortDate: "desc" }],
      include: { services: { include: { service: { select: { name: true } } } } },
    }),
    loadSettings(),
  ]);
  return (
    <>
      <PageHeader
        title="Projects and case studies"
        description="Only approved, accurate evidence may be published. Client names, results, testimonials and images need a publisher's evidence approval."
        actions={
          <Link href="/admin/projects/new" className="btn-primary btn-sm">
            New project
          </Link>
        }
      />
      {sp.deleted && (
        <div className="mb-4">
          <Notice tone="success">The draft was deleted.</Notice>
        </div>
      )}
      <ContentList
        base="/admin/projects"
        timeZone={settings.adminTimeZone}
        emptyText="No projects yet."
        rows={rows.map((r) => ({
          id: r.id,
          title: r.title,
          path: publicPath("project", r.slug),
          status: r.status,
          live: r.publishedSlug !== null,
          updatedAt: r.updatedAt,
          extra: [
            r.services.map((s) => s.service.name).join(", "),
            r.evidenceApprovedAt ? "Evidence approved" : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
      />
    </>
  );
}
