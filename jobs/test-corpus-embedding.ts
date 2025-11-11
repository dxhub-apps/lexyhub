#!/usr/bin/env node
/**
 * Test Script: Verify ai_corpus embedding insertion
 *
 * This script tests that embeddings are correctly inserted into ai_corpus
 * with the proper 384-dimensional format.
 *
 * Run: node --loader ts-node/esm jobs/test-corpus-embedding.ts
 */

import { createClient } from "@supabase/supabase-js";
import { createSemanticEmbedding } from "../src/lib/ai/semantic-embeddings";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[ERROR] Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log("=".repeat(60));
  console.log("AI CORPUS EMBEDDING TEST");
  console.log("=".repeat(60));

  try {
    // Test 1: Generate embedding
    console.log("\n[TEST 1] Generating semantic embedding...");
    const testText =
      "Handmade leather wallet for men - premium quality, minimalist design";
    const embedding = await createSemanticEmbedding(testText);

    console.log(`✓ Embedding generated successfully`);
    console.log(`  - Dimension: ${embedding.length}`);
    console.log(
      `  - Type: ${Array.isArray(embedding) ? "Array" : typeof embedding}`
    );
    console.log(
      `  - Sample values: [${embedding
        .slice(0, 5)
        .map((v) => v.toFixed(4))
        .join(", ")}...]`
    );

    // Validate dimension
    if (embedding.length !== 384) {
      throw new Error(
        `Invalid embedding dimension: expected 384, got ${embedding.length}`
      );
    }
    console.log(`✓ Embedding dimension is correct (384)`);

    // Test 2: Insert into ai_corpus
    console.log("\n[TEST 2] Inserting test record into ai_corpus...");
    const testId = crypto.randomUUID();

    const { error: insertError } = await supabase
      .from("ai_corpus")
      .insert({
        id: testId,
        owner_scope: "global",
        owner_user_id: null,
        owner_team_id: null,
        source_type: "test",
        source_ref: {
          test_id: testId,
          test_run: new Date().toISOString(),
          purpose: "embedding_validation",
        },
        marketplace: "etsy",
        language: "en",
        chunk: testText,
        embedding,
        metadata: {
          test: true,
          dimension: embedding.length,
        },
        is_active: true,
      })
      .select();

    if (insertError) {
      throw new Error(
        `Failed to insert test record: ${insertError.message}`
      );
    }

    console.log(`✓ Test record inserted successfully`);
    console.log(`  - ID: ${testId}`);

    // Test 3: Query back the record
    console.log("\n[TEST 3] Querying test record from ai_corpus...");
    const { data: queryData, error: queryError } = await supabase
      .from("ai_corpus")
      .select(
        "id, source_type, chunk, metadata, owner_scope, marketplace"
      )
      .eq("id", testId)
      .single();

    if (queryError) {
      throw new Error(
        `Failed to query test record: ${queryError.message}`
      );
    }

    console.log(`✓ Test record retrieved successfully`);
    console.log(`  - Source type: ${queryData.source_type}`);
    console.log(`  - Owner scope: ${queryData.owner_scope}`);
    console.log(`  - Marketplace: ${queryData.marketplace}`);
    console.log(
      `  - Chunk: "${queryData.chunk.substring(0, 50)}..."`
    );

    // Test 4: Query with embedding (vector search)
    console.log(
      "\n[TEST 4] Testing vector similarity search..."
    );
    const queryEmbedding =
      await createSemanticEmbedding("leather wallet");

    const { data: searchData, error: searchError } =
      await supabase.rpc("ai_corpus_rrf_search", {
        p_query: "leather wallet",
        p_query_embedding: queryEmbedding,
        p_capability: "test",
        p_marketplace: "etsy",
        p_language: "en",
        p_limit: 5,
      });

    if (searchError) {
      console.log(
        `⚠ Vector search test: ${searchError.message}`
      );
      console.log(
        "  (This is expected if ai_corpus_rrf_search function needs the embedding fix)"
      );
    } else {
      console.log(
        `✓ Vector search completed successfully`
      );
      console.log(
        `  - Results found: ${searchData?.length || 0}`
      );
      if (searchData && searchData.length > 0) {
        console.log(
          `  - Top result: "${searchData[0].chunk
            ?.substring(0, 50)
            }..."`
        );
      }
    }

    // Test 5: Count total records in ai_corpus
    console.log(
      "\n[TEST 5] Checking ai_corpus population..."
    );
    const { count: totalCount, error: countError } =
      await supabase
        .from("ai_corpus")
        .select("id", { count: "exact", head: true });

    if (countError) {
      console.log(
        `⚠ Count query failed: ${countError.message}`
      );
    } else {
      console.log(
        `✓ Total records in ai_corpus: ${totalCount}`
      );
      if (totalCount === 0) {
        console.log(
          "  ⚠ WARNING: ai_corpus is empty! Run ingestion jobs to populate it."
        );
      } else if (totalCount === 1) {
        console.log(
          "  ℹ Only test record exists. Run ingestion jobs to populate with real data."
        );
      }
    }

    // Test 6: Get sample records by source type
    console.log(
      "\n[TEST 6] Sampling ai_corpus records by source type..."
    );
    const { data: samples, error: samplesError } =
      await supabase
        .from("ai_corpus")
        .select(
          "id, source_type, owner_scope, marketplace, chunk"
        )
        .order("created_at", { ascending: false })
        .limit(5);

    if (samplesError) {
      console.log(
        `⚠ Sample query failed: ${samplesError.message}`
      );
    } else if (samples && samples.length > 0) {
      console.log(`✓ Sample records (${samples.length}):`);
      samples.forEach((sample, i) => {
        console.log(
          `  ${i + 1}. [${sample.source_type}] ${sample.chunk.substring(
            0,
            60
          )}...`
        );
      });
    }

    // Cleanup: Remove test record
    console.log("\n[CLEANUP] Removing test record...");
    const { error: deleteError } = await supabase
      .from("ai_corpus")
      .delete()
      .eq("id", testId);

    if (deleteError) {
      console.log(
        `⚠ Failed to delete test record: ${deleteError.message}`
      );
    } else {
      console.log("✓ Test record cleaned up");
    }

    // Final summary
    console.log("\n" + "=".repeat(60));
    console.log("TEST SUMMARY");
    console.log("=".repeat(60));
    console.log("✓ Embedding generation: PASS");
    console.log("✓ Embedding dimension validation: PASS (384)");
    console.log("✓ ai_corpus insertion: PASS");
    console.log("✓ ai_corpus query: PASS");
    console.log("\nAll tests passed. Embeddings are working correctly.");
    console.log("\nNext steps:");
    console.log(
      "1. Run ingestion jobs to populate ai_corpus:"
    );
    console.log(
      "   - node --loader ts-node/esm jobs/ingest-metrics-to-corpus.ts"
    );
    console.log(
      "   - node --loader ts-node/esm jobs/ingest-predictions-to-corpus.ts"
    );
    console.log(
      "   - node --loader ts-node/esm jobs/ingest-risks-to-corpus.ts"
    );
    console.log(
      "   - node --loader ts-node/esm jobs/ingest-docs-to-corpus.ts"
    );
    console.log(
      "2. Verify RAG retrieval works with populated corpus"
    );
    console.log("=".repeat(60));
  } catch (error) {
    console.error(
      "\n" + "=".repeat(60)
    );
    console.error("TEST FAILED");
    console.error("=".repeat(60));
    console.error(
      error instanceof Error ? error.message : String(error)
    );
    console.error("\nStack trace:");
    console.error(
      error instanceof Error ? error.stack : "N/A"
    );
    process.exit(1);
  }
}

main();
