import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Initializes a user profile with the free tier after signup.
 * Uses the ensure_user_profile RPC function for reliable profile creation.
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

    // Call the RPC function to ensure profile exists
    const { data: result, error: rpcError } = await supabase
      .rpc('ensure_user_profile', { p_user_id: user.id });

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
    });
  } catch (error) {
    console.error("Failed to initialize profile:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
