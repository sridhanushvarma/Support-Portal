import { NextResponse } from "next/server";
import { getPublishedService, getRelatedProjects } from "@/lib/content/public";
import { enforcePublicApiLimit, errorResponse } from "@/lib/api/http";
import { NotFoundError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await enforcePublicApiLimit(req);
    const { slug } = await params;
    const service = await getPublishedService(slug);
    if (!service) throw NotFoundError("Service not found.");
    const related = await getRelatedProjects(service.id, 6);
    const { id: _id, ...publicService } = service;
    return NextResponse.json(
      {
        data: {
          ...publicService,
          relatedProjects: related.map((p) => ({
            slug: p.slug,
            title: p.title,
            summary: p.summary,
            url: `/projects/${p.slug}`,
          })),
        },
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}
