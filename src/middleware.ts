import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

import { fetchUserPlan, isAdminUser } from "@/lib/auth/admin";

const PUBLIC_PATHS = new Set(["/login", "/signup", "/api/auth"]);

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });
  const { pathname, searchParams } = request.nextUrl;

  const supabase = createMiddlewareClient({ req: request, res: response });

  // Use getUser() first for secure authentication validation
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Affiliate click capture (before other redirects so it works for logged-out visitors)
  const ref = searchParams.get("ref");
  if (ref) {
    // Set 90-day cookie
    response.cookies.set("aff_ref", JSON.stringify({ ref, ts: Date.now() }), {
      maxAge: 60 * 60 * 24 * 90, // 90 days
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    // Record click asynchronously (don't block request)
    const url = request.nextUrl;
    fetch(`${url.origin}/api/affiliate/click`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ref,
        path: pathname,
        utm: Object.fromEntries(searchParams),
      }),
    }).catch(() => {}); // Silently ignore errors

    // Redirect non-logged-in users to signup page
    // This ensures affiliate links always send new users to signup
    // Existing users are not counted as referrals
    if (!user && pathname !== "/signup") {
      const signupUrl = new URL("/signup", request.url);
      // Preserve all original query params including ref
      for (const [key, value] of searchParams.entries()) {
        signupUrl.searchParams.set(key, value);
      }
      return NextResponse.redirect(signupUrl);
    }
    // If user is already logged in, don't redirect - referral won't be counted
  }

  // Only get session after user is validated
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isPublicPath = Array.from(PUBLIC_PATHS).some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isStaticAsset = pathname.startsWith("/_next") || pathname.startsWith("/assets") || pathname.endsWith(".ico");
  const isApiRoute = pathname.startsWith("/api/") && !pathname.startsWith("/api/auth");

  if (!user && !isPublicPath && !isStaticAsset && !isApiRoute) {
    const redirectUrl = new URL("/login", request.url);
    const destination = `${pathname}${request.nextUrl.search}`;
    redirectUrl.searchParams.set("redirect_to", destination);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/search", request.url));
  }

  if (user && pathname.startsWith("/admin/backoffice")) {
    const { plan } = await fetchUserPlan(supabase, user.id);
    if (!isAdminUser(user, plan)) {
      return NextResponse.redirect(new URL("/search", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
