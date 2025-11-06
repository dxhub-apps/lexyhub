"use client";

import { TrendingUp, Users, Gift, DollarSign, Activity, Chrome, Target } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface PricingMetrics {
  extensionTrials: {
    totalActivated: number;
    currentlyActive: number;
    expired: number;
    neverActivated: number;
    activePercentage: number;
  };
  referralRewards: {
    totalBasic: number;
    totalPro: number;
    activeBasic: number;
    activePro: number;
    totalUsersWithReferrals: number;
  };
  subscriptions: {
    byTier: Record<string, number>;
    total: number;
    mrrCents: number;
    mrrFormatted: string;
    arrCents: number;
    arrFormatted: string;
  };
  users: {
    total: number;
    newLast30Days: number;
    growthRate: number;
  };
  usage: {
    searchesThisMonth: number;
    aiOpsThisMonth: number;
    nichesTracked: number;
    avgSearchesPerUser: string;
  };
  conversionFunnel: {
    pageViews: number;
    checkoutStarted: number;
    checkoutCompleted: number;
    conversionRate: string;
  };
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function MetricCard({ title, value, subtitle, icon, badge, trend }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
            <CardDescription className="text-sm font-medium">{title}</CardDescription>
          </div>
          {badge && <Badge variant={badge.variant || "default"}>{badge.text}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{value}</span>
            {trend && (
              <Badge variant={trend.isPositive ? "default" : "destructive"} className="text-xs">
                {trend.isPositive ? "▲" : "▼"} {Math.abs(trend.value)}%
              </Badge>
            )}
          </div>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function PricingMetricsCards({ metrics }: { metrics: PricingMetrics }) {
  return (
    <div className="space-y-6">
      {/* Extension Trials Section */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Extension Trials (14-Day Pro)</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Active Pro Trials"
            value={metrics.extensionTrials.currentlyActive}
            subtitle="Users currently on 14-day Pro trial"
            icon={<Chrome className="h-4 w-4" />}
            badge={{
              text: `${metrics.extensionTrials.activePercentage}% active`,
              variant: "secondary",
            }}
          />
          <MetricCard
            title="Total Activated"
            value={metrics.extensionTrials.totalActivated}
            subtitle="All-time trial activations"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            title="Expired Trials"
            value={metrics.extensionTrials.expired}
            subtitle="Trials that have ended"
            icon={<Activity className="h-4 w-4" />}
          />
          <MetricCard
            title="Unused Trials"
            value={metrics.extensionTrials.neverActivated}
            subtitle="Users who never activated"
            icon={<Users className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Referral Rewards Section */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Referral Rewards (Refer-to-Unlock)</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Active Basic Rewards"
            value={metrics.referralRewards.activeBasic}
            subtitle="3-month Basic unlocks (1 referral)"
            icon={<Gift className="h-4 w-4" />}
            badge={{ text: "Basic", variant: "outline" }}
          />
          <MetricCard
            title="Active Pro Rewards"
            value={metrics.referralRewards.activePro}
            subtitle="3-month Pro unlocks (3 referrals)"
            icon={<Gift className="h-4 w-4" />}
            badge={{ text: "Pro", variant: "default" }}
          />
          <MetricCard
            title="Total Basic Granted"
            value={metrics.referralRewards.totalBasic}
            subtitle="All-time Basic rewards"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            title="Total Pro Granted"
            value={metrics.referralRewards.totalPro}
            subtitle="All-time Pro rewards"
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Subscriptions & Revenue Section */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Subscriptions & Revenue</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Monthly Recurring Revenue"
            value={metrics.subscriptions.mrrFormatted}
            subtitle="Current MRR"
            icon={<DollarSign className="h-4 w-4" />}
            badge={{ text: "MRR", variant: "default" }}
          />
          <MetricCard
            title="Annual Recurring Revenue"
            value={metrics.subscriptions.arrFormatted}
            subtitle="Projected ARR"
            icon={<DollarSign className="h-4 w-4" />}
            badge={{ text: "ARR", variant: "secondary" }}
          />
          <MetricCard
            title="Active Subscriptions"
            value={metrics.subscriptions.total}
            subtitle="Paid subscribers"
            icon={<Users className="h-4 w-4" />}
          />
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <CardDescription className="text-sm font-medium">By Tier</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(metrics.subscriptions.byTier).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{tier}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
                {Object.keys(metrics.subscriptions.byTier).length === 0 && (
                  <p className="text-sm text-muted-foreground">No active subscriptions</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* User Growth Section */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">User Growth</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Users"
            value={metrics.users.total.toLocaleString()}
            subtitle="All registered users"
            icon={<Users className="h-4 w-4" />}
          />
          <MetricCard
            title="New Users (30d)"
            value={metrics.users.newLast30Days}
            subtitle="Last 30 days"
            icon={<TrendingUp className="h-4 w-4" />}
            trend={{
              value: metrics.users.growthRate,
              isPositive: metrics.users.growthRate > 0,
            }}
          />
          <MetricCard
            title="Searches This Month"
            value={metrics.usage.searchesThisMonth.toLocaleString()}
            subtitle={`Avg ${metrics.usage.avgSearchesPerUser} per user`}
            icon={<Activity className="h-4 w-4" />}
          />
          <MetricCard
            title="AI Ops This Month"
            value={metrics.usage.aiOpsThisMonth.toLocaleString()}
            subtitle="AI opportunities generated"
            icon={<Activity className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Conversion Funnel Section */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Pricing Conversion Funnel (Last 30 Days)</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Pricing Page Views"
            value={metrics.conversionFunnel.pageViews}
            subtitle="Visitors to /pricing"
            icon={<Target className="h-4 w-4" />}
          />
          <MetricCard
            title="Checkout Started"
            value={metrics.conversionFunnel.checkoutStarted}
            subtitle="Initiated checkout flow"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            title="Checkout Completed"
            value={metrics.conversionFunnel.checkoutCompleted}
            subtitle="Successful conversions"
            icon={<DollarSign className="h-4 w-4" />}
            badge={{ text: "Paid", variant: "default" }}
          />
          <MetricCard
            title="Conversion Rate"
            value={`${metrics.conversionFunnel.conversionRate}%`}
            subtitle="Checkout completion rate"
            icon={<Target className="h-4 w-4" />}
            badge={{
              text:
                parseFloat(metrics.conversionFunnel.conversionRate) >= 3
                  ? "Good"
                  : parseFloat(metrics.conversionFunnel.conversionRate) >= 1
                  ? "Fair"
                  : "Low",
              variant:
                parseFloat(metrics.conversionFunnel.conversionRate) >= 3
                  ? "default"
                  : parseFloat(metrics.conversionFunnel.conversionRate) >= 1
                  ? "secondary"
                  : "destructive",
            }}
          />
        </div>
      </div>
    </div>
  );
}
