#!/usr/bin/env tsx
/**
 * Verification script to check corpus ingestion state
 */

import { getSupabaseServerClient } from "@/lib/supabase-server";

async function main() {
  console.log("=== CORPUS INGESTION VERIFICATION ===\n");

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.error("❌ Failed to initialize Supabase client");
    process.exit(1);
  }

  // Check ai_corpus population
  console.log("1. Checking ai_corpus table...");
  const { data: corpusData, error: corpusError } = await supabase
    .from("ai_corpus")
    .select("id, source_type, pg_typeof(embedding)", { count: "exact", head: false })
    .limit(5);

  if (corpusError) {
    console.error(`   ❌ Error querying ai_corpus: ${corpusError.message}`);
  } else {
    console.log(`   ✓ ai_corpus table accessible`);
    console.log(`   Rows: ${corpusData?.length || 0}`);
    if (corpusData && corpusData.length > 0) {
      console.log(`   Sample source types:`, corpusData.map(d => d.source_type));
    }
  }

  // Check ai_corpus count by source_type
  console.log("\n2. Checking ai_corpus by source type...");
  const { data: countData, error: countError } = await supabase
    .from("ai_corpus")
    .select("source_type", { count: "exact", head: false });

  if (countError) {
    console.error(`   ❌ Error: ${countError.message}`);
  } else {
    const counts = countData?.reduce((acc, row) => {
      acc[row.source_type] = (acc[row.source_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`   Total rows: ${countData?.length || 0}`);
    console.log(`   By type:`, counts);
  }

  // Check raw_sources for DataForSEO
  console.log("\n3. Checking raw_sources table...");
  const { data: rawData, error: rawError } = await supabase
    .from("raw_sources")
    .select("id, provider, source_type, status", { count: "exact" })
    .eq("provider", "dataforseo")
    .limit(10);

  if (rawError) {
    console.error(`   ❌ Error: ${rawError.message}`);
  } else {
    console.log(`   ✓ Found ${rawData?.length || 0} DataForSEO entries`);
    if (rawData && rawData.length > 0) {
      const statusCounts = rawData.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`   Status counts:`, statusCounts);
    }
  }

  // Check ai_failures
  console.log("\n4. Checking ai_failures for recent errors...");
  const { data: failuresData, error: failuresError } = await supabase
    .from("ai_failures")
    .select("type, error_code, error_message")
    .gte("ts", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("ts", { ascending: false })
    .limit(20);

  if (failuresError) {
    console.error(`   ❌ Error: ${failuresError.message}`);
  } else {
    console.log(`   Found ${failuresData?.length || 0} failures in last 7 days`);
    if (failuresData && failuresData.length > 0) {
      const errorGroups = failuresData.reduce((acc, row) => {
        const key = `${row.type}: ${row.error_message}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`   Error types:`);
      Object.entries(errorGroups).slice(0, 5).forEach(([msg, count]) => {
        console.log(`     - ${msg} (${count}x)`);
      });
    }
  }

  // Check environment variables
  console.log("\n5. Checking environment configuration...");
  const hasDataForSeoLogin = !!process.env.DATAFORSEO_LOGIN;
  const hasDataForSeoPassword = !!process.env.DATAFORSEO_PASSWORD;
  const hasHfToken = !!process.env.HF_TOKEN;

  console.log(`   DATAFORSEO_LOGIN: ${hasDataForSeoLogin ? "✓ Set" : "❌ Missing"}`);
  console.log(`   DATAFORSEO_PASSWORD: ${hasDataForSeoPassword ? "✓ Set" : "❌ Missing"}`);
  console.log(`   HF_TOKEN: ${hasHfToken ? "✓ Set" : "⚠ Missing (will use deterministic fallback)"}`);

  console.log("\n=== VERIFICATION COMPLETE ===");
}

main().catch(console.error);
