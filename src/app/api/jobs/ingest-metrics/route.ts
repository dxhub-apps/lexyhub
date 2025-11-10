/**
 * API Endpoint: Ingest Metrics and Score
 * POST /api/jobs/ingest-metrics
 *
 * Collects metrics for active keywords and computes demand indices
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

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

    // Parse optional parameters from request body
    const body = await request.json().catch(() => ({}));
    const lookbackDays = body.lookback_days || 7;
    const country = body.country || "global";

    // Path to the CLI job
    const jobPath = path.join(process.cwd(), "jobs/ingest_metrics_and_score.ts");

    // Execute the job
    const result = await new Promise<{ success: boolean; output: string; error?: string }>(
      (resolve) => {
        const env = {
          ...process.env,
          LOOKBACK_DAYS: String(lookbackDays),
          COUNTRY: country,
        };

        const child = spawn("tsx", [jobPath], { env });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          if (code === 0) {
            resolve({ success: true, output: stdout });
          } else {
            resolve({
              success: false,
              output: stdout,
              error: stderr || `Process exited with code ${code}`,
            });
          }
        });

        child.on("error", (error) => {
          resolve({
            success: false,
            output: stdout,
            error: error.message,
          });
        });
      }
    );

    return NextResponse.json({
      success: result.success,
      output: result.output,
      error: result.error,
      duration: Date.now() - startTime,
      parameters: {
        lookback_days: lookbackDays,
        country,
      },
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
