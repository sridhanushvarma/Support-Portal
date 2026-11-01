import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/admin-auth";
import { enquiryUpdateSchema, getEnquiryDetail, updateEnquiry } from "@/lib/enquiries/admin";
import { ValidationError } from "@/lib/errors";
import { requestIdFrom } from "@/lib/request-context";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser(req, "enquiries.read");
    const { id } = await params;
    const e = await getEnquiryDetail({ user, requestId: requestIdFrom(req.headers) }, id);
    return NextResponse.json({ data: e }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e, req);
  }
}

/** Update status and/or owner. Body: { status?, assignedToId?, version }. 409 when `version` is stale. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireApiUser(req, "enquiries.update");
    const { id } = await params;
    const parsed = enquiryUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success)
      throw ValidationError(
        "Invalid update.",
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), [i.message]])),
      );
    const updated = await updateEnquiry(
      { user, requestId: requestIdFrom(req.headers) },
      id,
      parsed.data,
    );
    return NextResponse.json({
      data: {
        id: updated.id,
        status: updated.status,
        assignedToId: updated.assignedToId,
        version: updated.version,
      },
    });
  } catch (e) {
    return errorResponse(e, req);
  }
}
