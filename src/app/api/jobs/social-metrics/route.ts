/**
 * API Endpoint: Aggregate Social Metrics
 * POST /api/jobs/social-metrics
 *
 * Aggregates social metrics from all platforms into unified keyword metrics
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
    const lookbackHours = body.lookback_hours || 24;

    // Path to the CLI job
    const jobPath = path.join(process.cwd(), "jobs/social-metrics-aggregator.ts");

    // Execute the job
    const result = await new Promise<{ success: boolean; output: string; error?: string }>(
      (resolve) => {
        const env = {
          ...process.env,
          LOOKBACK_HOURS: String(lookbackHours),
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
        lookback_hours: lookbackHours,
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
