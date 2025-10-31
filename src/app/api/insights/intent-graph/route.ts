import { NextResponse } from "next/server";

import { buildIntentGraphLayout, type IntentGraphNode } from "@/lib/intents/layout";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      {
        error: "Supabase service credentials are required for intent graph data.",
      },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("keywords")
    .select("id, term, source, market, extras, trend_momentum")
    .order("updated_at", { ascending: false })
    .limit(150);

  if (error) {
    console.warn("Failed to load keywords for intent graph", error);
    return NextResponse.json(
      {
        error: `Unable to load intent classifications: ${error.message}`,
      },
      { status: 500 },
    );
  }

  const nodes: IntentGraphNode[] = [];

  for (const keyword of data ?? []) {
    const extras = keyword.extras && typeof keyword.extras === "object" ? keyword.extras : {};
    const classification = (extras as { classification?: Record<string, unknown> }).classification;

    if (!classification || typeof classification !== "object") {
      continue;
    }

    const intent = String(classification.intent ?? "unspecified");
    const persona = String(classification.persona ?? "unknown");
    const purchaseStage = String(classification.purchaseStage ?? "consideration");
    const confidence = Number(classification.confidence ?? 0.4);

    nodes.push({
      id: keyword.id,
      term: keyword.term,
      intent,
      persona,
      purchaseStage,
      score: confidence,
    });
  }

  if (!nodes.length) {
    return NextResponse.json(
      {
        error:
          "No classified keywords found. Run the intent-classification worker to populate extras.classification with live data.",
      },
      { status: 503 },
    );
  }

  const layout = buildIntentGraphLayout(nodes);
  return NextResponse.json({ generatedAt: new Date().toISOString(), source: "keywords", ...layout });
}

export const runtime = "nodejs";
