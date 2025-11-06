import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Auth callback route for Supabase email confirmation
 * Handles the OAuth callback after email verification
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = requestUrl.searchParams.get("redirect_to") || "/dashboard";

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    try {
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Auth callback error:", error);
        // Redirect to login with error message
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
        );
      }

      // Successful authentication - redirect to intended destination
      return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
    } catch (error) {
      console.error("Auth callback exception:", error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent("Authentication failed")}`, requestUrl.origin)
      );
    }
  }

  // No code parameter, redirect to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
