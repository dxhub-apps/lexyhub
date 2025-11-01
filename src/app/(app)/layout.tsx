import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { AppShell } from "@/components/layout/AppShell";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { ensureAdminProfile } from "@/lib/auth/ensure-profile";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });
  const [sessionResult, userResult] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);

  const {
    data: { session },
  } = sessionResult;
  const {
    data: { user },
  } = userResult;

  if (!user) {
    redirect("/login");
  }

  await ensureAdminProfile(user);

  return (
    <SupabaseProvider initialSession={session}>
      <AppShell>{children}</AppShell>
    </SupabaseProvider>
  );
}
