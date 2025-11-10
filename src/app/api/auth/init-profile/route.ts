import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Initializes a user profile with the free tier after signup.
 * Uses the ensure_user_profile RPC function for reliable profile creation.
 *
 * Supports signup_source tracking for extension users (bonus quota)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get the current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("Init-profile called without authentication.");
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Parse request body for optional signup_source
    let signupSource = "web"; // Default
    try {
      const body = await request.json();
      if (body.signup_source && typeof body.signup_source === "string") {
        const validSources = ["web", "extension", "mobile", "api", "referral"];
        if (validSources.includes(body.signup_source)) {
          signupSource = body.signup_source;
        }
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Call the RPC function to ensure profile exists
    const { data: result, error: rpcError } = await supabase
      .rpc('ensure_user_profile', {
        p_user_id: user.id,
        p_signup_source: signupSource
      });

    if (rpcError) {
      console.error("Failed to ensure user profile via RPC:", rpcError);
      return NextResponse.json(
        { error: "Failed to create profile", details: rpcError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: result.exists ? "Profile already exists" : "Profile created successfully",
      plan: result.plan || "free",
      created: result.created || false,
      signup_source: signupSource,
    });
  } catch (error) {
    console.error("Failed to initialize profile:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
