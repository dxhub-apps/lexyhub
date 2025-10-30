import { createClient } from "@supabase/supabase-js";

import { env } from "../env";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase client initialized without full credentials.");
}

export const supabase = createClient(supabaseUrl ?? "", supabaseKey ?? "");
