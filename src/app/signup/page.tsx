import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Session } from "@supabase/supabase-js";
import { Sparkles } from "lucide-react";

import { SignupForm } from "@/components/auth/SignupForm";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

type SignupPageProps = {
  searchParams?: { redirect_to?: string };
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
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

  const validatedSession: Session | null =
    session && user ? { ...session, user } : session;

  if (user) {
    redirect("/search");
  }

  const redirectTo = typeof searchParams?.redirect_to === "string" && searchParams.redirect_to ? searchParams.redirect_to : "/search";

  return (
    <SupabaseProvider initialSession={validatedSession}>
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#F1F5F9" }}>
        <div className="w-full max-w-md">
          <Card className="shadow-xl">
            <CardHeader className="space-y-3 text-center pb-6">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Join LexyHub</CardTitle>
                <CardDescription className="text-base mt-2">
                  Start your free account and unlock powerful marketplace insights
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pb-8">
              <SignupForm redirectTo={redirectTo} />
              <p className="text-center text-xs text-muted-foreground mt-6">
                Free tier • No credit card required • Upgrade anytime
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </SupabaseProvider>
  );
}
