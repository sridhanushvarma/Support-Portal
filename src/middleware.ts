import { NextResponse, type NextRequest } from "next/server";

const REQUEST_ID = "x-request-id";
const VALID_ID = /^[A-Za-z0-9-]{8,64}$/;
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/setup"];

/**
 * Edge middleware: assigns a correlation ID to every request (FR-OPS-001) and
 * performs a cheap cookie-presence redirect for admin pages. This is a UX
 * convenience only; every admin page, action and API re-validates the session
 * and permissions on the server (FR-ADM-001/002).
 */
export function middleware(req: NextRequest) {
  const incoming = req.headers.get(REQUEST_ID);
  const requestId = incoming && VALID_ID.test(incoming) ? incoming : crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set(REQUEST_ID, requestId);

  const { pathname, search } = req.nextUrl;
  if (
    pathname.startsWith("/admin") &&
    !PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    const hasCookie = req.cookies.has("__Host-cw_session") || req.cookies.has("cw_session");
    if (!hasCookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      if (pathname !== "/admin") url.searchParams.set("next", `${pathname}${search}`.slice(0, 300));
      const res = NextResponse.redirect(url);
      res.headers.set(REQUEST_ID, requestId);
      return res;
    }
  }

  const res = NextResponse.next({ request: { headers } });
  res.headers.set(REQUEST_ID, requestId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
