#!/usr/bin/env node
// jobs/watchlist-momentum-monitor.ts
// Monitors keywords on user watchlists for momentum changes and creates notifications

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MOMENTUM_THRESHOLD = parseFloat(process.env.MOMENTUM_THRESHOLD || "15.0");
const COOLING_THRESHOLD = parseFloat(process.env.COOLING_THRESHOLD || "-10.0");

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const runId = crypto.randomUUID();
  const runStarted = new Date().toISOString();

  console.log(`[${runStarted}] Starting watchlist momentum monitor ${runId}`);

  try {
    // Check if feature is enabled
    const { data: featureFlag } = await supabase
      .from("feature_flags")
      .select("is_enabled")
      .eq("key", "watchlist_alerts")
      .maybeSingle();

    if (!featureFlag || !featureFlag.is_enabled) {
      console.log("[INFO] Watchlist alerts disabled by feature flag");
      return;
    }

    // Get all watched keywords with their current metrics
    const { data: watchedKeywords, error: watchedError } = await supabase
      .from("user_keyword_watchlists")
      .select(`
        id,
        user_id,
        keyword_id,
        alert_threshold,
        keywords (
          id,
          term,
          trend_momentum,
          adjusted_demand_index,
          competition_score
        )
      `);

    if (watchedError) {
      throw new Error(`Failed to fetch watched keywords: ${watchedError.message}`);
    }

    if (!watchedKeywords || watchedKeywords.length === 0) {
      console.log("[INFO] No watched keywords found");
      return;
    }

    console.log(`[INFO] Monitoring ${watchedKeywords.length} watched keywords`);

    let surgeAlerts = 0;
    let coolingAlerts = 0;

    for (const watch of watchedKeywords) {
      const keyword = watch.keywords as any;
      if (!keyword) continue;

      const momentum = keyword.trend_momentum || 0;
      const threshold = watch.alert_threshold || MOMENTUM_THRESHOLD;

      // Check for surge
      if (momentum > threshold) {
        await createNotification(supabase, {
          user_id: watch.user_id,
          type: "keyword_surge",
          title: "🚀 Keyword Surge Detected",
          message: `"${keyword.term}" is trending up with ${momentum.toFixed(1)}% momentum!`,
          keyword_id: keyword.id,
          metadata: {
            momentum,
            demand_index: keyword.adjusted_demand_index,
            competition: keyword.competition_score,
          },
        });
        surgeAlerts++;
      }

      // Check for cooling
      if (momentum < COOLING_THRESHOLD) {
        await createNotification(supabase, {
          user_id: watch.user_id,
          type: "keyword_cooling",
          title: "📉 Keyword Cooling Down",
          message: `"${keyword.term}" momentum dropped to ${momentum.toFixed(1)}%. Consider adjusting strategy.`,
          keyword_id: keyword.id,
          metadata: {
            momentum,
            demand_index: keyword.adjusted_demand_index,
            competition: keyword.competition_score,
          },
        });
        coolingAlerts++;
      }
    }

    console.log(`[INFO] Created ${surgeAlerts} surge alerts and ${coolingAlerts} cooling alerts`);

    await logRun(supabase, runId, "success", watchedKeywords.length, surgeAlerts + coolingAlerts);

    console.log(`[INFO] Watchlist momentum monitor ${runId} completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Watchlist momentum monitor failed: ${errorMessage}`);
    await logRun(supabase, runId, "error", 0, 0, errorMessage);
    process.exit(1);
  }
}

async function createNotification(
  supabase: any,
  notification: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    keyword_id?: string;
    metadata?: any;
  }
) {
  // Check if similar notification exists in last 24 hours (avoid spam)
  const yesterday = new Date(Date.now() - 24 * 3600000).toISOString();

  const { data: existing } = await supabase
    .from("user_notifications")
    .select("id")
    .eq("user_id", notification.user_id)
    .eq("notification_type", notification.type)
    .eq("metadata->>keyword_id", notification.keyword_id)
    .gte("created_at", yesterday)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`[INFO] Skipping duplicate notification for user ${notification.user_id}`);
    return;
  }

  // Create notification
  const { error } = await supabase.from("user_notifications").insert({
    user_id: notification.user_id,
    notification_type: notification.type,
    title: notification.title,
    message: notification.message,
    metadata: {
      keyword_id: notification.keyword_id,
      ...notification.metadata,
    },
  });

  if (error) {
    console.warn(`[WARN] Failed to create notification: ${error.message}`);
  }
}

async function logRun(
  supabase: any,
  runId: string,
  status: string,
  keywordsMonitored: number,
  alertsCreated: number,
  error: string | null = null
) {
  await supabase.from("job_runs").insert({
    id: runId,
    job_name: "watchlist-momentum-monitor",
    status,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    metadata: {
      keywords_monitored: keywordsMonitored,
      alerts_created: alertsCreated,
      momentum_threshold: MOMENTUM_THRESHOLD,
      cooling_threshold: COOLING_THRESHOLD,
      error,
    },
  });
}

main();
