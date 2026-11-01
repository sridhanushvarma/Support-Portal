import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import {
  buildPageSnapshot,
  buildProjectSnapshot,
  buildServiceSnapshot,
  projectMediaIds,
} from "@/lib/content/snapshots";
import { CtaBand, PageHero, PageSections } from "@/components/site/blocks";
import { ServiceDetail } from "@/components/site/service-detail";
import { ProjectDetail } from "@/components/site/project-detail";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/**
 * Authenticated draft preview (FR-ADM-007, BR-13). Lives under /admin so it is
 * session-protected, non-indexable and never cached publicly.
 */
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  await requireAdminPage("content.edit");
  const { kind, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const settings = await loadSettings();
  let body: React.ReactNode;

  if (kind === "service") {
    const s = await prisma.service.findUnique({ where: { id } });
    if (!s) notFound();
    body = (
      <ServiceDetail service={buildServiceSnapshot(s)} related={[]} settings={settings} preview />
    );
  } else if (kind === "project") {
    const p = await prisma.project.findUnique({
      where: { id },
      include: { services: { include: { service: true } } },
    });
    if (!p) notFound();
    const media = await prisma.mediaAsset.findMany({ where: { id: { in: projectMediaIds(p) } } });
    const snapshot = buildProjectSnapshot(p, new Map(media.map((m) => [m.id, m])));
    body = (
      <ProjectDetail
        project={{
          ...snapshot,
          services: p.services.map((s) => ({ slug: s.service.slug, name: s.service.name })),
        }}
        settings={settings}
      />
    );
  } else if (kind === "page") {
    const pg = await prisma.page.findUnique({ where: { id } });
    if (!pg) notFound();
    const snap = buildPageSnapshot(pg);
    body = (
      <>
        <PageHero title={snap.content.heroTitle} intro={snap.content.heroIntro} />
        <PageSections sections={snap.content.sections} />
        <CtaBand
          heading="Call to action"
          text={settings.responseExpectation}
          label={settings.primaryCtaLabel}
          href="#"
          location="preview"
        />
      </>
    );
  } else notFound();

  return (
    <div className="bg-white">
      <div
        role="status"
        className="sticky top-0 z-50 bg-warning px-5 py-2.5 text-center text-sm font-semibold text-white"
      >
        Preview of the current draft. This is not visible to the public.
      </div>
      {body}
    </div>
  );
}
