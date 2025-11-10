/**
 * API Endpoint: Trigger Job Manually
 * POST /api/admin/jobs/trigger
 *
 * Manually triggers a background job
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600; // 10 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, parameters } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    // Build the full URL
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const jobUrl = `${baseUrl}${endpoint}`;

    // Use service role key for authentication
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing service role key" },
        { status: 500 }
      );
    }

    // Trigger the job
    const response = await fetch(jobUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parameters || {}),
    });

    const result = await response.json();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
