import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/admin-auth";
import { transitionContent } from "@/lib/content/admin";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { requestIdFrom } from "@/lib/request-context";

export const dynamic = "force-dynamic";

const body = z.object({
  action: z.enum([
    "submit",
    "withdraw",
    "publish",
    "reject",
    "unpublish",
    "archive",
    "restore",
    "delete",
  ]),
  note: z.string().max(1000).optional(),
});

/** Workflow transition for a content item; role and state rules are enforced server-side (FR-ADM-006). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  try {
    const user = await requireApiUser(req, "content.edit");
    const { kind, id } = await params;
    if (!["page", "service", "project"].includes(kind) || !z.uuid().safeParse(id).success)
      throw NotFoundError();
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) throw ValidationError("Invalid action.");
    await transitionContent(
      { user, requestId: requestIdFrom(req.headers) },
      kind as "page" | "service" | "project",
      id,
      parsed.data.action,
      parsed.data.note,
    );
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return errorResponse(e, req);
  }
}
