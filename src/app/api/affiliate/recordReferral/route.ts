import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createReferral, getAffiliateByCode } from "@/lib/db/affiliates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records an affiliate referral after user signup.
 * Should be called once when a new user registers.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    // Check for affiliate cookie
    const cookieStore = cookies();
    const affCookie = cookieStore.get("aff_ref");

    if (!affCookie?.value) {
      return NextResponse.json({ ok: false, message: "No affiliate cookie" });
    }

    // Parse cookie
    let parsed: { ref: string; ts: number };
    try {
      parsed = JSON.parse(affCookie.value);
    } catch {
      return NextResponse.json({ ok: false, message: "Invalid cookie format" });
    }

    // Check if affiliate exists and is active
    const affiliate = await getAffiliateByCode(parsed.ref);
    if (!affiliate) {
      return NextResponse.json({ ok: false, message: "Affiliate not found" });
    }

    // Calculate expiration date based on affiliate settings
    const expiresAt = affiliate.lifetime
      ? null
      : new Date(Date.now() + affiliate.recur_months * 30 * 24 * 60 * 60 * 1000);

    // Create referral record (idempotent on referred_user_id unique constraint)
    await createReferral({
      affiliate_id: affiliate.id,
      referred_user_id: userId,
      ref_code: parsed.ref,
      expires_at: expiresAt,
    });

    return NextResponse.json({
      ok: true,
      affiliate: affiliate.code,
      expires_at: expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Failed to record referral", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
