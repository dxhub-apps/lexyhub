import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { LoginForm } from "@/components/auth/LoginForm";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";

type LoginPageProps = {
  searchParams?: { redirect_to?: string };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
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

  if (user) {
    redirect("/dashboard");
  }

  const redirectTo = typeof searchParams?.redirect_to === "string" && searchParams.redirect_to ? searchParams.redirect_to : "/dashboard";

  return (
    <SupabaseProvider initialSession={session}>
      <div className="auth-page">
        <div className="auth-card" role="main">
          <h1>Welcome back</h1>
          <p className="auth-subtitle">Sign in with your Supabase credentials to access LexyHub.</p>
          <LoginForm redirectTo={redirectTo} />
          <p className="auth-meta">Powered by Supabase Auth</p>
        </div>
      </div>
    </SupabaseProvider>
  );
}
