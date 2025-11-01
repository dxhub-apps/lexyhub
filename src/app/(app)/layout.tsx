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
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  await ensureAdminProfile(session.user);

  return (
    <SupabaseProvider initialSession={session}>
      <AppShell>{children}</AppShell>
    </SupabaseProvider>
  );
}
