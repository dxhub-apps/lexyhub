/**
 * API Endpoint: Ingest All Sources to ai_corpus
 * POST /api/jobs/ingest-corpus/all
 *
 * Triggers all ingestion jobs in sequence
 */

import { NextRequest, NextResponse } from "next/server";

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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const results: Record<string, any> = {};

    // Run each ingestion job
    const jobs = ["metrics", "predictions", "risks"];

    for (const job of jobs) {
      try {
        const response = await fetch(`${baseUrl}/api/jobs/ingest-corpus/${job}`, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json",
          },
        });

        results[job] = await response.json();
      } catch (error) {
        results[job] = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
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
