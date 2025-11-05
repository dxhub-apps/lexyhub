"use client";

export const dynamic = 'force-dynamic';

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { upload } from "@vercel/blob/client";
import { useSession } from "@supabase/auth-helpers-react";
import { User, CreditCard, Upload, CheckCircle2, XCircle, Clock } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UsageChip } from "@/components/billing/UsageChip";

const PLAN_SUMMARY: Record<string, string> = {
  spark: "Starter access with 100 keyword queries and Market Twin previews.",
  scale: "Full Etsy sync, Market Twin history, and quota multipliers.",
  apex: "Unlimited sources, dedicated analyst hours, and real-time refreshes.",
};

type InvoiceHistoryRow = {
  id: string;
  period: string;
  total: string;
  status: string;
};

function formatAmount(cents?: number | null): string {
  if (cents == null) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

type ProfileDetails = {
  fullName: string;
  email: string;
  company: string;
  bio: string;
  timezone: string;
  notifications: boolean;
  avatarUrl: string;
};

type BillingPreferences = {
  plan: "spark" | "scale" | "apex";
  billingEmail: string;
  autoRenew: boolean;
  paymentMethod: string;
};

const EMPTY_PROFILE: ProfileDetails = {
  fullName: "",
  email: "",
  company: "",
  bio: "",
  timezone: "",
  notifications: false,
  avatarUrl: "",
};

const AVATAR_FALLBACK = "https://avatar.vercel.sh/lexyhub.svg?size=120&background=111827";

export default function ProfilePage(): JSX.Element {
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;
  const [profile, setProfile] = useState<ProfileDetails>(EMPTY_PROFILE);
  const [billing, setBilling] = useState<BillingPreferences>({
    plan: "spark",
    billingEmail: "",
    autoRenew: true,
    paymentMethod: "",
  });
  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceHistoryRow[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("unknown");
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [usage, setUsage] = useState<{
    searches: { used: number; limit: number };
    ai_opportunities: { used: number; limit: number };
    niches: { used: number; limit: number };
  }>({
    searches: { used: 0, limit: 10 },
    ai_opportunities: { used: 0, limit: 2 },
    niches: { used: 0, limit: 1 },
  });
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const activePlanSummary = useMemo(() => PLAN_SUMMARY[billing.plan], [billing.plan]);

  const loadData = useCallback(async () => {
    if (!userId) {
      setProfile(EMPTY_PROFILE);
      setBilling({ plan: "spark", billingEmail: "", autoRenew: true, paymentMethod: "" });
      setInvoiceHistory([]);
      setSubscriptionStatus("unknown");
      setPeriodEnd(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const profileResponse = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
      if (!profileResponse.ok) {
        const payload = await profileResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to load profile (${profileResponse.status})`);
      }
      const profileJson = (await profileResponse.json()) as {
        profile?: Partial<ProfileDetails>;
      };
      if (profileJson.profile) {
        setProfile({ ...EMPTY_PROFILE, ...profileJson.profile });
      }
    } catch (error) {
      toast({
        title: "Profile unavailable",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }

    try {
      const response = await fetch(`/api/billing/subscription?userId=${encodeURIComponent(userId)}`);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? `Failed to load billing data (${response.status})`);
      }

      setBilling((state) => {
        const nextPlan = (json.profile?.plan ?? json.subscription?.plan ?? state.plan) as BillingPreferences["plan"];
        const normalizedPlan: BillingPreferences["plan"] =
          nextPlan === "spark" || nextPlan === "scale" || nextPlan === "apex" ? nextPlan : state.plan;

        const settings = (json.profile?.settings ?? {}) as { payment_method_label?: string };

        return {
          plan: normalizedPlan,
          billingEmail: json.subscription?.metadata?.billing_email ?? state.billingEmail ?? "",
          autoRenew: !(json.subscription?.cancel_at_period_end ?? false),
          paymentMethod: settings.payment_method_label ?? state.paymentMethod ?? "",
        };
      });

      setInvoiceHistory(
        (json.invoices ?? []).map(
          (invoice: {
            stripe_invoice_id: string;
            invoice_date: string;
            amount_paid_cents?: number;
            amount_due_cents?: number;
            status?: string;
          }) => ({
            id: invoice.stripe_invoice_id,
            period: invoice.invoice_date
              ? new Date(invoice.invoice_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })
              : "—",
            total: formatAmount(invoice.amount_paid_cents ?? invoice.amount_due_cents ?? null),
            status: invoice.status ?? "open",
          }),
        ),
      );

      setSubscriptionStatus(json.subscription?.status ?? "unknown");
      setPeriodEnd(json.subscription?.current_period_end ?? null);
    } catch (error) {
      toast({
        title: "Billing unavailable",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }

    // Load usage data
    try {
      const usageResponse = await fetch(`/api/billing/usage?userId=${encodeURIComponent(userId)}`);
      if (usageResponse.ok) {
        const usageJson = await usageResponse.json();
        if (usageJson.usage) {
          setUsage(usageJson.usage);
        }
      }
    } catch (error) {
      console.warn("Failed to load usage data", error);
      // Don't show toast for usage errors, just log it
    } finally {
      setLoading(false);
    }
  }, [toast, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      toast({
        title: "Profile unavailable",
        description: "You must be signed in to update your profile.",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to update profile");
      }
      toast({
        title: "Profile updated",
        description: "Your preferences are saved to Supabase.",
        variant: "success",
      });
      await loadData();
    } catch (error) {
      toast({
        title: "Profile update failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!userId) {
      toast({
        title: "Avatar unavailable",
        description: "You must be signed in to update your profile photo.",
        variant: "destructive",
      });
      return;
    }

    const resetInput = () => {
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    };

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Unsupported file",
        description: "Please choose a PNG, JPG, or WebP image.",
        variant: "destructive",
      });
      resetInput();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Avatars must be smaller than 5MB.",
        variant: "destructive",
      });
      resetInput();
      return;
    }

    setAvatarUploading(true);

    try {
      const sanitizedName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
      const pathname = `users/${userId}/avatar-${Date.now()}-${sanitizedName || "upload"}`;

      const uploaded = await upload(pathname, file, {
        access: "public",
        contentType: file.type,
        handleUploadUrl: "/api/profile/avatar",
        clientPayload: JSON.stringify({ userId }),
      });

      const response = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: uploaded.url }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to update avatar");
      }

      setProfile((state) => ({ ...state, avatarUrl: uploaded.url }));
      toast({
        title: "Avatar updated",
        description: "Your profile photo is refreshed.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Avatar upload failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setAvatarUploading(false);
      resetInput();
    }
  };

  const handleBillingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      toast({
        title: "Subscription unavailable",
        description: "You must be signed in to manage billing preferences.",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await fetch(`/api/billing/subscription?userId=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(billing),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to update billing");
      }
      toast({
        title: "Subscription settings saved",
        description: "Billing preferences are now stored in Supabase.",
        variant: "success",
      });
      await loadData();
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleCancelPlan = async () => {
    if (!userId) {
      toast({
        title: "Cancellation unavailable",
        description: "You must be signed in to manage your plan.",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await fetch(`/api/billing/subscription?userId=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...billing, autoRenew: false }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to schedule cancellation");
      }
      toast({
        title: "Cancellation scheduled",
        description: "Your plan will remain active until the current cycle ends.",
        variant: "warning",
      });
      await loadData();
    } catch (error) {
      toast({
        title: "Cancellation failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const statusIcon = subscriptionStatus === "active" ? CheckCircle2 : subscriptionStatus === "canceled" ? XCircle : Clock;
  const StatusIcon = statusIcon;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <User className="h-6 w-6 text-muted-foreground" />
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold">Profile &amp; Billing</CardTitle>
                <CardDescription className="text-base">
                  Keep your workspace details and subscription preferences tidy. Upload a friendly avatar, confirm how we contact you, and tune your billing cadence.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">Plan: {billing.plan.toUpperCase()}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                <StatusIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{subscriptionStatus}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Auto-renew</span>
              <span className="text-sm font-medium">{billing.autoRenew ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Period end</span>
              <span className="text-sm font-medium">{periodEnd ? new Date(periodEnd).toLocaleString() : "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Plan summary</span>
              <span className="text-sm font-medium">{activePlanSummary}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Usage</CardTitle>
          <CardDescription>
            Your current usage for this billing period. Upgrade your plan for higher limits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <UsageChip
              label="Searches"
              used={usage.searches.used}
              limit={usage.searches.limit}
            />
            <UsageChip
              label="AI Opportunities"
              used={usage.ai_opportunities.used}
              limit={usage.ai_opportunities.limit}
            />
            <UsageChip
              label="Niches"
              used={usage.niches.used}
              limit={usage.niches.limit}
            />
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm" asChild>
              <a href="/pricing">View Plans</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>Update the information that appears in your workspace and notifications.</CardDescription>
                </div>
                <Badge variant="outline">Account Center</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="flex items-start gap-6">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profile.avatarUrl || AVATAR_FALLBACK}
                      alt={profile.fullName ? `${profile.fullName}'s avatar` : "Profile avatar"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <input
                      ref={avatarInputRef}
                      id="profile-avatar-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={handleAvatarSelect}
                      disabled={avatarUploading || loading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading || loading}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {avatarUploading ? "Uploading…" : "Change avatar"}
                    </Button>
                    <p className="text-xs text-muted-foreground">Use a clear square image under 5MB (PNG, JPG, or WebP).</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full name</Label>
                    <Input
                      id="full-name"
                      value={profile.fullName}
                      onChange={(event) => setProfile((state) => ({ ...state, fullName: event.target.value }))}
                      disabled={loading}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(event) => setProfile((state) => ({ ...state, email: event.target.value }))}
                      disabled={loading}
                      placeholder="you@company.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={profile.company}
                      onChange={(event) => setProfile((state) => ({ ...state, company: event.target.value }))}
                      disabled={loading}
                      placeholder="LexyHub"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={profile.timezone}
                      onChange={(event) => setProfile((state) => ({ ...state, timezone: event.target.value }))}
                      disabled={loading}
                      placeholder="America/Chicago"
                      autoComplete="timezone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    value={profile.bio}
                    onChange={(event) => setProfile((state) => ({ ...state, bio: event.target.value }))}
                    disabled={loading}
                    placeholder="Share a short intro for teammates."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    id="notifications"
                    type="checkbox"
                    checked={profile.notifications}
                    onChange={(event) => setProfile((state) => ({ ...state, notifications: event.target.checked }))}
                    disabled={loading}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="notifications" className="cursor-pointer font-normal">Send product notifications</Label>
                </div>

                <Button type="submit" disabled={loading}>Save profile</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Billing</CardTitle>
              </div>
              <CardDescription>Control your renewal cadence, billing contact, and saved payment label.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBillingSubmit} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="plan">Plan</Label>
                    <Select
                      value={billing.plan}
                      onValueChange={(value) =>
                        setBilling((state) => ({ ...state, plan: value as BillingPreferences["plan"] }))
                      }
                      disabled={loading}
                    >
                      <SelectTrigger id="plan">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spark">Spark</SelectItem>
                        <SelectItem value="scale">Scale</SelectItem>
                        <SelectItem value="apex">Apex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing-email">Billing email</Label>
                    <Input
                      id="billing-email"
                      type="email"
                      value={billing.billingEmail}
                      onChange={(event) => setBilling((state) => ({ ...state, billingEmail: event.target.value }))}
                      disabled={loading}
                      placeholder="billing@company.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-method">Payment method label</Label>
                    <Input
                      id="payment-method"
                      value={billing.paymentMethod}
                      onChange={(event) => setBilling((state) => ({ ...state, paymentMethod: event.target.value }))}
                      disabled={loading}
                      placeholder="Corporate Amex"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    id="auto-renew"
                    type="checkbox"
                    checked={billing.autoRenew}
                    onChange={(event) => setBilling((state) => ({ ...state, autoRenew: event.target.checked }))}
                    disabled={loading}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="auto-renew" className="cursor-pointer font-normal">Auto-renew plan</Label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={loading}>Save billing settings</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelPlan}
                    disabled={loading}
                  >
                    Cancel at period end
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Status and history sync directly from Supabase billing records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="font-medium">Current plan</dt>
                <dd className="text-muted-foreground">{billing.plan.toUpperCase()}</dd>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="font-medium">Status</dt>
                <dd className="flex items-center gap-2">
                  <StatusIcon className="h-4 w-4" />
                  <span>{subscriptionStatus}</span>
                </dd>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="font-medium">Auto-renew</dt>
                <dd className="text-muted-foreground">{billing.autoRenew ? "Enabled" : "Disabled"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium">Current period end</dt>
                <dd className="text-muted-foreground">{periodEnd ? new Date(periodEnd).toLocaleString() : "—"}</dd>
              </div>
            </dl>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Invoice history</h3>
              {invoiceHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <div className="space-y-2">
                  {invoiceHistory.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0 last:pb-0">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{invoice.period}</span>
                        <span className="text-xs text-muted-foreground">{invoice.status}</span>
                      </div>
                      <span className="font-medium">{invoice.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
