import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type AffiliatePayload = {
  displayName: string;
  email: string;
  payoutMethod: string;
  payoutEmail: string;
};

function requireUserId(request: NextRequest): string {
  const userId = request.nextUrl.searchParams.get("userId") ?? request.headers.get("x-lexy-user-id");
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

function normalizeAffiliate(input: Partial<AffiliatePayload> | null | undefined): AffiliatePayload {
  return {
    displayName: String(input?.displayName ?? "").trim(),
    email: String(input?.email ?? "").trim(),
    payoutMethod: String(input?.payoutMethod ?? "paypal").trim(),
    payoutEmail: String(input?.payoutEmail ?? "").trim(),
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
    .from("affiliates")
    .select("code, display_name, email, payout_method, payout_email, status, base_rate")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      error: "Affiliate record not found",
      affiliate: null
    }, { status: 404 });
  }

  return NextResponse.json({
    affiliate: {
      code: data.code,
      displayName: data.display_name ?? "",
      email: data.email ?? "",
      payoutMethod: data.payout_method ?? "paypal",
      payoutEmail: data.payout_email ?? "",
      status: data.status,
      baseRate: data.base_rate,
    }
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

  const payload = (await request.json().catch(() => ({}))) as Partial<AffiliatePayload>;
  const normalized = normalizeAffiliate(payload);

  const { data, error: updateError } = await supabase
    .from("affiliates")
    .update({
      display_name: normalized.displayName || null,
      email: normalized.email || null,
      payout_method: normalized.payoutMethod,
      payout_email: normalized.payoutEmail || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("code, display_name, email, payout_method, payout_email, status, base_rate")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    affiliate: {
      code: data.code,
      displayName: data.display_name ?? "",
      email: data.email ?? "",
      payoutMethod: data.payout_method ?? "paypal",
      payoutEmail: data.payout_email ?? "",
      status: data.status,
      baseRate: data.base_rate,
    }
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
