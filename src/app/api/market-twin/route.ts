import { NextRequest, NextResponse } from "next/server";

import { runMarketTwinSimulation } from "@/lib/market-twin/simulator";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();
  const userId = request.nextUrl.searchParams.get("userId");

  if (!supabase) {
    return NextResponse.json({ simulations: [] }, { status: 200 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ai_predictions")
    .select("id, listing_id, scenario_input, result, predicted_visibility, confidence, extras, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: `Failed to load simulations: ${error.message}` }, { status: 500 });
  }

  const simulations = (data ?? []).map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    scenario_input: row.scenario_input,
    createdAt: row.created_at,
    result: {
      predictedVisibility: row.predicted_visibility ?? row.result?.predictedVisibility ?? null,
      confidence: row.confidence ?? row.result?.confidence ?? null,
      explanation: row.extras?.explanation ?? null,
      semanticGap: row.extras?.semanticGap ?? row.result?.semanticGap ?? null,
    },
    extras: row.extras ?? {},
  }));

  return NextResponse.json({ simulations });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 500 });
  }

  const payload = await request.json();
  const userId = payload?.userId as string | undefined;
  const listingId = payload?.listingId as string | undefined;
  const scenarioTitle = payload?.scenarioTitle as string | undefined;
  const scenarioTags = (payload?.scenarioTags as string[] | undefined) ?? [];
  const scenarioPriceCents = Number(payload?.scenarioPriceCents ?? 0);
  const goals = (payload?.goals as string[] | undefined) ?? [];
  const scenarioDescription = payload?.scenarioDescription as string | undefined;

  if (!userId || !listingId || !scenarioTitle) {
    return NextResponse.json({ error: "userId, listingId, and scenarioTitle are required" }, { status: 400 });
  }

  const { baseline, result } = await runMarketTwinSimulation(
    {
      listingId,
      userId,
      scenarioTitle,
      scenarioTags,
      scenarioPriceCents,
      scenarioDescription,
      goals,
    },
    supabase,
  );

  if (!baseline || !result) {
    return NextResponse.json({ error: "Unable to produce Market Twin simulation" }, { status: 500 });
  }

  const { error: insertError, data } = await supabase
    .from("ai_predictions")
    .insert({
      listing_id: listingId,
      user_id: userId,
      scenario_input: {
        listingId,
        scenarioTitle,
        scenarioTags,
        scenarioPriceCents,
        scenarioDescription,
        goals,
      },
      result: result.metadata,
      predicted_visibility: result.predictedVisibility,
      predicted_engagement: baseline.stats?.favorites ?? null,
      confidence: result.confidence,
      model: result.embeddingModel,
      prompt_version: "market-twin-v1",
      method: "market-twin",
      source: "ai",
      extras: {
        explanation: result.explanation,
        semanticGap: result.semanticGap,
        trendCorrelationDelta: result.trendCorrelationDelta,
      },
    })
    .select("id, created_at")
    .maybeSingle();

  if (insertError) {
    return NextResponse.json({ error: `Failed to persist simulation: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    id: data?.id,
    createdAt: data?.created_at,
    baseline,
    result,
    scenario_input: {
      listingId,
      scenarioTitle,
      scenarioTags,
      scenarioPriceCents,
      scenarioDescription,
      goals,
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
