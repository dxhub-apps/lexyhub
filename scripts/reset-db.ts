#!/usr/bin/env tsx

/**
 * Database Reset Script
 *
 * WARNING: This script will DELETE ALL DATA from the database.
 * Use only for local development and testing.
 *
 * Usage:
 *   npm run db:reset
 *   tsx scripts/reset-db.ts
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "../src/lib/env";
import * as readline from "readline";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || "",
  env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

async function truncateTables() {
  const tables = [
    "keyword_events",
    "keyword_stats",
    "watchlist_items",
    "watchlists",
    "etsy_serp_samples",
    "listing_keywords",
    "listing_tags",
    "listing_tag_health",
    "listings",
    "ai_suggestions",
    "ai_predictions",
    "keyword_insights_cache",
    "concept_clusters",
    "competitor_snapshot_listings",
    "competitor_snapshots",
    "trend_series",
    "embeddings",
    "keyword_seeds",
    "keywords",
    "backoffice_tasks",
    "risk_controls",
    "risk_register",
    "marketplace_accounts",
    "plan_overrides",
    "billing_subscriptions",
    "user_profiles",
  ];

  console.log("🗑️  Truncating tables...\n");

  for (const table of tables) {
    try {
      const { error } = await supabase.rpc("truncate_table", {
        table_name: table,
      });

      if (error) {
        // Try direct delete if RPC doesn't exist
        const { error: deleteError, count } = await supabase
          .from(table)
          .delete()
          .neq("id", 0); // Delete all rows

        if (deleteError) {
          console.log(`⏭️  Skipping ${table}: ${deleteError.message}`);
        } else {
          console.log(`✅ Truncated ${table} (${count || 0} rows)`);
        }
      } else {
        console.log(`✅ Truncated ${table}`);
      }
    } catch (err) {
      console.log(`⏭️  Skipping ${table}:`, err);
    }
  }
}

async function main() {
  console.log("⚠️  DATABASE RESET SCRIPT\n");
  console.log("This will DELETE ALL DATA from your database.");
  console.log("This action CANNOT be undone.\n");

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase credentials in environment");
    process.exit(1);
  }

  // Safety check - only allow on localhost
  if (env.NEXT_PUBLIC_SUPABASE_URL.includes("localhost") ||
      env.NEXT_PUBLIC_SUPABASE_URL.includes("127.0.0.1")) {
    console.log("✅ Running on localhost\n");
  } else {
    console.error("❌ This script can only run on localhost for safety.");
    console.error("   If you need to reset a remote database, do it manually.\n");
    process.exit(1);
  }

  const confirmed = await confirm(
    "Type 'yes' to continue with database reset: "
  );

  if (!confirmed) {
    console.log("\n❌ Database reset cancelled");
    process.exit(0);
  }

  console.log("\n🔄 Starting database reset...\n");

  try {
    await truncateTables();

    console.log("\n✅ Database reset completed successfully!");
    console.log("\n💡 Run 'npm run db:seed' to populate with sample data");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Database reset failed:", error);
    process.exit(1);
  }
}

main();
