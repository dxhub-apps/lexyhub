import { NextResponse } from "next/server";

import { buildIntentGraphLayout, type IntentGraphNode } from "@/lib/intents/layout";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import fallbackKeywords from "@/data/synthetic/intent-graph.json";

type SupabaseKeywordRow = {
  id: string | number;
  term: string;
  source?: string | null;
  market?: string | null;
  extras?: Record<string, unknown> | null;
};

type FallbackKeyword = {
  id?: string;
  term: string;
  intent: string;
  persona: string;
  purchaseStage: string;
  confidence?: number;
};

function buildNodesFromSupabaseRows(rows: SupabaseKeywordRow[] | null): IntentGraphNode[] {
  if (!rows) {
    return [];
  }

  const nodes: IntentGraphNode[] = [];

  for (const keyword of rows) {
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
      id: String(keyword.id ?? keyword.term),
      term: keyword.term,
      intent,
      persona,
      purchaseStage,
      score: Number.isFinite(confidence) ? confidence : 0.4,
    });
  }

  return nodes;
}

function buildNodesFromFallback(rows: FallbackKeyword[]): IntentGraphNode[] {
  return rows.map((keyword, index) => ({
    id: String(keyword.id ?? `synthetic-${index}`),
    term: keyword.term,
    intent: keyword.intent,
    persona: keyword.persona,
    purchaseStage: keyword.purchaseStage,
    score: Number.isFinite(keyword.confidence) ? Number(keyword.confidence) : 0.6,
  }));
}

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  let source = "keywords";
  const warnings: string[] = [];
  let nodes: IntentGraphNode[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .from("keywords")
      .select("id, term, source, market, extras, trend_momentum")
      .order("updated_at", { ascending: false })
      .limit(150);

    if (error) {
      console.warn("Failed to load keywords for intent graph", error);
      warnings.push(`Supabase intent data unavailable: ${error.message}`);
    } else {
      nodes = buildNodesFromSupabaseRows(data as SupabaseKeywordRow[]);
    }
  } else {
    warnings.push("Supabase credentials missing; using synthetic intent graph data.");
  }

  if (!nodes.length) {
    nodes = buildNodesFromFallback(fallbackKeywords as FallbackKeyword[]);
    source = "synthetic";
  }

  const layout = buildIntentGraphLayout(nodes);
  const payload = {
    generatedAt: new Date().toISOString(),
    source,
    ...layout,
    ...(warnings.length ? { warnings } : {}),
  };

  return NextResponse.json(payload);
}

export const runtime = "nodejs";
