import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type ProfilePayload = {
  fullName: string;
  email: string;
  company: string;
  bio: string;
  timezone: string;
  notifications: boolean;
  avatarUrl: string;
};

function requireUserId(request: NextRequest): string {
  const userId = request.nextUrl.searchParams.get("userId") ?? request.headers.get("x-lexy-user-id");
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

function normalizeProfile(input: Partial<ProfilePayload> | null | undefined): ProfilePayload {
  return {
    fullName: String(input?.fullName ?? "").trim(),
    email: String(input?.email ?? "").trim(),
    company: String(input?.company ?? "").trim(),
    bio: String(input?.bio ?? "").trim(),
    timezone: String(input?.timezone ?? "").trim(),
    notifications: Boolean(input?.notifications ?? false),
    avatarUrl: String(input?.avatarUrl ?? "").trim(),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
  }

  let userId: string;
  try {
    userId = requireUserId(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "userId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("plan, momentum, settings, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const profileFromSettings = normalizeProfile(
    (settings.profile as Partial<ProfilePayload> | undefined) ?? undefined,
  );
  const avatarUrlFromColumn = typeof data?.avatar_url === "string" ? data.avatar_url.trim() : "";
  const profile: ProfilePayload = {
    ...profileFromSettings,
    avatarUrl: avatarUrlFromColumn || profileFromSettings.avatarUrl,
  };

  return NextResponse.json({
    userId,
    plan: data?.plan ?? "free",
    momentum: data?.momentum ?? "new",
    profile,
  });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
  }

  let userId: string;
  try {
    userId = requireUserId(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "userId is required" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("user_profiles")
    .select("plan, momentum, settings, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const settings = { ...(existing?.settings ?? {}) } as Record<string, unknown>;
  const payload = (await request.json().catch(() => ({}))) as Partial<ProfilePayload>;
  const existingProfile = normalizeProfile(
    (settings.profile as Partial<ProfilePayload> | undefined) ?? undefined,
  );
  const existingAvatarUrl = typeof existing?.avatar_url === "string" ? existing.avatar_url.trim() : "";
  const profile = normalizeProfile({
    ...existingProfile,
    avatarUrl: existingAvatarUrl || existingProfile.avatarUrl,
    ...payload,
  });
  settings.profile = profile;
  const avatarUrl = profile.avatarUrl.trim();

  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        plan: existing?.plan ?? "free",
        momentum: existing?.momentum ?? "new",
        settings,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ profile });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
