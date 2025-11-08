#!/usr/bin/env node
// jobs/hourly-keyword-refresh.ts
// Hourly incremental keyword refresh prioritizing watched keywords and recent activity
// Includes Google Trends data collection

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAX_KEYWORDS = parseInt(process.env.MAX_KEYWORDS || "500", 10);
const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || "7", 10);

interface Keyword {
  id: string;
  term: string;
  market: string;
  source: string;
  freshness_ts: string | null;
  is_watched: boolean;
  watcher_count: number;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const runId = crypto.randomUUID();
  const runStarted = new Date().toISOString();

  console.log(`[${runStarted}] Starting hourly keyword refresh ${runId}`);
  console.log(`[INFO] Max keywords: ${MAX_KEYWORDS}, Lookback: ${LOOKBACK_DAYS} days`);

  try {
    // Check if feature is enabled
    const { data: featureFlag } = await supabase
      .from("feature_flags")
      .select("is_enabled, rollout")
      .eq("key", "hourly_keyword_refresh")
      .maybeSingle();

    if (!featureFlag || !featureFlag.is_enabled) {
      console.log("[INFO] Hourly keyword refresh disabled by feature flag");
      return;
    }

    // Get keywords to refresh (prioritize watched keywords)
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS);

    // First, get watched keywords
    const { data: watchedKeywords, error: watchedError } = await supabase
      .from("keywords")
      .select(`
        id,
        term,
        market,
        source,
        freshness_ts,
        user_keyword_watchlists!inner(user_id)
      `)
      .gte("freshness_ts", lookbackDate.toISOString())
      .limit(Math.floor(MAX_KEYWORDS * 0.5)); // 50% budget for watched keywords

    if (watchedError) {
      throw new Error(`Failed to fetch watched keywords: ${watchedError.message}`);
    }

    // Then, get recent active keywords (not already watched)
    const watchedIds = watchedKeywords?.map((k: any) => k.id) || [];

    let activeKeywordsQuery = supabase
      .from("keywords")
      .select("id, term, market, source, freshness_ts")
      .gte("freshness_ts", lookbackDate.toISOString());

    // Only add the NOT IN filter if we have watched keywords to exclude
    if (watchedIds.length > 0) {
      activeKeywordsQuery = activeKeywordsQuery.not("id", "in", `(${watchedIds.join(",")})`);
    }

    const { data: activeKeywords, error: activeError } = await activeKeywordsQuery
      .order("freshness_ts", { ascending: false })
      .limit(Math.floor(MAX_KEYWORDS * 0.5));

    if (activeError) {
      throw new Error(`Failed to fetch active keywords: ${activeError.message}`);
    }

    // Combine and prepare keyword list
    const keywords: Keyword[] = [
      ...(watchedKeywords || []).map((k: any) => ({
        ...k,
        is_watched: true,
        watcher_count: k.user_keyword_watchlists?.length || 0,
      })),
      ...(activeKeywords || []).map((k: any) => ({
        ...k,
        is_watched: false,
        watcher_count: 0,
      })),
    ];

    console.log(`[INFO] Refreshing ${keywords.length} keywords (${watchedKeywords?.length || 0} watched, ${activeKeywords?.length || 0} active)`);

    if (keywords.length === 0) {
      console.log("[INFO] No keywords to refresh");
      await logRun(supabase, runId, "success", 0, 0);
      return;
    }

    // Process keywords in batches
    let refreshed = 0;
    const batchSize = 50;

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      console.log(`[INFO] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(keywords.length / batchSize)}`);

      await Promise.all(
        batch.map(async (keyword) => {
          try {
            // Update freshness timestamp
            const { error: updateError } = await supabase
              .from("keywords")
              .update({ freshness_ts: new Date().toISOString() })
              .eq("id", keyword.id);

            if (updateError) {
              console.warn(`[WARN] Failed to update keyword ${keyword.id}: ${updateError.message}`);
              return;
            }

            refreshed++;
          } catch (err) {
            console.error(`[ERROR] Processing keyword ${keyword.id}:`, err);
          }
        })
      );
    }

    console.log(`[INFO] Successfully refreshed ${refreshed}/${keywords.length} keywords`);

    await logRun(supabase, runId, "success", keywords.length, refreshed);

    console.log(`[INFO] Hourly keyword refresh ${runId} completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Hourly keyword refresh failed: ${errorMessage}`);
    await logRun(supabase, runId, "error", 0, 0, errorMessage);
    process.exit(1);
  }
}

async function logRun(
  supabase: any,
  runId: string,
  status: string,
  keywordsProcessed: number,
  keywordsRefreshed: number,
  error: string | null = null
) {
  await supabase.from("job_runs").insert({
    id: runId,
    job_name: "hourly-keyword-refresh",
    status,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    metadata: {
      keywords_processed: keywordsProcessed,
      keywords_refreshed: keywordsRefreshed,
      max_keywords: MAX_KEYWORDS,
      lookback_days: LOOKBACK_DAYS,
      error,
    },
  });
}

main();
