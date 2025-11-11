#!/usr/bin/env tsx
/**
 * Test RRF Search Directly
 *
 * Tests the ai_corpus_rrf_search function with specific parameters
 * to diagnose why corpus data is not being found
 *
 * Usage:
 *   tsx jobs/test-rrf-search.ts "zodiac wall decal" google
 */

import { createClient } from "@supabase/supabase-js";
import { createSemanticEmbedding } from "../src/lib/ai/semantic-embeddings";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[ERROR] Missing required environment variables:");
  console.error("  - SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testRRFSearch(query: string, marketplace: string | null) {
  console.log("=".repeat(80));
  console.log("RRF SEARCH DIAGNOSTIC");
  console.log("=".repeat(80));
  console.log(`\nQuery: "${query}"`);
  console.log(`Marketplace filter: ${marketplace || "NULL (all marketplaces)"}\n`);

  try {
    // Generate embedding
    console.log("Step 1: Generating embedding...");
    const embedding = await createSemanticEmbedding(query);
    console.log(`✅ Generated embedding (${embedding.length} dimensions)\n`);

    // Test RRF search
    console.log("Step 2: Calling ai_corpus_rrf_search...");
    console.log(`  Parameters:`);
    console.log(`    p_query: "${query}"`);
    console.log(`    p_query_embedding: [${embedding.length} dimensions]`);
    console.log(`    p_capability: "keyword_insights"`);
    console.log(`    p_marketplace: ${marketplace || "NULL"}`);
    console.log(`    p_language: NULL`);
    console.log(`    p_limit: 12`);
    console.log();

    const { data, error } = await supabase.rpc("ai_corpus_rrf_search", {
      p_query: query,
      p_query_embedding: embedding,
      p_capability: "keyword_insights",
      p_marketplace: marketplace,
      p_language: null,
      p_limit: 12,
    });

    if (error) {
      console.error(`❌ RPC call failed: ${error.message}`);
      console.error(`   Code: ${error.code}`);
      console.error(`   Details: ${error.details}`);
      console.error(`   Hint: ${error.hint}`);
      return;
    }

    if (!data || data.length === 0) {
      console.log("❌ RRF search returned ZERO results");
      console.log("\n=== DIAGNOSIS ===");
      console.log("The RRF search function returned no results. Possible causes:");
      console.log("1. No corpus records match the marketplace filter");
      console.log("2. Text search (lexical) doesn't match any chunk_tsv");
      console.log("3. Vector search (embedding) doesn't find similar chunks");
      console.log("4. All corpus records are inactive (is_active = false)");
      console.log("\nDebugging steps:");
      console.log("1. Check if corpus exists:");
      console.log(`   SELECT COUNT(*) FROM ai_corpus WHERE is_active = true;`);
      console.log("2. Check marketplace filter:");
      console.log(`   SELECT COUNT(*) FROM ai_corpus WHERE is_active = true AND (marketplace = '${marketplace}' OR marketplace IS NULL);`);
      console.log("3. Check text search:");
      console.log(`   SELECT COUNT(*) FROM ai_corpus WHERE is_active = true AND chunk_tsv @@ websearch_to_tsquery('english', '${query}');`);
      return;
    }

    console.log(`✅ RRF search returned ${data.length} result(s)\n`);
    console.log("=== RESULTS ===");

    for (let i = 0; i < data.length; i++) {
      const result = data[i];
      console.log(`\n[${i + 1}] ID: ${result.id}`);
      console.log(`    Source Type: ${result.source_type}`);
      console.log(`    Marketplace: ${result.marketplace || "NULL"}`);
      console.log(`    Owner Scope: ${result.owner_scope}`);
      console.log(`    Combined Score: ${result.combined_score?.toFixed(6)}`);
      console.log(`    Lexical Rank: ${result.lexical_rank || "N/A"}`);
      console.log(`    Vector Rank: ${result.vector_rank || "N/A"}`);
      console.log(`    Chunk (first 100 chars): ${result.chunk.substring(0, 100)}...`);
    }

    console.log("\n=== SUMMARY ===");
    console.log(`Total results: ${data.length}`);

    const marketplaceCounts = data.reduce((acc: Record<string, number>, r) => {
      const mp = r.marketplace || "NULL";
      acc[mp] = (acc[mp] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("Results by marketplace:");
    for (const [mp, count] of Object.entries(marketplaceCounts)) {
      console.log(`  ${mp}: ${count}`);
    }

    const lexicalCount = data.filter(r => r.lexical_rank).length;
    const vectorCount = data.filter(r => r.vector_rank).length;
    const bothCount = data.filter(r => r.lexical_rank && r.vector_rank).length;

    console.log(`\nSearch method breakdown:`);
    console.log(`  Lexical only: ${lexicalCount - bothCount}`);
    console.log(`  Vector only: ${vectorCount - bothCount}`);
    console.log(`  Both: ${bothCount}`);

  } catch (error) {
    console.error(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("DIAGNOSTIC COMPLETE");
  console.log("=".repeat(80));
}

// Main execution
const query = process.argv[2];
const marketplace = process.argv[3] || null;

if (!query) {
  console.error("Usage: tsx jobs/test-rrf-search.ts \"query text\" [marketplace]");
  console.error("\nExamples:");
  console.error("  tsx jobs/test-rrf-search.ts \"zodiac wall decal\" google");
  console.error("  tsx jobs/test-rrf-search.ts \"handmade leather\" etsy");
  console.error("  tsx jobs/test-rrf-search.ts \"vintage camera\"");
  process.exit(1);
}

testRRFSearch(query, marketplace).catch((error) => {
  console.error("[FATAL ERROR]", error);
  process.exit(1);
});
