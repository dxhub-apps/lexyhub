import type { ReactNode } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { isAdminUser } from "@/lib/auth/admin";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await supabase.from("user_profiles").select("plan").eq("user_id", user.id).maybeSingle();
  const plan = profile.data?.plan ?? null;

  if (!isAdminUser(user, plan)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

export const dynamic = "force-dynamic";
