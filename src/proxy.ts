import { NextResponse, type NextRequest } from "next/server";

/**
 * Everything is for members: without a session cookie, pages send you to the log-in page (which
 * sends you back afterwards). Whether the session is still good is checked by the pages themselves.
 */
const OPEN = [/^\/login$/, /^\/setup$/, /^\/signup$/, /^\/invite\//, /^\/reset\//, /^\/forgot$/, /^\/mail\//, /^\/api\/mail\//, /^\/api\/health$/, /^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/icons\//, /^\/media\/bg\//, /^\/media\/logo\//, /^\/offline$/, /^\/cal\//, /^\/api\/dev\//];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (OPEN.some((r) => r.test(pathname))) return NextResponse.next();
  if (req.cookies.has("hd_session")) return NextResponse.next();
  if (pathname.startsWith("/api/") || pathname.startsWith("/media/")) return new NextResponse("Log in first", { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt).*)"],
};
