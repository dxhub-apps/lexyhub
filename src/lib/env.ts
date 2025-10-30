import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  LEXYHUB_JWT_SECRET: z.string().min(16).default("change-me-change-me"),
  OPENAI_API_KEY: z.string().optional(),
  ETSY_CLIENT_ID: z.string().optional(),
  ETSY_CLIENT_SECRET: z.string().optional(),
  ETSY_REDIRECT_URI: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

function readEnv(): Env {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    LEXYHUB_JWT_SECRET: process.env.LEXYHUB_JWT_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ETSY_CLIENT_ID: process.env.ETSY_CLIENT_ID,
    ETSY_CLIENT_SECRET: process.env.ETSY_CLIENT_SECRET,
    ETSY_REDIRECT_URI: process.env.ETSY_REDIRECT_URI,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  });
}

export const env = readEnv();
