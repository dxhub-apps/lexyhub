// app/api/lexybrain/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";

import {
  generateLexyBrainInsight,
  type LexyBrainOrchestrationResult,
} from "@/lib/lexybrain/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RequestSchema = z.object({
  capability: z.union([
    z.literal("keyword_insights"),
    z.literal("market_brief"),
    z.literal("competitor_intel"),
    z.literal("alert_explanation"),
    z.literal("recommendations"),
    z.literal("compliance_check"),
    z.literal("support_docs"),
    z.literal("ask_anything"),
  ]),
  keywordIds: z.array(z.string().uuid()).optional().default([]),
  query: z.string().optional().default(""),
  marketplace: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  scope: z.enum(["user", "team", "global"]).optional(),
  teamId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const requestStart = Date.now();

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    if (typeof body?.prompt === "string") {
      return NextResponse.json(
        {
          error: "deprecated_endpoint",
          message: "Freeform prompts are not supported. Provide a capability request instead.",
        },
        { status: 400 }
      );
    }

    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const orchestrationResult = (await generateLexyBrainInsight({
      ...parsed.data,
      userId: user.id,
    })) as LexyBrainOrchestrationResult;

    const latency = Date.now() - requestStart;

    return NextResponse.json(
      {
        ok: true,
        capability: orchestrationResult.capability,
        outputType: orchestrationResult.outputType,
        insight: orchestrationResult.insight,
        metrics: orchestrationResult.metrics,
        references: orchestrationResult.references,
        llama: orchestrationResult.llama,
        snapshot: orchestrationResult.snapshot,
        _metadata: {
          latencyMs: latency,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const latency = Date.now() - requestStart;
    const message = error instanceof Error ? error.message : "LexyBrain orchestration failed";

    return NextResponse.json(
      {
        ok: false,
        error: "lexybrain_unavailable",
        message,
        _metadata: { latencyMs: latency },
      },
      { status: 500 }
    );
  }
}
