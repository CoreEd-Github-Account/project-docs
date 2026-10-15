import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "project_docs_auth";
const AUTH_TOKEN_VALUE = "valid_session_taha_docs_2026";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always allow static files, internal Next.js assets, and auth API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Check if valid authentication cookie exists
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = token === AUTH_TOKEN_VALUE;

  // 3. If unauthenticated and trying to access any page other than root (/), redirect to /
  if (!isAuthenticated && pathname !== "/") {
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
