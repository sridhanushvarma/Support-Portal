import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/admin-auth";
import { listEnquiries, parseEnquiryFilters } from "@/lib/enquiries/admin";
import { requestIdFrom } from "@/lib/request-context";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireApiUser(req, "enquiries.read");
    const filters = parseEnquiryFilters(Object.fromEntries(new URL(req.url).searchParams));
    const result = await listEnquiries({ user, requestId: requestIdFrom(req.headers) }, filters);
    return NextResponse.json(
      {
        data: result.rows.map((r) => ({
          id: r.id,
          reference: r.reference,
          createdAt: r.createdAt,
          organisation: r.organisation,
          status: r.status,
          owner: r.assignedTo,
          services: r.serviceInterests.map((s) => s.serviceLabel),
        })),
        meta: { total: result.total, page: result.page, pageCount: result.pageCount },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}
