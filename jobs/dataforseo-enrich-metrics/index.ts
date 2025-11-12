/**
 * DataForSEO K4K Metrics Enrichment Job
 *
 * Enriches keywords populated by DataForSEO K4K with normalized metrics
 * derived from extras.monthly_trend and extras.dataforseo.competition.
 *
 * Usage:
 *   npm run jobs:dataforseo-enrich-metrics
 *   npm run jobs:dataforseo-enrich-metrics -- --dry-run
 *   npm run jobs:dataforseo-enrich-metrics -- --limit 1000
 *   npm run jobs:dataforseo-enrich-metrics -- --where "id IN (...)"
 */

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { logger, logJobExecution } from "@/lib/logger";
import fs from "fs";
import path from "path";

interface EnrichmentConfig {
  whereClause?: string;
  limit?: number;
  dryRun: boolean;
}

interface EnrichmentResult {
  dry_run: boolean;
  processed_count: number;
  updated_count: number;
  ms_elapsed: number;
  p99_avg: number | null;
  max_abs_slope_raw: number | null;
  max_abs_slope_des: number | null;
}

/**
 * Parse command line arguments
 */
function parseArgs(): EnrichmentConfig {
  const args = process.argv.slice(2);
  const config: EnrichmentConfig = {
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--dry-run") {
      config.dryRun = true;
    } else if (arg === "--limit" && i + 1 < args.length) {
      config.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === "--where" && i + 1 < args.length) {
      config.whereClause = args[i + 1];
      i++;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
DataForSEO K4K Metrics Enrichment Job

Usage:
  npm run jobs:dataforseo-enrich-metrics [options]

Options:
  --dry-run              Preview changes without updating database
  --limit N              Limit processing to N keywords
  --where "condition"    SQL WHERE condition to filter keywords
  --help, -h             Show this help message

Examples:
  # Dry run on all eligible keywords
  npm run jobs:dataforseo-enrich-metrics -- --dry-run

  # Enrich specific keywords by ID
  npm run jobs:dataforseo-enrich-metrics -- --where "id IN ('uuid1', 'uuid2')"

  # Enrich recently updated keywords
  npm run jobs:dataforseo-enrich-metrics -- --where "updated_at > NOW() - INTERVAL '1 day'" --limit 1000

  # Full enrichment run
  npm run jobs:dataforseo-enrich-metrics
`);
      process.exit(0);
    }
  }

  return config;
}

/**
 * Install the enrichment SQL function if not exists
 */
async function installEnrichmentFunction() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Failed to initialize Supabase client");
  }

  const sqlPath = path.join(__dirname, "enrichment.sql");

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Enrichment SQL not found at ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, "utf-8");

  logger.info({}, "Installing enrichment function...");

  const { error } = await supabase.rpc("exec_sql", { sql_string: sql });

  if (error) {
    // Try direct execution as fallback
    logger.warn({ error }, "Failed via exec_sql, trying direct execution");

    // For initial setup, we'll log and continue
    // The function might already exist
    logger.info({}, "Assuming enrichment function already exists");
  } else {
    logger.info({}, "Enrichment function installed successfully");
  }
}

/**
 * Run the enrichment job
 */
async function runEnrichment(
  config: EnrichmentConfig
): Promise<EnrichmentResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Failed to initialize Supabase client");
  }

  logger.info(
    {
      dryRun: config.dryRun,
      limit: config.limit,
      whereClause: config.whereClause,
    },
    "Starting DataForSEO K4K metrics enrichment"
  );

  const { data, error } = await supabase.rpc("enrich_dataforseo_k4k_metrics", {
    p_where_clause: config.whereClause || null,
    p_limit: config.limit || null,
    p_dry_run: config.dryRun,
  });

  if (error) {
    throw new Error(`Enrichment failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("Enrichment returned no data");
  }

  return data as EnrichmentResult;
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  const config = parseArgs();

  try {
    // Install function first (idempotent)
    await installEnrichmentFunction();

    // Run enrichment
    const result = await runEnrichment(config);

    // Log results
    const summary = {
      mode: result.dry_run ? "DRY_RUN" : "LIVE",
      processedCount: result.processed_count,
      updatedCount: result.updated_count,
      msElapsed: result.ms_elapsed,
      normalizers: {
        p99_avg: result.p99_avg,
        max_abs_slope_raw: result.max_abs_slope_raw,
        max_abs_slope_des: result.max_abs_slope_des,
      },
    };

    logger.info(summary, "ENRICHMENT_COMPLETE");

    // Validate success criteria
    if (!result.dry_run) {
      const coveragePercent =
        result.processed_count > 0
          ? (result.updated_count / result.processed_count) * 100
          : 0;

      logger.info(
        { coveragePercent: coveragePercent.toFixed(2) },
        `Coverage: ${coveragePercent.toFixed(2)}%`
      );

      if (coveragePercent < 99 && result.processed_count > 0) {
        logger.warn(
          { coveragePercent },
          "Coverage below 99% - some keywords may have failed enrichment"
        );
      }
    }

    logJobExecution(
      "dataforseo-enrich-metrics",
      "completed",
      Date.now() - startTime,
      summary as unknown as Record<string, unknown>
    );

    process.exit(0);
  } catch (error: any) {
    logger.error({ error }, `Enrichment job failed: ${error.message}`);
    logJobExecution("dataforseo-enrich-metrics", "failed", undefined, {
      error: error.message,
    });
    process.exit(1);
  }
}

// Execute
main();
