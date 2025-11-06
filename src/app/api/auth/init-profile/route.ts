import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Initializes a user profile with the free tier after signup.
 * Should be called once when a new user registers.
 *
 * Note: With the database trigger in place (auto_create_user_profile),
 * profiles are now created automatically on signup. This endpoint
 * serves as a fallback and verification mechanism.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get the current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // If not authenticated, it might be because the session hasn't been established yet
      // This is not necessarily an error since profiles are now created via DB trigger
      console.warn("Init-profile called without authentication. Profile should be created via DB trigger.");
      return NextResponse.json(
        {
          ok: true,
          message: "Profile will be created automatically via database trigger"
        },
        { status: 200 }
      );
    }

    // Check if profile already exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from("user_profiles")
      .select("user_id, plan")
      .eq("user_id", user.id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "not found" which is expected if profile doesn't exist yet
      console.error("Failed to fetch user profile:", fetchError);
    }

    if (existingProfile) {
      return NextResponse.json({
        ok: true,
        message: "Profile already exists",
        plan: existingProfile.plan,
      });
    }

    // Create new profile with free tier (fallback in case trigger didn't fire)
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
      })
      .select()
      .single();

    if (insertError) {
      // Check if it's a duplicate key error (profile was just created by trigger)
      if (insertError.code === "23505") {
        return NextResponse.json({
          ok: true,
          message: "Profile already created",
          plan: "free",
        });
      }

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
