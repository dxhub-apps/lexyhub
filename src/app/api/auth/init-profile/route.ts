import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Initializes a user profile with the free tier after signup.
 * Should be called once when a new user registers.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get the current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("user_id, plan")
      .eq("user_id", user.id)
      .single();

    if (existingProfile) {
      return NextResponse.json({
        ok: true,
        message: "Profile already exists",
        plan: existingProfile.plan,
      });
    }

    // Create new profile with free tier
    const { error: insertError } = await supabase
      .from("user_profiles")
      .insert({
        user_id: user.id,
        plan: "free",
        momentum: "new",
        ai_usage_quota: 0,
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Failed to create user profile:", insertError);
      return NextResponse.json(
        { error: "Failed to create profile", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Profile created successfully",
      plan: "free",
    });
  } catch (error) {
    console.error("Failed to initialize profile:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
