// src/app/api/jobs/ext-watchlist-upsert/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const BATCH_SIZE = 1000;
const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";

export async function POST(request: Request): Promise<NextResponse> {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  try {
    console.log("[ext-watchlist-upsert] Starting job...");

    // Fetch unprocessed queue items
    const { data: queueItems, error: fetchError } = await supabase
      .from("ext_watchlist_upsert_queue")
      .select("*")
      .is("processed_at", null)
      .order("enqueued_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching queue items:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch queue" },
        { status: 500 }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      console.log("[ext-watchlist-upsert] No items to process");
      return NextResponse.json({ processed: 0 });
    }

    console.log(\`[ext-watchlist-upsert] Processing \${queueItems.length} items\`);

    let processed = 0;
    let errors = 0;

    // Process each item
    for (const item of queueItems) {
      try {
        // Normalize term
        const normalizedTerm = item.term.toLowerCase().trim().replace(/\s+/g, " ");

        // Check if keyword exists
        const { data: existing, error: selectError } = await supabase
          .from("keywords")
          .select("id")
          .eq("term_normalized", normalizedTerm)
          .eq("market", item.market)
          .maybeSingle();

        if (selectError && selectError.code !== 'PGRST116') {
          throw selectError;
        }

        if (existing) {
          // Update freshness
          const { error: updateError } = await supabase
            .from("keywords")
            .update({ freshness_ts: new Date().toISOString() })
            .eq("id", existing.id);

          if (updateError) throw updateError;
        } else {
          // Insert new keyword
          const { error: insertError } = await supabase
            .from("keywords")
            .insert({
              term: item.term,
              term_normalized: normalizedTerm,
              market: item.market,
              source: "extension_watchlist",
              tier: "free",
              freshness_ts: new Date().toISOString(),
            });

          if (insertError && insertError.code !== '23505') {
            throw insertError;
          }
        }

        // Mark as processed
        await supabase
          .from("ext_watchlist_upsert_queue")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", item.id);

        processed++;
      } catch (error: any) {
        console.error(\`Error processing queue item \${item.id}:\`, error);

        // Mark as failed
        await supabase
          .from("ext_watchlist_upsert_queue")
          .update({
            processed_at: new Date().toISOString(),
            error_message: error.message || "Unknown error",
          })
          .eq("id", item.id);

        errors++;
      }
    }

    console.log(\`[ext-watchlist-upsert] Completed: \${processed} processed, \${errors} errors\`);

    return NextResponse.json({
      processed,
      errors,
      total: queueItems.length,
    });
  } catch (error) {
    console.error("Unexpected error in ext-watchlist-upsert job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
