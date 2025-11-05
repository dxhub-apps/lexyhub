"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import {
  Copy,
  DollarSign,
  TrendingUp,
  Users,
  MousePointerClick,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";

type AffiliateDashboardData = {
  affiliate: {
    code: string;
    status: string;
    base_rate: number;
    lifetime: boolean;
    recur_months: number;
  };
  stats: {
    totalClicks: number;
    totalReferrals: number;
    totalEarnings: number;
    pendingEarnings: number;
    paidEarnings: number;
    conversionRate: string;
  };
  referrals: Array<{
    id: string;
    referred_user_id: string;
    ref_code: string;
    attributed_at: string;
    expires_at: string | null;
  }>;
  commissions: Array<{
    id: string;
    stripe_invoice_id: string;
    event_ts: string;
    amount_cents: number;
    status: string;
    reason: string;
  }>;
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AffiliateDashboardPage(): JSX.Element {
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AffiliateDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const referralLink = data
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${data.affiliate.code}`
    : "";

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/affiliate/dashboard?userId=${encodeURIComponent(userId)}`);
      const json = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setError("You are not registered as an affiliate.");
        } else {
          throw new Error(json.error ?? "Failed to load dashboard");
        }
        return;
      }

      setData(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast({
        title: "Error Loading Dashboard",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const copyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
        variant: "success",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <Clock className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading your affiliate dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="mb-2 text-2xl font-bold">Affiliate Dashboard Unavailable</h2>
            <p className="mb-6 text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">
              Interested in becoming an affiliate?{" "}
              <a href="mailto:affiliates@lexyhub.com" className="underline">
                Contact us
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Affiliate Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              Track your referrals and earnings
            </p>
          </div>
          <Badge
            variant={data.affiliate.status === "active" ? "default" : "secondary"}
            className="text-sm"
          >
            {data.affiliate.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Referral Link Card */}
      <Card className="mb-8 border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Share this link to earn {(data.affiliate.base_rate * 100).toFixed(0)}% commission on
            referrals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="font-mono text-sm" />
            <Button onClick={copyReferralLink} variant="outline" size="icon">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {data.affiliate.lifetime
              ? "Lifetime commissions on all referrals"
              : `Earn commissions for ${data.affiliate.recur_months} months per referral`}
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4" />
              Total Clicks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.stats.totalClicks.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Referrals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.stats.totalReferrals.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.stats.conversionRate}% conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Earnings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(data.stats.totalEarnings)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pending
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(data.stats.pendingEarnings)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(data.stats.paidEarnings)} paid
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Referrals */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
            <CardDescription>
              Your latest {data.referrals.length} referred users
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.referrals.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No referrals yet. Share your link to get started!
              </div>
            ) : (
              <div className="space-y-3">
                {data.referrals.slice(0, 10).map((referral) => {
                  const isActive =
                    !referral.expires_at || new Date(referral.expires_at) > new Date();
                  return (
                    <div
                      key={referral.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {referral.referred_user_id.slice(0, 8)}...
                          </span>
                          {isActive ? (
                            <Badge variant="default" className="text-xs">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Expired
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(referral.attributed_at)}
                        </p>
                      </div>
                      {isActive && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Commission History */}
        <Card>
          <CardHeader>
            <CardTitle>Commission History</CardTitle>
            <CardDescription>
              Your latest {data.commissions.length} commission records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.commissions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No commissions yet. Commissions are earned when referrals subscribe.
              </div>
            ) : (
              <div className="space-y-3">
                {data.commissions.slice(0, 10).map((commission) => (
                  <div
                    key={commission.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="font-semibold">
                        {formatCurrency(commission.amount_cents)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(commission.event_ts)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        commission.status === "paid"
                          ? "default"
                          : commission.status === "pending"
                            ? "secondary"
                            : "destructive"
                      }
                      className="text-xs"
                    >
                      {commission.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <div className="text-center text-sm text-muted-foreground">
        <p>
          Questions about your affiliate account?{" "}
          <a href="mailto:affiliates@lexyhub.com" className="underline hover:text-foreground">
            Contact affiliate support
          </a>
        </p>
      </div>
    </div>
  );
}
