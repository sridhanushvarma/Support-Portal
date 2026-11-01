import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/admin-auth";
import { activitySchema, addEnquiryActivity } from "@/lib/enquiries/admin";
import { ValidationError } from "@/lib/errors";
import { requestIdFrom } from "@/lib/request-context";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(req, "enquiries.update");
    const { id } = await params;
    const parsed = activitySchema.safeParse(await readJson(req));
    if (!parsed.success)
      throw ValidationError(
        "Invalid activity.",
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), [i.message]])),
      );
    await addEnquiryActivity({ user, requestId: requestIdFrom(req.headers) }, id, parsed.data);
    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  } catch (e) {
    return errorResponse(e, req);
  }
}
