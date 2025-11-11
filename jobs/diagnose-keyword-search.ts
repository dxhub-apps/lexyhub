/**
 * Diagnostic Script: Keyword Search Issue
 *
 * This script helps diagnose why a keyword exists in both public.keywords
 * and public.ai_corpus but still returns "No reliable data" when searched.
 *
 * Usage:
 *   tsx jobs/diagnose-keyword-search.ts "your keyword term"
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

async function diagnoseKeywordSearch(searchTerm: string) {
  console.log("=".repeat(80));
  console.log("KEYWORD SEARCH DIAGNOSTIC");
  console.log("=".repeat(80));
  console.log(`\nSearch term: "${searchTerm}"\n`);

  // Step 1: Check if keyword exists in public.keywords
  console.log("Step 1: Checking public.keywords table...");
  const { data: keywords, error: keywordsError } = await supabase
    .from("keywords")
    .select("id, term, market, source, extras, demand_index, competition_score")
    .ilike("term", `%${searchTerm}%`)
    .limit(10);

  if (keywordsError) {
    console.error(`[ERROR] Failed to query keywords: ${keywordsError.message}`);
    return;
  }

  if (!keywords || keywords.length === 0) {
    console.log(`❌ No keywords found matching "${searchTerm}"`);
    console.log("\n✅ DIAGNOSIS: Keyword doesn't exist in public.keywords table");
    console.log("   ACTION: Add the keyword to the keywords table first");
    return;
  }

  console.log(`✅ Found ${keywords.length} matching keyword(s):`);
  for (const kw of keywords) {
    console.log(`   - ID: ${kw.id}`);
    console.log(`     Term: "${kw.term}"`);
    console.log(`     Market: ${kw.market || "NULL"}`);
    console.log(`     Source: ${kw.source}`);
    console.log(`     Demand Index: ${kw.demand_index || "NULL"}`);
    console.log(`     Competition Score: ${kw.competition_score || "NULL"}`);
    console.log(`     Has DataForSEO data: ${kw.extras?.dataforseo ? "Yes" : "No"}`);
  }

  // Step 2: Check if keyword exists in public.ai_corpus
  console.log("\nStep 2: Checking public.ai_corpus table...");
  const { data: corpusRecords, error: corpusError } = await supabase
    .from("ai_corpus")
    .select("id, source_type, owner_scope, marketplace, is_active, embedding, chunk")
    .or(
      keywords
        .map((kw) => `source_ref->>keyword_id.eq.${kw.id},chunk.ilike.%${kw.term}%`)
        .join(",")
    )
    .limit(50);

  if (corpusError) {
    console.error(`[ERROR] Failed to query ai_corpus: ${corpusError.message}`);
    return;
  }

  if (!corpusRecords || corpusRecords.length === 0) {
    console.log(`❌ No records found in ai_corpus for this keyword`);
    console.log("\n✅ DIAGNOSIS: Keyword exists in public.keywords but NOT in public.ai_corpus");
    console.log("   ACTION: Run corpus ingestion jobs:");
    console.log("     1. npm run jobs:ingest-metrics");
    console.log("     2. npm run jobs:ingest-metrics-to-corpus");
    return;
  }

  console.log(`✅ Found ${corpusRecords.length} matching ai_corpus record(s):`);
  let activeCount = 0;
  let withEmbeddingCount = 0;
  for (const record of corpusRecords) {
    console.log(`   - ID: ${record.id}`);
    console.log(`     Source Type: ${record.source_type}`);
    console.log(`     Owner Scope: ${record.owner_scope}`);
    console.log(`     Marketplace: ${record.marketplace || "NULL"}`);
    console.log(`     Is Active: ${record.is_active}`);
    console.log(`     Has Embedding: ${record.embedding ? "Yes" : "No"}`);
    console.log(`     Chunk Preview: ${record.chunk.substring(0, 100)}...`);

    if (record.is_active) activeCount++;
    if (record.embedding) withEmbeddingCount++;
  }

  if (activeCount === 0) {
    console.log(`\n❌ All corpus records are inactive (is_active = false)`);
    console.log("✅ DIAGNOSIS: Records exist but are marked as inactive");
    console.log("   ACTION: Update records to set is_active = true");
    return;
  }

  if (withEmbeddingCount === 0) {
    console.log(`\n❌ No corpus records have embeddings`);
    console.log("✅ DIAGNOSIS: Records exist but embeddings are NULL");
    console.log("   ACTION: Re-run corpus ingestion jobs to generate embeddings");
    return;
  }

  console.log(`\n✅ Active records: ${activeCount}/${corpusRecords.length}`);
  console.log(`✅ Records with embeddings: ${withEmbeddingCount}/${corpusRecords.length}`);

  // Step 3: Test the RRF search function
  console.log("\nStep 3: Testing ai_corpus_rrf_search function...");

  try {
    const embedding = await createSemanticEmbedding(searchTerm);
    console.log(`✅ Generated embedding for query (dimension: ${embedding.length})`);

    const { data: searchResults, error: searchError } = await supabase.rpc(
      "ai_corpus_rrf_search",
      {
        p_query: searchTerm,
        p_query_embedding: embedding,
        p_capability: "ask_anything",
        p_marketplace: keywords[0]?.market || null,
        p_language: null,
        p_limit: 40,
      }
    );

    if (searchError) {
      console.error(`[ERROR] RRF search failed: ${searchError.message}`);
      return;
    }

    if (!searchResults || searchResults.length === 0) {
      console.log(`❌ RRF search returned NO results`);
      console.log("\n✅ DIAGNOSIS: The search function is not finding the corpus data");
      console.log("   Possible causes:");
      console.log("   1. Marketplace filter mismatch");
      console.log("   2. Lexical search is failing (chunk_tsv doesn't match query)");
      console.log("   3. Vector similarity too low");
      console.log("   4. Embeddings incompatible (different models used)");
      console.log("\n   ACTION: Check the following:");
      console.log(`     - Keyword marketplace: ${keywords[0]?.market || "NULL"}`);
      console.log(`     - Corpus marketplace: ${corpusRecords[0]?.marketplace || "NULL"}`);
      console.log("     - Run: SELECT chunk_tsv FROM ai_corpus WHERE id = '<corpus_id>'");
      return;
    }

    console.log(`✅ RRF search returned ${searchResults.length} result(s)`);
    console.log("\nTop 5 results:");
    for (let i = 0; i < Math.min(5, searchResults.length); i++) {
      const result = searchResults[i];
      console.log(`   ${i + 1}. Combined Score: ${result.combined_score?.toFixed(4)}`);
      console.log(`      Source Type: ${result.source_type}`);
      console.log(`      Lexical Rank: ${result.lexical_rank || "NULL"}`);
      console.log(`      Vector Rank: ${result.vector_rank || "NULL"}`);
      console.log(`      Chunk: ${result.chunk.substring(0, 80)}...`);
    }

    // Step 4: Check if results meet the threshold
    if (searchResults.length < 5) {
      console.log(`\n❌ INSUFFICIENT CONTEXT: Only ${searchResults.length} result(s) found`);
      console.log("✅ DIAGNOSIS: The search returns results but FEWER than 5");
      console.log("   This triggers the 'No reliable data' error (threshold: 5 sources)");
      console.log("\n   Root cause: Not enough related content in ai_corpus");
      console.log("   ACTION: Ingest more data into ai_corpus:");
      console.log("     1. Metrics: npm run jobs:ingest-metrics-to-corpus");
      console.log("     2. Predictions: npm run jobs:ingest-predictions-to-corpus");
      console.log("     3. Risks: npm run jobs:ingest-risks-to-corpus");
      console.log("     4. Docs: npm run jobs:ingest-docs-to-corpus");
      console.log("\n   ALTERNATIVE: Lower the threshold in route.ts (line 184)");
      console.log("     Change: const insufficientContext = rankedSources.length < 5;");
      console.log("     To:     const insufficientContext = rankedSources.length < 1;");
    } else {
      console.log(`\n✅ SUFFICIENT CONTEXT: ${searchResults.length} results found (threshold: 5)`);
      console.log("✅ DIAGNOSIS: The search should work! Investigate other issues:");
      console.log("   - Authentication/permissions");
      console.log("   - Quota limits");
      console.log("   - API endpoint issues");
    }
  } catch (error) {
    console.error(`[ERROR] Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
    console.log("\n✅ DIAGNOSIS: Cannot generate embeddings for search");
    console.log("   ACTION: Check HuggingFace API token and connection");
  }

  console.log("\n" + "=".repeat(80));
  console.log("DIAGNOSTIC COMPLETE");
  console.log("=".repeat(80));
}

// Main execution
const searchTerm = process.argv[2];

if (!searchTerm) {
  console.error("Usage: tsx jobs/diagnose-keyword-search.ts \"your keyword term\"");
  process.exit(1);
}

diagnoseKeywordSearch(searchTerm).catch((error) => {
  console.error("[FATAL ERROR]", error);
  process.exit(1);
});
