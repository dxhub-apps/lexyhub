"use client";

import { useState, type ReactNode } from "react";
import { SessionContextProvider, type Session } from "@supabase/auth-helpers-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseProviderProps = {
  initialSession: Session | null;
  children: ReactNode;
};

export function SupabaseProvider({ initialSession, children }: SupabaseProviderProps): JSX.Element {
  const [client] = useState<SupabaseClient>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("Supabase environment variables are not configured.");
    }

    return createClientComponentClient({
      supabaseUrl: url,
      supabaseKey: key,
    });
  });

  return (
    <SessionContextProvider supabaseClient={client} initialSession={initialSession}>
      {children}
    </SessionContextProvider>
  );
}
