/**
 * API Endpoint: Ingest All Sources to ai_corpus
 * POST /api/jobs/ingest-corpus/all
 *
 * Triggers all ingestion jobs in sequence
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ingestMetricsToCorpus,
  ingestPredictionsToCorpus,
  ingestRisksToCorpus,
} from "@/lib/jobs/corpus-ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600; // 10 minutes

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get("authorization");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: Record<string, any> = {};

    // Run each ingestion job directly (no HTTP calls)
    try {
      results.metrics = await ingestMetricsToCorpus();
    } catch (error) {
      results.metrics = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      results.predictions = await ingestPredictionsToCorpus();
    } catch (error) {
      results.predictions = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      results.risks = await ingestRisksToCorpus();
    } catch (error) {
      results.risks = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const allSuccess = Object.values(results).every((r: any) => r.success);

    return NextResponse.json({
      success: allSuccess,
      results,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
