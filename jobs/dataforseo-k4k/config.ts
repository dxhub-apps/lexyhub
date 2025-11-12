import { z } from "zod";
import type { IngestConfig } from "./types";

const configSchema = z.object({
  // DataForSEO credentials (REQUIRED)
  dataforSeoLogin: z.string().min(1, "DATAFORSEO_LOGIN is required"),
  dataforSeoPassword: z.string().min(1, "DATAFORSEO_PASSWORD is required"),

  // Database connection (prefer Supabase)
  pgHost: z.string().optional(),
  pgPort: z.coerce.number().int().positive().optional(),
  pgDatabase: z.string().optional(),
  pgUser: z.string().optional(),
  pgPassword: z.string().optional(),
  pgSsl: z.boolean().default(true),

  supabaseUrl: z.string().url().optional(),
  supabaseServiceKey: z.string().optional(),

  // Business logic defaults
  lexyHubMarket: z.string().default("us"),
  defaultLanguageCode: z.string().default("en"),
  defaultLocationCode: z.string().default("2840"),

  // K4K task parameters
  k4kMaxTermsPerTask: z.coerce.number().int().min(1).max(20).default(20),
  k4kDevice: z.enum(["desktop", "mobile", "tablet"]).default("desktop"),
  k4kSearchPartners: z.boolean().default(false),
  k4kIncludeAdult: z.boolean().default(false),

  // Batch and concurrency limits
  batchMaxSeeds: z.coerce.number().int().min(1).max(50000).default(5000),
  concurrencyTaskPost: z.coerce.number().int().min(1).max(50).default(20),
  concurrencyTaskGet: z.coerce.number().int().min(1).max(50).default(20),

  // Polling configuration
  pollIntervalMs: z.coerce.number().int().min(1000).default(4000),
  pollTimeoutMs: z.coerce.number().int().min(10000).default(900000),

  // Execution control
  dryRun: z.boolean().default(false),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

function parseBool(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (!value) return false;
  return value.toLowerCase() === "true" || value === "1";
}

export function loadConfig(): IngestConfig {
  const raw = {
    dataforSeoLogin: process.env.DATAFORSEO_LOGIN,
    dataforSeoPassword: process.env.DATAFORSEO_PASSWORD,

    pgHost: process.env.PGHOST,
    pgPort: process.env.PGPORT,
    pgDatabase: process.env.PGDATABASE,
    pgUser: process.env.PGUSER,
    pgPassword: process.env.PGPASSWORD,
    pgSsl: parseBool(process.env.PGSSL ?? "true"),

    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

    lexyHubMarket: process.env.LEXYHUB_MARKET,
    defaultLanguageCode: process.env.DEFAULT_LANGUAGE_CODE,
    defaultLocationCode: process.env.DEFAULT_LOCATION_CODE,

    k4kMaxTermsPerTask: process.env.K4K_MAX_TERMS_PER_TASK,
    k4kDevice: process.env.K4K_DEVICE,
    k4kSearchPartners: parseBool(process.env.K4K_SEARCH_PARTNERS),
    k4kIncludeAdult: parseBool(process.env.K4K_INCLUDE_ADULT),

    batchMaxSeeds: process.env.BATCH_MAX_SEEDS,
    concurrencyTaskPost: process.env.CONCURRENCY_TASK_POST,
    concurrencyTaskGet: process.env.CONCURRENCY_TASK_GET,

    pollIntervalMs: process.env.POLL_INTERVAL_MS,
    pollTimeoutMs: process.env.POLL_TIMEOUT_MS,

    dryRun: parseBool(process.env.DRY_RUN),
    logLevel: process.env.LOG_LEVEL,
  };

  const parsed = configSchema.parse(raw);

  // Validate that we have either Supabase OR direct PG credentials
  if (!parsed.supabaseUrl && !parsed.pgHost) {
    throw new Error(
      "Database connection required: Set NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD"
    );
  }

  return parsed as IngestConfig;
}

export function validateConfig(config: IngestConfig): void {
  if (!config.dataforSeoLogin || !config.dataforSeoPassword) {
    throw new Error("DataForSEO credentials are required");
  }

  if (config.batchMaxSeeds < 1) {
    throw new Error("BATCH_MAX_SEEDS must be >= 1");
  }

  if (config.k4kMaxTermsPerTask > 20) {
    throw new Error("K4K_MAX_TERMS_PER_TASK cannot exceed 20 (DataForSEO limit)");
  }
}
