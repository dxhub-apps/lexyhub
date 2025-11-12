"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { identifyAnalyticsUser, trackAnalyticsEvent, AnalyticsEvents, trackError } from "@/lib/analytics/tracking";

type FormState = {
  email: string;
  password: string;
};

type LoginFormProps = {
  redirectTo?: string;
};

export function LoginForm({ redirectTo = "/search" }: LoginFormProps): JSX.Element {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (event: FormEvent<HTMLInputElement>) => {
    const { name, value } = event.currentTarget;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      // Track failed login attempt
      trackError(authError, {
        context: "login",
        email: form.email,
      });

      toast({
        title: "Authentication failed",
        description: authError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!data.session) {
      toast({
        title: "Authentication failed",
        description: "No active session was created. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Track successful login
    identifyAnalyticsUser(data.user.id, {
      email: data.user.email,
    });

    trackAnalyticsEvent(AnalyticsEvents.USER_LOGGED_IN, {
      method: "email",
      redirect_to: redirectTo,
    });

    toast({
      title: "Welcome back!",
      description: "You've successfully signed in.",
      variant: "success",
    });

    setLoading(false);
    router.replace(redirectTo);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onInput={handleChange}
              placeholder="you@example.com"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onInput={handleChange}
              placeholder="••••••••"
              className="h-11"
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Sign in
            </>
          )}
        </Button>
      </form>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup${redirectTo !== "/search" ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-medium text-primary hover:underline"
          >
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  );
}
