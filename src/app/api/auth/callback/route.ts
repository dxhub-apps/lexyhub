import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Auth callback route for Supabase email confirmation
 * Handles the OAuth callback after email verification
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const redirectTo = requestUrl.searchParams.get("redirect_to") || "/search";

    // Set Sentry context
    Sentry.setContext("auth_callback", {
      requestId,
      hasCode: !!code,
      redirectTo,
    });

    if (code) {
      const cookieStore = cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

      try {
        // Exchange the code for a session
        const { error, data } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          log.error("Auth callback error from Supabase", {
            error,
            requestId,
            errorMessage: error.message,
          });

          Sentry.captureException(error, {
            tags: {
              feature: "auth",
              component: "callback",
              errorType: "exchange-failed",
              requestId,
            },
            level: "error",
          });

          // Redirect to login with error message
          return NextResponse.redirect(
            new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
          );
        }

        // Set user context in Sentry for successful auth
        if (data.user) {
          Sentry.setUser({
            id: data.user.id,
            email: data.user.email,
          });
        }

        // Successful authentication - redirect to intended destination
        return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
      } catch (error) {
        log.error("Auth callback exception", {
          error,
          requestId,
        });

        Sentry.captureException(error, {
          tags: {
            feature: "auth",
            component: "callback",
            errorType: "unexpected-exception",
            requestId,
          },
          level: "error",
        });

        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent("Authentication failed")}`, requestUrl.origin)
        );
      }
    }

    // No code parameter, redirect to login
    log.info("Auth callback called without code parameter", { requestId });
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  } catch (error) {
    // Top-level error handler
    log.error("Unexpected error in auth callback", { error });

    Sentry.captureException(error, {
      tags: {
        feature: "auth",
        component: "callback",
        errorType: "top-level-error",
      },
      level: "fatal",
    });

    return NextResponse.redirect(
      new URL("/login?error=An unexpected error occurred", request.url)
    );
  }
}
