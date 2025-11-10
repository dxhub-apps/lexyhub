/**
 * API Endpoint: Ingest Predictions to ai_corpus
 * POST /api/jobs/ingest-corpus/predictions
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSemanticEmbedding } from "@/lib/ai/semantic-embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get("authorization");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(process.env.SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);

    const { data: predictions, error } = await supabase
      .from("keyword_predictions")
      .select("id, keyword_id, marketplace, horizon, metrics, created_at")
      .gte("created_at", lookbackDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !predictions?.length) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No predictions found",
        duration: Date.now() - startTime,
      });
    }

    const keywordIds = [...new Set(predictions.map((p) => p.keyword_id))];
    const { data: keywords } = await supabase
      .from("keywords")
      .select("id, term, marketplace")
      .in("id", keywordIds);

    const keywordsMap = new Map((keywords || []).map((k) => [k.id, k]));
    let successCount = 0;

    for (const pred of predictions) {
      const keyword = keywordsMap.get(pred.keyword_id);
      if (!keyword) continue;

      const chunk = `Forecast for keyword: "${keyword.term}". Marketplace: ${pred.marketplace || keyword.marketplace}. Forecast Horizon: ${pred.horizon}. ${JSON.stringify(pred.metrics)}`;
      const embedding = await createSemanticEmbedding(chunk, { fallbackToDeterministic: true });

      await supabase.from("ai_corpus").upsert({
        id: crypto.randomUUID(),
        owner_scope: "global",
        source_type: "keyword_prediction",
        source_ref: { prediction_id: pred.id, keyword_id: pred.keyword_id, ingested_at: new Date().toISOString() },
        marketplace: pred.marketplace || keyword.marketplace,
        language: "en",
        chunk,
        embedding: JSON.stringify(embedding),
        metadata: { keyword_term: keyword.term, horizon: pred.horizon, metrics: pred.metrics },
        is_active: true,
      });
      successCount++;
    }

    return NextResponse.json({ success: true, processed: predictions.length, successCount, duration: Date.now() - startTime });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), duration: Date.now() - startTime }, { status: 500 });
  }
}
