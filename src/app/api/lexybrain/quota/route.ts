/**
 * LexyBrain Quota API
 *
 * Returns current quota usage for the authenticated user.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { getLexyBrainQuotaUsage } from "@/lib/lexybrain-quota";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    // Authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Get quota usage
    const quotaUsage = await getLexyBrainQuotaUsage(user.id);

    return NextResponse.json(quotaUsage);
  } catch (error) {
    logger.error(
      {
        type: "lexybrain_quota_error",
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to fetch LexyBrain quota"
    );

    return NextResponse.json(
      { error: "Failed to fetch quota information" },
      { status: 500 }
    );
  }
}
