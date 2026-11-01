import { NextResponse } from "next/server";
import { getPublishedProject } from "@/lib/content/public";
import { enforcePublicApiLimit, errorResponse } from "@/lib/api/http";
import { NotFoundError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await enforcePublicApiLimit(req);
    const { slug } = await params;
    const project = await getPublishedProject(slug);
    if (!project) throw NotFoundError("Project not found.");
    const { id: _id, ...data } = project;
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}
