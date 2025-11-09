import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Session } from "@supabase/supabase-js";

import { AppShell } from "@/components/layout/AppShell";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isAdminUser } from "@/lib/auth/admin";
import { ensureAdminProfile } from "@/lib/auth/ensure-profile";

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });
  // Use getUser() instead of getSession() for secure server-side authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get session only after user is validated
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const validatedSession: Session | null =
    session && user ? { ...session, user } : null;

  const { plan } = await ensureAdminProfile(user);
  const isAdmin = isAdminUser(user, plan);

  return (
    <SupabaseProvider initialSession={validatedSession}>
      <ErrorBoundary context={{ feature: "app", component: "app-layout" }}>
        <AppShell isAdmin={isAdmin}>{children}</AppShell>
      </ErrorBoundary>
    </SupabaseProvider>
  );
}
