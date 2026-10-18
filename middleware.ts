import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "project_docs_auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always allow static files, internal Next.js assets, auth API, invite routes, and public share links
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/api/invitations") ||
    pathname.startsWith("/share") ||
    pathname.startsWith("/api/share") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Handle preflight OPTIONS requests for API
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // 2. Check if valid authentication exists via Bearer token or cookie (standard 3-part JWT)
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.substring(7).trim()
    : null;
  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const token = bearerToken || cookieToken;
  const isAuthenticated = Boolean(token && token.split(".").length === 3);

  // 3. If unauthenticated and trying to access any page other than root (/), redirect to /
  if (!isAuthenticated && pathname !== "/") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
