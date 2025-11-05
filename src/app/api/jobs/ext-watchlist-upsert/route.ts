// src/app/api/jobs/ext-watchlist-upsert/route.ts
/**
 * Background worker job to process extension watchlist upsert queue
 *
 * Runs periodically (via cron or manual trigger) to:
 * 1. Fetch unprocessed items from ext_watchlist_upsert_queue
 * 2. Upsert each term into public.keywords (golden source)
 * 3. Mark items as processed
 *
 * Idempotent: uses ON CONFLICT to avoid duplicates
 * Security: requires service role key or admin authentication
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;

interface QueueItem {
  id: number;
  user_id: string;
  market: string;
  term: string;
  normalized_term: string;
  source_url: string | null;
  enqueued_at: string;
}

/**
 * Verify admin/cron auth
 */
function verifyAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Also allow internal service role key
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
    return true;
  }

  return false;
}

async function processQueueBatch(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  items: QueueItem[]
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      // Upsert into keywords table using the existing RPC
      const { error: upsertError } = await supabase.rpc("lexy_upsert_keyword", {
        p_term: item.term,
        p_market: item.market,
        p_source: "extension_watchlist",
        p_tier: "free",
        p_method: "extension_capture",
        p_extras: {
          source_url: item.source_url,
          user_id: item.user_id,
          enqueued_at: item.enqueued_at,
        },
        p_freshness: new Date().toISOString(),
      });

      if (upsertError) {
        console.error(`Error upserting keyword ${item.term}:`, upsertError);

        // Mark as processed with error
        await supabase
          .from("ext_watchlist_upsert_queue")
          .update({
            processed_at: new Date().toISOString(),
            error_message: upsertError.message,
          })
          .eq("id", item.id);

        failed++;
        continue;
      }

      // Mark as successfully processed
      const { error: updateError } = await supabase
        .from("ext_watchlist_upsert_queue")
        .update({
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", item.id);

      if (updateError) {
        console.error(`Error marking item ${item.id} as processed:`, updateError);
      }

      processed++;
    } catch (error) {
      console.error(`Unexpected error processing item ${item.id}:`, error);
      failed++;
    }
  }

  return { processed, failed };
}

export async function POST(request: Request): Promise<NextResponse> {
  // Verify authentication
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service unavailable" },
      { status: 503 }
    );
  }

  const startTime = Date.now();

  try {
    // Fetch unprocessed items from the queue
    const { data: queueItems, error: fetchError } = await supabase
      .from("ext_watchlist_upsert_queue")
      .select("id, user_id, market, term, normalized_term, source_url, enqueued_at")
      .is("processed_at", null)
      .order("enqueued_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching queue items:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch queue items" },
        { status: 500 }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({
        status: "success",
        message: "No items to process",
        processed: 0,
        failed: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Process the batch
    const { processed, failed } = await processQueueBatch(supabase, queueItems as QueueItem[]);

    const duration = Date.now() - startTime;

    // Log job run
    await supabase.from("job_runs").insert({
      job_name: "ext_watchlist_upsert",
      status: failed === 0 ? "success" : "partial_failure",
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      records_processed: processed,
      metadata: {
        batch_size: queueItems.length,
        processed,
        failed,
        duration_ms: duration,
      },
    });

    return NextResponse.json({
      status: failed === 0 ? "success" : "partial_failure",
      message: `Processed ${processed} items, ${failed} failed`,
      processed,
      failed,
      duration_ms: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Unexpected error in ext-watchlist-upsert job:", error);

    // Log failed job run
    await supabase.from("job_runs").insert({
      job_name: "ext_watchlist_upsert",
      status: "failed",
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : "Unknown error",
      metadata: {
        duration_ms: duration,
      },
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
