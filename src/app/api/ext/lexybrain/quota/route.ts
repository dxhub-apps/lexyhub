// src/app/api/ext/lexybrain/quota/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension } from "@/lib/extension/auth";
import { isLexyBrainEnabled } from "@/lib/lexybrain-config";
import { checkLexyBrainQuota } from "@/lib/lexybrain-quota";

/**
 * Extension Quota Check endpoint
 *
 * Returns current LexyBrain quota usage for the authenticated extension user.
 * Used to show quota status in extension UI (badge, popup, etc.)
 *
 * Usage:
 * GET /api/ext/lexybrain/quota
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Check if LexyBrain is enabled
  if (!isLexyBrainEnabled()) {
    return NextResponse.json(
      { enabled: false },
      { status: 200 }
    );
  }

  // Authenticate extension
  const context = await authenticateExtension(request);
  if (!context) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    // Check all quota types
    const [aiCallsQuota, aiBriefQuota, aiSimQuota] = await Promise.all([
      checkLexyBrainQuota(context.userId, "ai_calls"),
      checkLexyBrainQuota(context.userId, "ai_brief"),
      checkLexyBrainQuota(context.userId, "ai_sim")
    ]);

    // Calculate overall status
    const quotas = [aiCallsQuota, aiBriefQuota, aiSimQuota];
    const anyAtLimit = quotas.some(q => q.limit !== -1 && q.used >= q.limit);
    const anyNearLimit = quotas.some(q => q.limit !== -1 && q.percentage >= 80);

    return NextResponse.json({
      enabled: true,
      quotas: {
        ai_calls: aiCallsQuota,
        ai_brief: aiBriefQuota,
        ai_sim: aiSimQuota
      },
      status: anyAtLimit ? "exhausted" : anyNearLimit ? "warning" : "ok",
      upgrade_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.lexyhub.com"}/billing`
    });

  } catch (error: any) {
    console.error("Error in /api/ext/lexybrain/quota:", error);
    return NextResponse.json(
      { error: "Failed to fetch quota" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const revalidate = 30; // Cache for 30 seconds
