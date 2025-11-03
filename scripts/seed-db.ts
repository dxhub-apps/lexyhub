#!/usr/bin/env tsx

/**
 * Database Seeding Script
 *
 * Seeds the database with sample data for development and testing.
 *
 * Usage:
 *   npm run db:seed
 *   tsx scripts/seed-db.ts
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "../src/lib/env";

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

async function seedFeatureFlags() {
  console.log("📝 Seeding feature flags...");

  const flags = [
    { key: "require_official_etsy_api", is_enabled: false },
    { key: "allow_search_sampling", is_enabled: true },
    { key: "allow_user_telemetry", is_enabled: false },
  ];

  for (const flag of flags) {
    const { error } = await supabase
      .from("feature_flags")
      .upsert(flag, { onConflict: "key" });

    if (error) {
      console.error(`❌ Error seeding feature flag ${flag.key}:`, error.message);
    } else {
      console.log(`✅ Feature flag ${flag.key}: ${flag.is_enabled}`);
    }
  }
}

async function seedSampleKeywords() {
  console.log("\n📝 Seeding sample keywords...");

  const keywords = [
    {
      term: "handmade jewelry",
      demand_score: 85,
      competition_score: 65,
      trend_momentum: 0.15,
    },
    {
      term: "custom wedding gifts",
      demand_score: 78,
      competition_score: 55,
      trend_momentum: 0.22,
    },
    {
      term: "vintage home decor",
      demand_score: 92,
      competition_score: 72,
      trend_momentum: 0.08,
    },
    {
      term: "personalized pet accessories",
      demand_score: 68,
      competition_score: 48,
      trend_momentum: 0.31,
    },
    {
      term: "organic skincare products",
      demand_score: 95,
      competition_score: 88,
      trend_momentum: 0.12,
    },
  ];

  let inserted = 0;
  for (const keyword of keywords) {
    const { error } = await supabase
      .from("keywords")
      .insert(keyword)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Duplicate key
        console.log(`⏭️  Keyword "${keyword.term}" already exists`);
      } else {
        console.error(`❌ Error seeding keyword ${keyword.term}:`, error.message);
      }
    } else {
      inserted++;
      console.log(`✅ Keyword "${keyword.term}"`);
    }
  }

  console.log(`\n📊 Inserted ${inserted}/${keywords.length} keywords`);
}

async function seedBillingPlans() {
  console.log("\n📝 Seeding billing plans...");

  const plans = [
    {
      key: "free",
      name: "Free",
      daily_query_limit: 10,
      watchlist_limit: 1,
      watchlist_item_capacity: 10,
      ai_suggestion_limit: 5,
      price_cents: 0,
    },
    {
      key: "growth",
      name: "Growth",
      daily_query_limit: 100,
      watchlist_limit: 5,
      watchlist_item_capacity: 50,
      ai_suggestion_limit: 50,
      price_cents: 2900,
    },
    {
      key: "scale",
      name: "Scale",
      daily_query_limit: 1000,
      watchlist_limit: 20,
      watchlist_item_capacity: 200,
      ai_suggestion_limit: 200,
      price_cents: 9900,
    },
  ];

  for (const plan of plans) {
    const { error } = await supabase
      .from("billing_plans")
      .upsert(plan, { onConflict: "key" });

    if (error) {
      console.error(`❌ Error seeding plan ${plan.key}:`, error.message);
    } else {
      console.log(`✅ Plan "${plan.name}" - $${plan.price_cents / 100}/mo`);
    }
  }
}

async function seedBackofficeTaskStatuses() {
  console.log("\n📝 Seeding backoffice task statuses...");

  const statuses = [
    { key: "todo", label: "To Do", color: "gray", sort_order: 1 },
    { key: "in_progress", label: "In Progress", color: "blue", sort_order: 2 },
    { key: "blocked", label: "Blocked", color: "red", sort_order: 3 },
    { key: "review", label: "In Review", color: "yellow", sort_order: 4 },
    { key: "done", label: "Done", color: "green", sort_order: 5 },
  ];

  for (const status of statuses) {
    const { error } = await supabase
      .from("backoffice_task_statuses")
      .upsert(status, { onConflict: "key" });

    if (error) {
      console.error(`❌ Error seeding status ${status.key}:`, error.message);
    } else {
      console.log(`✅ Status "${status.label}"`);
    }
  }
}

async function main() {
  console.log("🌱 Starting database seeding...\n");

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase credentials in environment");
    process.exit(1);
  }

  try {
    await seedFeatureFlags();
    await seedSampleKeywords();
    await seedBillingPlans();
    await seedBackofficeTaskStatuses();

    console.log("\n✅ Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Database seeding failed:", error);
    process.exit(1);
  }
}

main();
