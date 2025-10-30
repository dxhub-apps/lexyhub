import { NextResponse } from "next/server";

import { buildIntentGraphLayout, type IntentGraphNode } from "@/lib/intents/layout";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function buildStubNodes(): IntentGraphNode[] {
  return [
    {
      id: "stub-handmade-jewelry",
      term: "handmade jewelry",
      intent: "purchase",
      persona: "trendsetter",
      purchaseStage: "purchase",
      score: 0.72,
    },
    {
      id: "stub-eco-candles",
      term: "eco candles",
      intent: "consideration",
      persona: "eco shopper",
      purchaseStage: "consideration",
      score: 0.64,
    },
    {
      id: "stub-minimalist-art",
      term: "minimalist wall art",
      intent: "discovery",
      persona: "home curator",
      purchaseStage: "awareness",
      score: 0.58,
    },
  ];
}

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const layout = buildIntentGraphLayout(buildStubNodes());
    return NextResponse.json({ generatedAt: new Date().toISOString(), source: "stub", ...layout });
  }

  const { data, error } = await supabase
    .from("keywords")
    .select("id, term, source, market, extras, trend_momentum")
    .order("updated_at", { ascending: false })
    .limit(150);

  if (error) {
    console.warn("Failed to load keywords for intent graph", error);
    const layout = buildIntentGraphLayout(buildStubNodes());
    return NextResponse.json({ generatedAt: new Date().toISOString(), source: "fallback", ...layout });
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
    const layout = buildIntentGraphLayout(buildStubNodes());
    return NextResponse.json({ generatedAt: new Date().toISOString(), source: "empty", ...layout });
  }

  const layout = buildIntentGraphLayout(nodes);
  return NextResponse.json({ generatedAt: new Date().toISOString(), source: "keywords", ...layout });
}

export const runtime = "nodejs";
