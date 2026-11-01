import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/admin-auth";
import { exportEnquiries, parseEnquiryFilters, type ExportColumn } from "@/lib/enquiries/admin";
import { isAppError } from "@/lib/errors";
import { requestIdFrom } from "@/lib/request-context";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** CSV download (FR-LEAD-007). POST only, same-origin, permission-checked and audited. */
export async function POST(req: Request) {
  const back = (message: string) =>
    NextResponse.redirect(
      new URL(`/admin/enquiries?exportError=${encodeURIComponent(message)}`, req.url),
      303,
    );
  try {
    const user = await requireApiUser(req, "enquiries.export");
    const fd = await req.formData();
    const filters = parseEnquiryFilters(
      Object.fromEntries(
        [...fd.entries()].filter(([k]) => k !== "columns").map(([k, v]) => [k, String(v)]),
      ),
    );
    const columns = fd.getAll("columns").map(String) as ExportColumn[];
    const { csv } = await exportEnquiries(
      { user, requestId: requestIdFrom(req.headers) },
      filters,
      columns,
    );
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    return new NextResponse(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="enquiries-${stamp}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (isAppError(e)) {
      if (e.status === 401) return NextResponse.redirect(new URL("/admin/login", req.url), 303);
      return back(e.message);
    }
    logger.error("export.failed", { error: e });
    return back("The export failed. Please try again.");
  }
}
