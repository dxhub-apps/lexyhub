/**
 * API Endpoint: Ingest Risks to ai_corpus
 * POST /api/jobs/ingest-corpus/risks
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Missing Supabase URL configuration" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let totalSuccess = 0;

    // Ingest risk rules
    const { data: rules } = await supabase
      .from("risk_rules")
      .select("id, rule_code, description, marketplace, severity, metadata");

    if (rules) {
      for (const rule of rules) {
        const chunk = `Risk Rule: ${rule.rule_code}. Description: ${rule.description}. Severity: ${rule.severity.toUpperCase()}. ${rule.marketplace ? `Marketplace: ${rule.marketplace}` : 'Scope: All marketplaces'}`;
        const embedding = await createSemanticEmbedding(chunk, { fallbackToDeterministic: true });

        await supabase.from("ai_corpus").upsert({
          id: crypto.randomUUID(),
          owner_scope: "global",
          source_type: "risk_rule",
          source_ref: { rule_id: rule.id, rule_code: rule.rule_code, ingested_at: new Date().toISOString() },
          marketplace: rule.marketplace,
          language: "en",
          chunk,
          embedding: JSON.stringify(embedding),
          metadata: { rule_code: rule.rule_code, severity: rule.severity, description: rule.description },
          is_active: true,
        });
        totalSuccess++;
      }
    }

    // Ingest recent risk events
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);

    const { data: events } = await supabase
      .from("risk_events")
      .select("id, keyword_id, rule_id, marketplace, occurred_at, details, scope")
      .gte("occurred_at", lookbackDate.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (events) {
      const keywordIds = [...new Set(events.filter((e) => e.keyword_id).map((e) => e.keyword_id!))];
      const ruleIds = [...new Set(events.filter((e) => e.rule_id).map((e) => e.rule_id!))];

      const { data: keywords } = keywordIds.length ? await supabase.from("keywords").select("id, term, market").in("id", keywordIds) : { data: [] };
      const { data: rulesData } = ruleIds.length ? await supabase.from("risk_rules").select("id, rule_code, description, severity").in("id", ruleIds) : { data: [] };

      const keywordsMap = new Map((keywords || []).map((k) => [k.id, k]));
      const rulesMap = new Map((rulesData || []).map((r) => [r.id, r]));

      for (const event of events) {
        const keyword = event.keyword_id ? keywordsMap.get(event.keyword_id) : null;
        const rule = event.rule_id ? rulesMap.get(event.rule_id) : null;

        const chunk = `Risk Alert${keyword ? ` for keyword: "${keyword.term}"` : ''}. ${rule ? `Rule: ${rule.rule_code} - ${rule.description}. Severity: ${rule.severity}` : ''}. Date: ${new Date(event.occurred_at).toISOString().split('T')[0]}. ${JSON.stringify(event.details)}`;
        const embedding = await createSemanticEmbedding(chunk, { fallbackToDeterministic: true });

        await supabase.from("ai_corpus").upsert({
          id: crypto.randomUUID(),
          owner_scope: event.scope === "user" ? "user" : "global",
          source_type: "risk_event",
          source_ref: { event_id: event.id, keyword_id: event.keyword_id, rule_id: event.rule_id, ingested_at: new Date().toISOString() },
          marketplace: event.marketplace || keyword?.market,
          language: "en",
          chunk,
          embedding: JSON.stringify(embedding),
          metadata: { keyword_term: keyword?.term, rule_code: rule?.rule_code, severity: rule?.severity, occurred_at: event.occurred_at, scope: event.scope },
          is_active: true,
        });
        totalSuccess++;
      }
    }

    return NextResponse.json({ success: true, totalSuccess, duration: Date.now() - startTime });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), duration: Date.now() - startTime }, { status: 500 });
  }
}
