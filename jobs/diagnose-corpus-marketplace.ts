#!/usr/bin/env node
/**
 * Diagnose corpus marketplace issue
 *
 * This script checks:
 * 1. If corpus records exist
 * 2. What marketplace values they have
 * 3. If the RRF search can find them
 *
 * Run: tsx jobs/diagnose-corpus-marketplace.ts <keyword_id>
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[ERROR] Missing required environment variables");
  process.exit(1);
}

async function main() {
  const keywordId = process.argv[2];

  if (!keywordId) {
    console.error("[ERROR] Usage: tsx jobs/diagnose-corpus-marketplace.ts <keyword_id>");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log("=".repeat(80));
  console.log("CORPUS MARKETPLACE DIAGNOSTIC");
  console.log("=".repeat(80));
  console.log();

  // Step 1: Check keyword
  console.log(`Step 1: Checking keyword ${keywordId}...`);
  const { data: keyword, error: keywordError } = await supabase
    .from("keywords")
    .select("id, term, market, source")
    .eq("id", keywordId)
    .maybeSingle();

  if (keywordError) {
    console.error("[ERROR] Failed to fetch keyword:", keywordError);
    process.exit(1);
  }

  if (!keyword) {
    console.error("[ERROR] Keyword not found");
    process.exit(1);
  }

  console.log("✅ Found keyword:");
  console.log(`   - ID: ${keyword.id}`);
  console.log(`   - Term: "${keyword.term}"`);
  console.log(`   - Market: ${keyword.market || "NULL"}`);
  console.log(`   - Source: ${keyword.source}`);
  console.log();

  // Step 2: Check corpus records
  console.log("Step 2: Checking ai_corpus records for this keyword...");
  const { data: corpusRecords, error: corpusError } = await supabase
    .from("ai_corpus")
    .select("id, source_type, marketplace, is_active, chunk")
    .contains("source_ref", { keyword_id: keywordId });

  if (corpusError) {
    console.error("[ERROR] Failed to fetch corpus records:", corpusError);
  } else if (!corpusRecords || corpusRecords.length === 0) {
    console.log("❌ No corpus records found for this keyword");
    console.log("   This keyword has NOT been ingested into ai_corpus yet.");
    console.log("   Run: npm run jobs:ingest-metrics-to-corpus");
  } else {
    console.log(`✅ Found ${corpusRecords.length} corpus record(s):`);
    corpusRecords.forEach((record, i) => {
      console.log(`   ${i + 1}. ID: ${record.id}`);
      console.log(`      Source Type: ${record.source_type}`);
      console.log(`      Marketplace: ${record.marketplace || "NULL"}`);
      console.log(`      Is Active: ${record.is_active}`);
      console.log(`      Chunk Preview: ${record.chunk.substring(0, 100)}...`);
    });
  }
  console.log();

  // Step 3: Check if marketplace matches
  if (keyword.market && corpusRecords && corpusRecords.length > 0) {
    const matchingRecords = corpusRecords.filter(r => r.marketplace === keyword.market);
    const nullRecords = corpusRecords.filter(r => !r.marketplace);

    console.log("Step 3: Marketplace matching analysis:");
    console.log(`   - Keyword market: "${keyword.market}"`);
    console.log(`   - Corpus records with matching marketplace: ${matchingRecords.length}`);
    console.log(`   - Corpus records with NULL marketplace: ${nullRecords.length}`);

    if (nullRecords.length > 0) {
      console.log();
      console.log("❌ ISSUE: Some corpus records still have NULL marketplace!");
      console.log("   The backfill SQL may not have run correctly.");
      console.log("   These records won't be found by marketplace-filtered searches.");
      console.log();
      console.log("   Records with NULL marketplace:");
      nullRecords.forEach(r => {
        console.log(`   - ${r.id} (${r.source_type})`);
      });
    }

    if (matchingRecords.length === 0 && nullRecords.length === 0) {
      console.log();
      console.log("❌ ISSUE: No corpus records match the keyword's market value!");
      const uniqueMarkets = [...new Set(corpusRecords.map(r => r.marketplace))];
      console.log(`   Corpus has: ${uniqueMarkets.join(", ")}`);
      console.log(`   Keyword has: ${keyword.market}`);
    }
  }
  console.log();

  // Step 4: Test RRF search
  if (keyword.market) {
    console.log("Step 4: Testing ai_corpus_rrf_search with marketplace filter...");
    const { data: searchResults, error: searchError } = await supabase.rpc(
      "ai_corpus_rrf_search",
      {
        p_query: keyword.term,
        p_query_embedding: null,
        p_capability: "keyword_insights",
        p_marketplace: keyword.market,
        p_language: null,
        p_limit: 12,
      }
    );

    if (searchError) {
      console.error("[ERROR] RRF search failed:", searchError);
    } else if (!searchResults || searchResults.length === 0) {
      console.log("❌ RRF search returned 0 results");
      console.log(`   LexyBrain will return "No corpus data available" error.`);
      console.log();
      console.log("   Possible causes:");
      console.log("   1. Corpus records have NULL marketplace (see Step 3)");
      console.log("   2. Corpus records have wrong marketplace value");
      console.log("   3. Full-text search not matching the query");
      console.log("   4. Embeddings not generated");
    } else {
      console.log(`✅ RRF search returned ${searchResults.length} result(s)`);
      console.log();
      console.log("   Top 3 results:");
      searchResults.slice(0, 3).forEach((result: any, i: number) => {
        console.log(`   ${i + 1}. Combined Score: ${result.combined_score}`);
        console.log(`      Marketplace: ${result.marketplace}`);
        console.log(`      Source Type: ${result.source_type}`);
        console.log(`      Chunk: ${result.chunk.substring(0, 100)}...`);
      });
    }
  }

  console.log();
  console.log("=".repeat(80));
  console.log("DIAGNOSTIC COMPLETE");
  console.log("=".repeat(80));
}

main();
