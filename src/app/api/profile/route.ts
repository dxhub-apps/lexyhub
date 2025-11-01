import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { requireUserId } from "./helpers";

type ProfilePayload = {
  fullName: string;
  email: string;
  company: string;
  bio: string;
  timezone: string;
  notifications: boolean;
  avatarUrl: string;
};

function normalizeProfile(input: Partial<ProfilePayload> | null | undefined): ProfilePayload {
  return {
    fullName: String(input?.fullName ?? ""),
    email: String(input?.email ?? ""),
    company: String(input?.company ?? ""),
    bio: String(input?.bio ?? ""),
    timezone: String(input?.timezone ?? ""),
    notifications: Boolean(input?.notifications ?? false),
    avatarUrl: String(input?.avatarUrl ?? ""),
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
    .select("plan, momentum, settings")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const profile = normalizeProfile((settings.profile as Partial<ProfilePayload> | undefined) ?? undefined);

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

  const payload = (await request.json().catch(() => ({}))) as Partial<ProfilePayload>;
  const profile = normalizeProfile(payload);

  const { data: existing, error: fetchError } = await supabase
    .from("user_profiles")
    .select("plan, momentum, settings")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const settings = { ...(existing?.settings ?? {}) } as Record<string, unknown>;
  settings.profile = profile;

  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        plan: existing?.plan ?? "free",
        momentum: existing?.momentum ?? "new",
        settings,
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
