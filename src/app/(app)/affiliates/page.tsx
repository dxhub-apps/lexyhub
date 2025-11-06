"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import {
  Copy,
  DollarSign,
  Users,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { UpdateAffiliateProfileModal } from "@/components/affiliates/UpdateAffiliateProfileModal";

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

type AffiliateKPIs = {
  balance: {
    pendingCents: number;
    totalEarningsCents: number;
    paidCents: number;
  };
  payout: {
    nextPayoutDate: string | null;
    nextPayoutStatus: string | null;
    minPayoutCents: number;
  };
  stats: {
    totalReferrals: number;
    commissionRate: number;
  };
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

const ITEMS_PER_PAGE = 10;

export default function AffiliatesPage(): JSX.Element {
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AffiliateDashboardData | null>(null);
  const [kpis, setKpis] = useState<AffiliateKPIs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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
      const [dashboardResponse, kpisResponse] = await Promise.all([
        fetch(`/api/affiliate/dashboard?userId=${encodeURIComponent(userId)}`),
        fetch(`/api/affiliates/kpis?userId=${encodeURIComponent(userId)}`),
      ]);

      const dashboardJson = await dashboardResponse.json();
      const kpisJson = await kpisResponse.json();

      if (!dashboardResponse.ok) {
        if (dashboardResponse.status === 404) {
          setError("You are not registered as an affiliate.");
        } else {
          throw new Error(dashboardJson.error ?? "Failed to load dashboard");
        }
        return;
      }

      if (!kpisResponse.ok) {
        throw new Error(kpisJson.error ?? "Failed to load KPIs");
      }

      setData(dashboardJson);
      setKpis(kpisJson);
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

  if (!data || !kpis) {
    return <></>;
  }

  // Pagination logic
  const totalPages = Math.ceil(data.referrals.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentReferrals = data.referrals.slice(startIndex, endIndex);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Affiliate Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              Track your referrals, earnings, and manage your affiliate profile
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant={data.affiliate.status === "active" ? "default" : "secondary"}
              className="text-sm"
            >
              {data.affiliate.status.toUpperCase()}
            </Badge>
            <Button variant="outline" onClick={() => setIsModalOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Update Profile
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Current Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(kpis.balance.pendingCents)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pending payout (min: {formatCurrency(kpis.payout.minPayoutCents)})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Earnings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(kpis.balance.totalEarningsCents)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(kpis.balance.paidCents)} paid out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Next Payout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {kpis.payout.nextPayoutDate ? formatDate(kpis.payout.nextPayoutDate) : "N/A"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpis.payout.nextPayoutStatus
                ? `Status: ${kpis.payout.nextPayoutStatus}`
                : "No scheduled payouts"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link Card */}
      <Card className="mb-8 border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Share this unique link to earn {(data.affiliate.base_rate * 100).toFixed(0)}% commission on
            referrals. This link cannot be changed.
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

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Referrals</CardTitle>
              <CardDescription>
                {data.referrals.length} total referral{data.referrals.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              <Users className="mr-1 h-3 w-3" />
              {kpis.stats.totalReferrals}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {data.referrals.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No referrals yet. Share your link to get started!
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {currentReferrals.map((referral) => {
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
                          Referred: {formatDate(referral.attributed_at)}
                        </p>
                      </div>
                      {isActive && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, data.referrals.length)} of{" "}
                    {data.referrals.length}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <div className="text-center text-sm text-muted-foreground">
        <p>
          Questions about your affiliate account?{" "}
          <a href="mailto:affiliates@lexyhub.com" className="underline hover:text-foreground">
            Contact affiliate support
          </a>
        </p>
      </div>

      {/* Update Affiliate Profile Modal */}
      <UpdateAffiliateProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          void loadData();
          setIsModalOpen(false);
        }}
        userId={userId ?? ""}
      />
    </div>
  );
}
