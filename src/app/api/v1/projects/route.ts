import { NextResponse } from "next/server";
import { getPublishedProjects } from "@/lib/content/public";
import { enforcePublicApiLimit, errorResponse } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/** Published projects with service filter and pagination (spec 11.1). */
export async function GET(req: Request) {
  try {
    await enforcePublicApiLimit(req);
    const url = new URL(req.url);
    const service = url.searchParams.get("service")?.slice(0, 80) || null;
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "12", 10) || 12),
    );
    const result = await getPublishedProjects({ serviceSlug: service, page, pageSize });
    return NextResponse.json(
      {
        data: result.items.map((p) => ({
          slug: p.slug,
          title: p.title,
          summary: p.summary,
          client: p.displayClient,
          services: p.services,
          thumbnail: p.thumbnail,
          url: `/projects/${p.slug}`,
        })),
        meta: {
          total: result.total,
          page: result.page,
          pageCount: result.pageCount,
          pageSize: result.pageSize,
        },
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}
