"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type FormState = {
  email: string;
  password: string;
  confirmPassword: string;
};

type SignupFormProps = {
  redirectTo?: string;
};

export function SignupForm({ redirectTo = "/dashboard" }: SignupFormProps): JSX.Element {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (event: FormEvent<HTMLInputElement>) => {
    const { name, value } = event.currentTarget;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    // Validate passwords match
    if (form.password !== form.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Validate password length
    if (form.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Sign up the user
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`,
        data: {
          plan: "free", // Set initial plan as free
        }
      },
    });

    if (authError) {
      toast({
        title: "Signup failed",
        description: authError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!data.user) {
      toast({
        title: "Signup failed",
        description: "Unable to create account. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Check if email confirmation is required
    if (data.session) {
      // Auto-confirmed, proceed with post-signup setup

      // Create user profile using RPC function (this will also trigger affiliate creation)
      try {
        const profileResponse = await fetch("/api/auth/init-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!profileResponse.ok) {
          console.error("Failed to initialize profile:", await profileResponse.text());
        }
      } catch (error) {
        console.error("Failed to initialize profile:", error);
      }

      // Record affiliate referral if exists
      try {
        await fetch("/api/affiliate/recordReferral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.user.id }),
        });
      } catch (error) {
        // Don't block signup if affiliate recording fails
        console.error("Failed to record referral:", error);
      }

      toast({
        title: "Welcome to LexyHub!",
        description: "Your account has been created successfully.",
        variant: "success",
      });
      setLoading(false);
      router.replace(redirectTo);
      router.refresh();
    } else {
      // Email confirmation required - profile will be created on first login
      toast({
        title: "Check your email",
        description: "We've sent you a confirmation link. Please check your email to activate your account.",
        variant: "success",
      });
      setLoading(false);
    }
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
              autoComplete="new-password"
              required
              value={form.password}
              onInput={handleChange}
              placeholder="••••••••"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters long
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
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
              Creating account...
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Create free account
            </>
          )}
        </Button>
      </form>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={`/login${redirectTo !== "/dashboard" ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
