"use client";

export const dynamic = 'force-dynamic';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSession } from "@supabase/auth-helpers-react";
import { useSearchParams } from "next/navigation";
import { CreditCard, CheckCircle2, XCircle, Clock, Sparkles, Zap, Check } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UsageChip } from "@/components/billing/UsageChip";
import { PLAN_CONFIGS, getVisiblePlans } from "@/lib/billing/plans";
import type { PlanCode } from "@/lib/billing/types";
import { formatPrice } from "@/lib/billing/types";

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

// Stripe price IDs for checkout
// TODO: Add your Pro plan Stripe price IDs from your Stripe dashboard
const STRIPE_PRICES: Record<string, string> = {
  'basic_monthly': 'price_1SQOdz3enLCiqy1O4KF74msU',
  'basic_annual': 'price_1SQPWO3enLCiqy1Oll2Lhd54', // Founders Deal
  'pro_monthly': process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly_placeholder',
  'pro_annual': process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || 'price_pro_annual_placeholder',
};

export default function BillingPage(): JSX.Element {
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;
  const searchParams = useSearchParams();
  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceHistoryRow[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("unknown");
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<PlanCode>("free");
  const [autoRenew, setAutoRenew] = useState<boolean>(true);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    searches: { used: number; limit: number };
    ai_opportunities: { used: number; limit: number };
    niches: { used: number; limit: number };
  }>({
    searches: { used: 0, limit: 10 },
    ai_opportunities: { used: 0, limit: 2 },
    niches: { used: 0, limit: 1 },
  });
  const activePlanSummary = useMemo(() => PLAN_SUMMARY[currentPlan] || "Manage your subscription and usage.", [currentPlan]);
  const visiblePlans = useMemo(() => getVisiblePlans(), []);

  const loadData = useCallback(async () => {
    if (!userId) {
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

      // Set current plan from profile with validation
      const profilePlan = json.profile?.plan ?? "free";
      // Ensure we only set valid plan codes, fallback to free for legacy plans
      const validPlanCodes: PlanCode[] = ['free', 'basic', 'pro', 'growth'];
      const validatedPlan = validPlanCodes.includes(profilePlan as PlanCode)
        ? (profilePlan as PlanCode)
        : 'free';
      setCurrentPlan(validatedPlan);

      // Set subscription details
      setAutoRenew(!(json.subscription?.cancel_at_period_end ?? false));
      setStripeSubscriptionId(json.subscription?.stripe_subscription_id ?? null);

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

  const handleUpgradeClick = async (priceId: string, planName: string) => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upgrade your plan.",
        variant: "destructive",
      });
      return;
    }

    setCheckoutLoading(true);
    try {
      // Create a direct Stripe checkout session using the price ID
      const response = await fetch('/api/billing/checkout/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          priceId,
          planName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
      setCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please sign in to manage your billing.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to access billing portal');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      toast({
        title: "Portal unavailable",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const statusIcon = subscriptionStatus === "active" ? CheckCircle2 : subscriptionStatus === "canceled" ? XCircle : Clock;
  const StatusIcon = statusIcon;

  // Check if user should see upgrade CTAs
  const showUpgradeCTA = currentPlan === "free" || currentPlan === "basic";
  const showFoundersDeal = searchParams?.get("upgrade") === "founders";

  // Get current plan config with fallback for legacy plans
  const currentPlanConfig = PLAN_CONFIGS[currentPlan] || PLAN_CONFIGS.free;
  const displayPlanName = currentPlanConfig.display_name || currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);

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
                  Manage your subscription plan and usage.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">Plan: {displayPlanName}</Badge>
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
              <span className="text-sm font-medium">{autoRenew ? "Enabled" : "Disabled"}</span>
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

      {/* Founders Deal CTA - Show if coming from sidebar */}
      {showFoundersDeal && showUpgradeCTA && (
        <Card className="border-blue-600 border-2 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
          <CardHeader>
            <div className="flex items-start gap-3">
              <Sparkles className="h-6 w-6 text-blue-600" />
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold text-blue-600">Founders Deal — Limited Time Only!</CardTitle>
                <CardDescription className="text-base">
                  Get the LexyHub Basic Plan for only $39/year. Lock in this exclusive price now!
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">100 searches per month</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">10 AI opportunities per month</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">5 niches maximum</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">Priority support</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => handleUpgradeClick('price_1SQPWO3enLCiqy1Oll2Lhd54', 'Basic Plan (Founders Deal)')}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? "Loading..." : "Claim Founders Deal - $39/year"}
              </Button>
              <div className="text-sm text-muted-foreground">
                <span className="line-through">$99/year</span>
                <span className="ml-2 font-bold text-green-600">Save 61%!</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regular Basic Plan Upgrade CTA - Show for free users */}
      {showUpgradeCTA && !showFoundersDeal && (
        <Card className="border-purple-600 border-2">
          <CardHeader>
            <div className="flex items-start gap-3">
              <Zap className="h-6 w-6 text-purple-600" />
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold">Upgrade to Basic Plan</CardTitle>
                <CardDescription className="text-base">
                  Unlock more searches, AI opportunities, and niches to grow your business.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">100 searches per month</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">10 AI opportunities per month</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">5 niches maximum</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">Priority support</span>
              </div>
            </div>
            <Button
              size="lg"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => handleUpgradeClick('price_1SQOdz3enLCiqy1O4KF74msU', 'Basic Plan')}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? "Loading..." : "Upgrade to Basic Plan"}
            </Button>
          </CardContent>
        </Card>
      )}

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

      {/* Plans Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Compare plans and choose the one that fits your needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {visiblePlans.map((plan) => {
              const isCurrentPlan = plan.plan_code === currentPlan;
              const currentSortOrder = currentPlanConfig.sort_order;
              const isDowngrade = plan.sort_order < currentSortOrder;
              const isUpgrade = plan.sort_order > currentSortOrder;

              return (
                <Card
                  key={plan.plan_code}
                  className={isCurrentPlan ? "border-blue-600 border-2" : ""}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{plan.display_name}</CardTitle>
                      {isCurrentPlan && (
                        <Badge variant="default">Current</Badge>
                      )}
                    </div>
                    <div className="text-2xl font-bold">
                      {formatPrice(plan.price_monthly_cents, 'monthly')}
                    </div>
                    <CardDescription className="text-xs">
                      {formatPrice(plan.price_annual_cents, 'annual')} billed annually
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2 text-sm">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-4">
                      {isCurrentPlan ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleManageBilling}
                          disabled={!stripeSubscriptionId}
                        >
                          Manage Billing
                        </Button>
                      ) : plan.plan_code === 'basic' ? (
                        <Button
                          className="w-full"
                          onClick={() => handleUpgradeClick(STRIPE_PRICES.basic_monthly, 'Basic Plan')}
                          disabled={checkoutLoading}
                        >
                          {isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Get Started'}
                        </Button>
                      ) : plan.plan_code === 'pro' ? (
                        <Button
                          className="w-full"
                          onClick={() => handleUpgradeClick(STRIPE_PRICES.pro_monthly, 'Pro Plan')}
                          disabled={checkoutLoading}
                        >
                          {isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Get Started'}
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant="outline"
                          disabled
                        >
                          Coming Soon
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Details</CardTitle>
            <CardDescription>Your current subscription information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="font-medium">Current plan</dt>
                <dd className="text-muted-foreground">{displayPlanName}</dd>
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
                <dd className="text-muted-foreground">{autoRenew ? "Enabled" : "Disabled"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium">Current period end</dt>
                <dd className="text-muted-foreground">{periodEnd ? new Date(periodEnd).toLocaleDateString() : "—"}</dd>
              </div>
            </dl>

            {stripeSubscriptionId && (
              <div className="pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleManageBilling}
                >
                  Manage Payment & Billing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice History</CardTitle>
            <CardDescription>Your recent billing invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
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
