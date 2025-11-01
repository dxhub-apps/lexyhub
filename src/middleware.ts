import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

import { fetchUserPlan, isAdminUser } from "@/lib/auth/admin";

const PUBLIC_PATHS = new Set(["/login", "/api/auth"]);

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createMiddlewareClient({ req: request, res: response });
  const [sessionResult, userResult] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);

  const {
    data: { session },
  } = sessionResult;
  const {
    data: { user },
  } = userResult;

  const { pathname } = request.nextUrl;

  const isPublicPath = Array.from(PUBLIC_PATHS).some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isStaticAsset = pathname.startsWith("/_next") || pathname.startsWith("/assets") || pathname.endsWith(".ico");
  const isApiRoute = pathname.startsWith("/api/") && !pathname.startsWith("/api/auth");

  if (!user && !isPublicPath && !isStaticAsset && !isApiRoute) {
    const redirectUrl = new URL("/login", request.url);
    const destination = `${pathname}${request.nextUrl.search}`;
    redirectUrl.searchParams.set("redirect_to", destination);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && pathname.startsWith("/admin/backoffice")) {
    const { plan } = await fetchUserPlan(supabase, user.id);
    if (!isAdminUser(user, plan)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
