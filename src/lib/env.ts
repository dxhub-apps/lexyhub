import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  LEXYHUB_JWT_SECRET: z.string().min(16).default("change-me-change-me"),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_TRENDS_API_KEY: z.string().optional(),
  PINTEREST_ACCESS_TOKEN: z.string().optional(),
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  PARTNER_API_STATIC_KEYS: z.string().optional(),
  ETSY_CLIENT_ID: z.string().optional(),
  ETSY_CLIENT_SECRET: z.string().optional(),
  ETSY_REDIRECT_URI: z.string().url().optional(),
  ETSY_DATA_SOURCE: z.enum(["SCRAPE", "API"]).optional(),
  ETSY_API_KEY: z.string().optional(),
  ETSY_API_SECRET: z.string().optional(),
  ETSY_BASE_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  LEXYHUB_ADMIN_EMAILS: z.string().optional(),
  BROWSER_EXTENSION_API_BASE_URL: z.string().url().optional(),
  BROWSER_EXTENSION_ALLOW_USER_TELEMETRY_DEFAULT: z
    .union([z.string(), z.boolean()])
    .optional(),
  // LexyBrain AI configuration
  LEXYBRAIN_ENABLE: z.string().optional(),
  LEXYBRAIN_MODEL_URL: z.string().url().optional(),
  LEXYBRAIN_KEY: z.string().optional(),
  LEXYBRAIN_MODEL_VERSION: z.string().optional(),
  LEXYBRAIN_DAILY_COST_CAP: z.string().optional(),
  LEXYBRAIN_MAX_LATENCY_MS: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

function readEnv(): Env {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    LEXYHUB_JWT_SECRET: process.env.LEXYHUB_JWT_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_TRENDS_API_KEY: process.env.GOOGLE_TRENDS_API_KEY,
    PINTEREST_ACCESS_TOKEN: process.env.PINTEREST_ACCESS_TOKEN,
    REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
    PARTNER_API_STATIC_KEYS: process.env.PARTNER_API_STATIC_KEYS,
    ETSY_CLIENT_ID: process.env.ETSY_CLIENT_ID,
    ETSY_CLIENT_SECRET: process.env.ETSY_CLIENT_SECRET,
    ETSY_REDIRECT_URI: process.env.ETSY_REDIRECT_URI,
    ETSY_DATA_SOURCE: process.env.ETSY_DATA_SOURCE as "SCRAPE" | "API" | undefined,
    ETSY_API_KEY: process.env.ETSY_API_KEY,
    ETSY_API_SECRET: process.env.ETSY_API_SECRET,
    ETSY_BASE_URL: process.env.ETSY_BASE_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    LEXYHUB_ADMIN_EMAILS: process.env.LEXYHUB_ADMIN_EMAILS,
    BROWSER_EXTENSION_API_BASE_URL: process.env.BROWSER_EXTENSION_API_BASE_URL,
    BROWSER_EXTENSION_ALLOW_USER_TELEMETRY_DEFAULT:
      process.env.BROWSER_EXTENSION_ALLOW_USER_TELEMETRY_DEFAULT,
    LEXYBRAIN_ENABLE: process.env.LEXYBRAIN_ENABLE,
    LEXYBRAIN_MODEL_URL: process.env.LEXYBRAIN_MODEL_URL,
    LEXYBRAIN_KEY: process.env.LEXYBRAIN_KEY,
    LEXYBRAIN_MODEL_VERSION: process.env.LEXYBRAIN_MODEL_VERSION,
    LEXYBRAIN_DAILY_COST_CAP: process.env.LEXYBRAIN_DAILY_COST_CAP,
    LEXYBRAIN_MAX_LATENCY_MS: process.env.LEXYBRAIN_MAX_LATENCY_MS,
  });
}

export const env = readEnv();
