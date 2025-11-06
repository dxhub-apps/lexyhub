import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeywordSeed, NormalizedKeyword, RawSourcePayload } from "./types";
import { logger } from "@/lib/logger";

/**
 * Fetch enabled keyword seeds from database
 */
export async function fetchKeywordSeeds(
  client: SupabaseClient,
  limit: number
): Promise<KeywordSeed[]> {
  const { data, error } = await client
    .from("keyword_seeds")
    .select("id, term, language_code, location_code, market, enabled")
    .eq("enabled", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch keyword seeds: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    term: row.term,
    language_code: row.language_code,
    location_code: row.location_code,
    market: row.market,
    enabled: row.enabled,
  }));
}

/**
 * Update last_run_at timestamp for processed seeds
 */
export async function updateSeedsLastRun(
  client: SupabaseClient,
  seedIds: string[]
): Promise<void> {
  if (seedIds.length === 0) return;

  const { error } = await client
    .from("keyword_seeds")
    .update({ last_run_at: new Date().toISOString() })
    .in("id", seedIds);

  if (error) {
    logger.warn(`Failed to update seed timestamps: ${error.message}`, { error });
    // Non-fatal, don't throw
  }
}

/**
 * Insert raw source payload
 */
export async function insertRawSource(
  client: SupabaseClient,
  payload: RawSourcePayload
): Promise<string | null> {
  const { data, error } = await client
    .from("raw_sources")
    .insert({
      provider: payload.provider,
      source_type: payload.source_type,
      source_key: payload.source_key,
      status: payload.status,
      payload: payload.payload,
      metadata: payload.metadata,
      error: payload.error || null,
      processed_at:
        payload.status === "completed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    // Check if this is a duplicate key violation
    if (error.code === "23505") {
      logger.debug(
        `Raw source already exists: ${payload.source_key}, skipping insert`
      );
      return null;
    }
    throw new Error(`Failed to insert raw source: ${error.message}`);
  }

  return data?.id || null;
}

/**
 * Batch upsert normalized keywords
 */
export async function upsertKeywordsBatch(
  client: SupabaseClient,
  keywords: NormalizedKeyword[],
  rawSourceId: string | null
): Promise<{ inserted: number; updated: number; failed: number }> {
  if (keywords.length === 0) {
    return { inserted: 0, updated: 0, failed: 0 };
  }

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  // Process in chunks of 1000 to avoid payload limits
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < keywords.length; i += CHUNK_SIZE) {
    const chunk = keywords.slice(i, i + CHUNK_SIZE);

    for (const keyword of chunk) {
      try {
        // Use the lexy_upsert_keyword RPC function
        const { data, error } = await client.rpc("lexy_upsert_keyword", {
          p_term: keyword.termNorm,
          p_market: keyword.market,
          p_source: keyword.source,
          p_tier: "free",
          p_method: "dataforseo_k4k_standard",
          p_extras: {
            search_volume: keyword.searchVolume,
            cpc: keyword.cpc,
            monthly_trend: keyword.monthlyTrend,
            original_term: keyword.termOriginal,
            locale: keyword.locale,
          },
          p_demand: null,
          p_competition: keyword.competition,
          p_engagement: null,
          p_ai: null,
          p_freshness: new Date().toISOString(),
        });

        if (error) {
          logger.warn(
            `Failed to upsert keyword "${keyword.termNorm}": ${error.message}`,
            { term: keyword.termNorm, error }
          );
          failed++;
          continue;
        }

        // Check if it was an insert or update by querying if the returned ID is new
        // For simplicity, we'll count all as updated since the RPC doesn't distinguish
        // In a real scenario, we could enhance the RPC to return this info
        updated++;
      } catch (error: any) {
        logger.warn(
          `Error upserting keyword "${keyword.termNorm}": ${error.message}`,
          { term: keyword.termNorm, error }
        );
        failed++;
      }
    }

    logger.debug(
      `Upserted chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(keywords.length / CHUNK_SIZE)}`,
      {
        chunkSize: chunk.length,
        progress: `${i + chunk.length}/${keywords.length}`,
      }
    );
  }

  return { inserted, updated, failed };
}

/**
 * Check if task already exists in raw_sources
 */
export async function taskAlreadyProcessed(
  client: SupabaseClient,
  taskId: string
): Promise<boolean> {
  const { data, error } = await client
    .from("raw_sources")
    .select("id")
    .eq("provider", "dataforseo")
    .eq("source_type", "google_ads_keywords_for_keywords_standard")
    .eq("source_key", taskId)
    .eq("status", "completed")
    .limit(1);

  if (error) {
    logger.warn(`Error checking task existence: ${error.message}`, { taskId });
    return false;
  }

  return data && data.length > 0;
}

/**
 * Get total count of keyword seeds (for reporting)
 */
export async function getKeywordSeedsCount(
  client: SupabaseClient,
  enabledOnly: boolean = true
): Promise<number> {
  let query = client.from("keyword_seeds").select("id", { count: "exact", head: true });

  if (enabledOnly) {
    query = query.eq("enabled", true);
  }

  const { count, error } = await query;

  if (error) {
    logger.warn(`Failed to count keyword seeds: ${error.message}`, { error });
    return 0;
  }

  return count || 0;
}
