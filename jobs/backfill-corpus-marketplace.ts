#!/usr/bin/env node
/**
 * Backfill NULL marketplace values in ai_corpus
 *
 * This fixes corpus records that were ingested with the buggy code
 * that selected 'marketplace' column instead of 'market' from keywords table
 *
 * Run: tsx jobs/backfill-corpus-marketplace.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[ERROR] Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const runId = crypto.randomUUID();
  const runStarted = new Date().toISOString();

  console.log(`[${runStarted}] Starting marketplace backfill for ai_corpus ${runId}`);

  try {
    // First, check how many records need updating
    const { count: nullCount, error: countError } = await supabase
      .from("ai_corpus")
      .select("id", { count: "exact", head: true })
      .is("marketplace", null)
      .not("source_ref->keyword_id", "is", null);

    if (countError) {
      console.error("[ERROR] Failed to count NULL marketplace records:", countError);
      throw new Error(`Failed to count records: ${countError.message}`);
    }

    console.log(`[INFO] Found ${nullCount} ai_corpus records with NULL marketplace`);

    if (!nullCount || nullCount === 0) {
      console.log("[INFO] No records to update. Exiting.");
      return;
    }

    // Get all corpus records with NULL marketplace that have keyword_id
    const { data: corpusRecords, error: fetchError } = await supabase
      .from("ai_corpus")
      .select("id, source_ref")
      .is("marketplace", null)
      .not("source_ref->keyword_id", "is", null);

    if (fetchError) {
      console.error("[ERROR] Failed to fetch corpus records:", fetchError);
      throw new Error(`Failed to fetch records: ${fetchError.message}`);
    }

    if (!corpusRecords || corpusRecords.length === 0) {
      console.log("[INFO] No records found to update");
      return;
    }

    console.log(`[INFO] Fetched ${corpusRecords.length} corpus records to update`);

    // Extract keyword IDs
    const keywordIds = corpusRecords
      .map(record => {
        const sourceRef = record.source_ref as Record<string, any>;
        return sourceRef?.keyword_id;
      })
      .filter((id): id is string => typeof id === "string");

    console.log(`[INFO] Fetching market values for ${keywordIds.length} unique keywords...`);

    // Fetch keywords with their market values
    const { data: keywords, error: keywordsError } = await supabase
      .from("keywords")
      .select("id, market")
      .in("id", keywordIds)
      .not("market", "is", null);

    if (keywordsError) {
      console.error("[ERROR] Failed to fetch keywords:", keywordsError);
      throw new Error(`Failed to fetch keywords: ${keywordsError.message}`);
    }

    if (!keywords || keywords.length === 0) {
      console.log("[WARN] No keywords found with market values");
      return;
    }

    console.log(`[INFO] Found ${keywords.length} keywords with market values`);

    // Create a map of keyword_id -> market
    const keywordMarketMap = new Map<string, string>();
    keywords.forEach(k => {
      if (k.market) {
        keywordMarketMap.set(k.id, k.market);
      }
    });

    // Update each corpus record
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    console.log(`[INFO] Updating ${corpusRecords.length} corpus records...`);

    for (const record of corpusRecords) {
      try {
        const sourceRef = record.source_ref as Record<string, any>;
        const keywordId = sourceRef?.keyword_id;

        if (!keywordId) {
          skippedCount++;
          continue;
        }

        const market = keywordMarketMap.get(keywordId);

        if (!market) {
          console.log(`[WARN] No market found for keyword ${keywordId}, skipping corpus record ${record.id}`);
          skippedCount++;
          continue;
        }

        // Update the corpus record
        const { error: updateError } = await supabase
          .from("ai_corpus")
          .update({ marketplace: market })
          .eq("id", record.id);

        if (updateError) {
          console.error(`[ERROR] Failed to update corpus record ${record.id}:`, updateError);
          errorCount++;
        } else {
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`[INFO] Progress: ${successCount}/${corpusRecords.length} updated`);
          }
        }
      } catch (error) {
        console.error(`[ERROR] Exception updating corpus record ${record.id}:`, error);
        errorCount++;
      }
    }

    console.log(`[INFO] Backfill complete:`);
    console.log(`  - Successfully updated: ${successCount}`);
    console.log(`  - Errors: ${errorCount}`);
    console.log(`  - Skipped: ${skippedCount}`);

    const runEnded = new Date().toISOString();
    const duration = new Date(runEnded).getTime() - new Date(runStarted).getTime();

    console.log(`[${runEnded}] Marketplace backfill completed`);
    console.log(`[INFO] Duration: ${(duration / 1000).toFixed(2)}s`);

  } catch (error) {
    console.error(`[ERROR] Fatal error in marketplace backfill: ${error}`);
    process.exit(1);
  }
}

main();
