import { NextResponse } from "next/server";
import { getPublishedServices } from "@/lib/content/public";
import { enforcePublicApiLimit, errorResponse } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/** Published service summaries in display order (spec 11.1). */
export async function GET(req: Request) {
  try {
    await enforcePublicApiLimit(req);
    const services = await getPublishedServices();
    return NextResponse.json(
      {
        data: services.map((s) => ({
          slug: s.slug,
          name: s.name,
          headline: s.content.headline,
          summary: s.content.summary,
          url: `/services/${s.slug}`,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}
