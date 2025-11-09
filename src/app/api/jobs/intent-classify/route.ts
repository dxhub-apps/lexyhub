import { NextResponse } from "next/server";

import { runLexyBrainOrchestration } from "@/lib/lexybrain/orchestrator";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function createJobRun(jobName: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { supabase: null, jobRunId: null } as const;
  }

  const { data, error } = await supabase
    .from("job_runs")
    .insert({ job_name: jobName, status: "running" })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn(`Failed to record job run for ${jobName}`, error);
  }

  return { supabase, jobRunId: data?.id ?? null } as const;
}

async function finalizeJobRun(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  jobRunId: string | null,
  status: "succeeded" | "failed",
  metadata: Record<string, unknown>,
) {
  if (!supabase || !jobRunId) {
    return;
  }

  const { error } = await supabase
    .from("job_runs")
    .update({ status, finished_at: new Date().toISOString(), metadata })
    .eq("id", jobRunId);

  if (error) {
    console.warn("Failed to finalize intent classify job run", error);
  }
}

export async function POST(): Promise<NextResponse> {
  const { supabase, jobRunId } = await createJobRun("intent-classification");

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service credentials are not configured." },
      { status: 500 },
    );
  }

  try {
    const { data: keywords, error } = await supabase
      .from("keywords")
      .select("id, term, source, market, extras")
      .order("updated_at", { ascending: false })
      .limit(40);

    if (error) {
      throw new Error(`Failed to load keywords: ${error.message}`);
    }

    const targets = (keywords ?? []).filter((keyword) => {
      const extras = keyword.extras && typeof keyword.extras === "object" ? keyword.extras : {};
      const classification = (extras as { classification?: unknown }).classification;
      return !classification;
    });

    const processed: Array<{ id: string; intent: string }> = [];

    for (const keyword of targets) {
      // Use LexyBrain orchestrator for intent classification
      const result = await runLexyBrainOrchestration({
        capability: "intent_classification",
        userId: "system",
        keywordIds: [keyword.id],
        marketplace: keyword.market || null,
        scope: "global",
        metadata: {
          term: keyword.term,
          source: keyword.source,
        },
      });

      const extras = keyword.extras && typeof keyword.extras === "object" ? { ...keyword.extras } : {};

      // Extract classification from orchestrator result
      const insightData = result.insight as any;
      extras.classification = {
        intent: insightData.intent || "unknown",
        purchaseStage: insightData.purchaseStage || insightData.purchase_stage || "unknown",
        persona: insightData.persona || "unknown",
        summary: insightData.summary || "",
        confidence: insightData.confidence || 0,
        model: result.llama.modelVersion,
        updatedAt: new Date().toISOString(),
      };
      extras.classificationAudit = {
        capability: result.capability,
        outputType: result.outputType,
        generatedAt: new Date().toISOString(),
        promptTokens: result.llama.promptTokens,
        outputTokens: result.llama.outputTokens,
      };

      const { error: updateError } = await supabase
        .from("keywords")
        .update({ extras })
        .eq("id", keyword.id);

      if (updateError) {
        console.warn(`Failed to update classification for ${keyword.id}`, updateError);
        continue;
      }

      processed.push({ id: keyword.id, intent: insightData.intent || "unknown" });
    }

    await finalizeJobRun(supabase, jobRunId, "succeeded", {
      processed: processed.length,
    });

    return NextResponse.json({ processed });
  } catch (error) {
    console.error("Intent classification job failed", error);
    await finalizeJobRun(supabase, jobRunId, "failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Intent classification failed" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
