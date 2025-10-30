import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  LEXYHUB_JWT_SECRET: z.string().min(16).default("change-me-change-me"),
  OPENAI_API_KEY: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

function readEnv(): Env {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    LEXYHUB_JWT_SECRET: process.env.LEXYHUB_JWT_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });
}

export const env = readEnv();
