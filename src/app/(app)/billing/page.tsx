"use client";

export const dynamic = 'force-dynamic';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSession } from "@supabase/auth-helpers-react";
import { CreditCard, CheckCircle2, XCircle, Clock } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UsageChip } from "@/components/billing/UsageChip";

const PLAN_SUMMARY: Record<string, string> = {
  free: "Perfect for exploring LexyHub features with basic limits.",
  basic: "Essential tools for growing sellers with increased capacity.",
  pro: "Unlimited access to all features for serious entrepreneurs.",
  spark: "Essential tools for growing sellers with increased capacity.",
  scale: "Unlimited access to all features for serious entrepreneurs.",
  apex: "Unlimited access to all features for serious entrepreneurs.",
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

type BillingPreferences = {
  plan: "spark" | "scale" | "apex";
  billingEmail: string;
  autoRenew: boolean;
  paymentMethod: string;
};

export default function BillingPage(): JSX.Element {
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;
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
  const [usage, setUsage] = useState<{
    searches: { used: number; limit: number };
    ai_opportunities: { used: number; limit: number };
    niches: { used: number; limit: number };
  }>({
    searches: { used: 0, limit: 10 },
    ai_opportunities: { used: 0, limit: 2 },
    niches: { used: 0, limit: 1 },
  });
  const activePlanSummary = useMemo(() => PLAN_SUMMARY[billing.plan], [billing.plan]);

  const loadData = useCallback(async () => {
    if (!userId) {
      setBilling({ plan: "spark", billingEmail: "", autoRenew: true, paymentMethod: "" });
      setInvoiceHistory([]);
      setSubscriptionStatus("unknown");
      setPeriodEnd(null);
      setLoading(false);
      return;
    }

    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [toast, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
        title: "Subscription updated",
        description: "Your billing preferences have been saved.",
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
              <CreditCard className="h-6 w-6 text-muted-foreground" />
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold">Billing &amp; Subscription</CardTitle>
                <CardDescription className="text-base">
                  Manage your subscription plan, billing preferences, and usage.
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
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Billing Preferences</CardTitle>
              </div>
              <CardDescription>Manage your subscription plan and billing preferences.</CardDescription>
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
            <CardDescription>Your subscription status and billing history.</CardDescription>
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
