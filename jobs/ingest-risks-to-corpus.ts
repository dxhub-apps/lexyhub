#!/usr/bin/env node
/**
 * Risk Ingestion to ai_corpus Job
 *
 * Reads risk_rules and risk_events tables
 * Creates factual risk alert chunks and upserts into ai_corpus with embeddings
 *
 * Run: node --loader ts-node/esm jobs/ingest-risks-to-corpus.ts
 */

import { createClient } from "@supabase/supabase-js";
import { createSemanticEmbedding } from "../src/lib/ai/semantic-embeddings";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "100", 10);
const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || "30", 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[ERROR] Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

interface Keyword {
  id: string;
  term: string;
  marketplace: string | null;
}

interface RiskRule {
  id: string;
  rule_code: string;
  description: string;
  marketplace: string | null;
  severity: string;
  metadata: Record<string, unknown>;
}

interface RiskEvent {
  id: string;
  keyword_id: string | null;
  rule_id: string | null;
  marketplace: string | null;
  occurred_at: string;
  details: Record<string, unknown>;
  scope: string;
}

function createRiskRuleChunk(rule: RiskRule): string {
  const parts: string[] = [];

  parts.push(`Risk Rule: ${rule.rule_code}`);
  parts.push(`Description: ${rule.description}`);
  parts.push(`Severity: ${rule.severity.toUpperCase()}`);

  if (rule.marketplace) {
    parts.push(`Marketplace: ${rule.marketplace}`);
  } else {
    parts.push(`Scope: All marketplaces`);
  }

  // Extract metadata
  if (rule.metadata.category) {
    parts.push(`Category: ${rule.metadata.category}`);
  }
  if (rule.metadata.auto_flag !== undefined) {
    parts.push(`Auto-flagging: ${rule.metadata.auto_flag ? 'Enabled' : 'Disabled'}`);
  }
  if (rule.metadata.remediation) {
    parts.push(`Remediation: ${rule.metadata.remediation}`);
  }

  return parts.join(". ");
}

function createRiskEventChunk(event: RiskEvent, keyword: Keyword | null, rule: RiskRule | null): string {
  const parts: string[] = [];

  if (keyword) {
    parts.push(`Risk Alert for keyword: "${keyword.term}"`);
  } else {
    parts.push(`Risk Alert (general)`);
  }

  if (rule) {
    parts.push(`Rule Triggered: ${rule.rule_code} - ${rule.description}`);
    parts.push(`Severity: ${rule.severity.toUpperCase()}`);
  }

  const eventDate = new Date(event.occurred_at).toISOString().split("T")[0];
  parts.push(`Date: ${eventDate}`);

  if (event.marketplace) {
    parts.push(`Marketplace: ${event.marketplace}`);
  }

  // Extract event details
  if (event.details.trigger_reason) {
    parts.push(`Reason: ${event.details.trigger_reason}`);
  }
  if (event.details.affected_listings !== undefined) {
    parts.push(`Affected Listings: ${event.details.affected_listings}`);
  }
  if (event.details.mitigation_suggested) {
    parts.push(`Suggested Action: ${event.details.mitigation_suggested}`);
  }
  if (event.details.impact_level) {
    parts.push(`Impact Level: ${event.details.impact_level}`);
  }

  parts.push(`Scope: ${event.scope}`);

  return parts.join(". ");
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const runId = crypto.randomUUID();
  const runStarted = new Date().toISOString();

  console.log(`[${runStarted}] Starting risk ingestion to ai_corpus ${runId}`);
  console.log(`[INFO] Batch size: ${BATCH_SIZE}, Lookback: ${LOOKBACK_DAYS} days`);

  try {
    let totalSuccess = 0;
    let totalErrors = 0;

    // Part 1: Ingest Risk Rules (static reference data)
    console.log("[INFO] Fetching risk rules...");
    const { data: rules, error: rulesError } = await supabase
      .from("risk_rules")
      .select("id, rule_code, description, marketplace, severity, metadata");

    if (rulesError) {
      console.warn(`[WARN] Failed to fetch risk rules: ${rulesError.message}`);
    } else if (rules && rules.length > 0) {
      console.log(`[INFO] Processing ${rules.length} risk rules`);

      for (const rule of rules as RiskRule[]) {
        try {
          const chunk = createRiskRuleChunk(rule);
          const embedding = await createSemanticEmbedding(chunk, {
            fallbackToDeterministic: true,
          });

          const { error: upsertError } = await supabase
            .from("ai_corpus")
            .upsert({
              id: crypto.randomUUID(),
              owner_scope: "global",
              owner_user_id: null,
              owner_team_id: null,
              source_type: "risk_rule",
              source_ref: {
                rule_id: rule.id,
                rule_code: rule.rule_code,
                ingested_at: new Date().toISOString(),
              },
              marketplace: rule.marketplace,
              language: "en",
              chunk,
              embedding: JSON.stringify(embedding),
              metadata: {
                rule_code: rule.rule_code,
                severity: rule.severity,
                description: rule.description,
              },
              is_active: true,
            }, {
              onConflict: "id",
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`[ERROR] Failed to upsert rule ${rule.rule_code}: ${upsertError.message}`);
            totalErrors++;
          } else {
            totalSuccess++;
          }
        } catch (error) {
          console.error(`[ERROR] Failed to process rule ${rule.rule_code}: ${error}`);
          totalErrors++;
        }
      }

      console.log(`[INFO] Risk rules ingestion: ${totalSuccess} success, ${totalErrors} errors`);
    }

    // Part 2: Ingest Recent Risk Events
    console.log("[INFO] Fetching recent risk events...");
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS);

    const { data: events, error: eventsError } = await supabase
      .from("risk_events")
      .select("id, keyword_id, rule_id, marketplace, occurred_at, details, scope")
      .gte("occurred_at", lookbackDate.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (eventsError) {
      console.warn(`[WARN] Failed to fetch risk events: ${eventsError.message}`);
    } else if (events && events.length > 0) {
      console.log(`[INFO] Processing ${events.length} risk events`);

      // Fetch associated keywords and rules
      const keywordIds = [...new Set(events.filter((e) => e.keyword_id).map((e) => e.keyword_id!))];
      const ruleIds = [...new Set(events.filter((e) => e.rule_id).map((e) => e.rule_id!))];

      let keywordsMap = new Map<string, Keyword>();
      if (keywordIds.length > 0) {
        const { data: keywords } = await supabase
          .from("keywords")
          .select("id, term, marketplace")
          .in("id", keywordIds);

        (keywords || []).forEach((k) => {
          keywordsMap.set(k.id, k as Keyword);
        });
      }

      let rulesMap = new Map<string, RiskRule>();
      if (ruleIds.length > 0) {
        const { data: rulesData } = await supabase
          .from("risk_rules")
          .select("id, rule_code, description, marketplace, severity, metadata")
          .in("id", ruleIds);

        (rulesData || []).forEach((r) => {
          rulesMap.set(r.id, r as RiskRule);
        });
      }

      let eventSuccess = 0;
      let eventErrors = 0;

      for (const event of events as RiskEvent[]) {
        try {
          const keyword = event.keyword_id ? keywordsMap.get(event.keyword_id) || null : null;
          const rule = event.rule_id ? rulesMap.get(event.rule_id) || null : null;

          const chunk = createRiskEventChunk(event, keyword, rule);
          const embedding = await createSemanticEmbedding(chunk, {
            fallbackToDeterministic: true,
          });

          const { error: upsertError } = await supabase
            .from("ai_corpus")
            .upsert({
              id: crypto.randomUUID(),
              owner_scope: event.scope === "user" ? "user" : "global",
              owner_user_id: null,
              owner_team_id: null,
              source_type: "risk_event",
              source_ref: {
                event_id: event.id,
                keyword_id: event.keyword_id,
                rule_id: event.rule_id,
                ingested_at: new Date().toISOString(),
              },
              marketplace: event.marketplace || keyword?.marketplace,
              language: "en",
              chunk,
              embedding: JSON.stringify(embedding),
              metadata: {
                keyword_term: keyword?.term,
                rule_code: rule?.rule_code,
                severity: rule?.severity,
                occurred_at: event.occurred_at,
                scope: event.scope,
              },
              is_active: true,
            }, {
              onConflict: "id",
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`[ERROR] Failed to upsert event ${event.id}: ${upsertError.message}`);
            eventErrors++;
          } else {
            eventSuccess++;
            if (eventSuccess % 20 === 0) {
              console.log(`[INFO] Processed ${eventSuccess}/${events.length} events`);
            }
          }
        } catch (error) {
          console.error(`[ERROR] Failed to process event ${event.id}: ${error}`);
          eventErrors++;
        }
      }

      console.log(`[INFO] Risk events ingestion: ${eventSuccess} success, ${eventErrors} errors`);
      totalSuccess += eventSuccess;
      totalErrors += eventErrors;
    }

    const runEnded = new Date().toISOString();
    const duration = new Date(runEnded).getTime() - new Date(runStarted).getTime();

    console.log(`[${runEnded}] Risk ingestion completed`);
    console.log(`[INFO] Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`[INFO] Total Success: ${totalSuccess}, Total Errors: ${totalErrors}`);
  } catch (error) {
    console.error(`[ERROR] Fatal error in risk ingestion: ${error}`);
    process.exit(1);
  }
}

main();
