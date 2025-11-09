"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import {
  Search,
  Download,
  Brain,
  TrendingUp,
  AlertTriangle,
  Eye,
  ArrowRight,
  Sparkles,
  Target,
  BarChart3
} from "lucide-react";
import Link from "next/link";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NotificationCard } from "@/components/notifications/NotificationCard";

type UsageSummary = {
  plan: string;
  momentum: string;
  limits: {
    dailyQueryLimit: number;
    aiSuggestionLimit: number;
    watchlistLimit: number;
    watchlistItemCapacity: number;
  };
  usage: Record<string, number>;
};

type UsageKpiTone = "positive" | "caution" | "critical";

type UsageKpi = {
  id: string;
  label: string;
  value: string;
  helper?: string;
  progress?: {
    percent: number;
    caption: string;
    tone: UsageKpiTone;
  };
};

export default function DashboardPage(): JSX.Element {
  const { toast } = useToast();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [recentInsights, setRecentInsights] = useState<any>(null);
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const formatNumber = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 0,
      }),
    [],
  );

  // Load recent insights from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("lexybrain_xray_results");
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentInsights(parsed);
      }
    } catch (e) {
      // Ignore parse errors
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setUsage(null);
      return undefined;
    }

    let isMounted = true;
    const load = async () => {
      try {
        const response = await fetch("/api/usage/summary", {
          headers: { "x-user-id": userId },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Usage summary failed (${response.status})`);
        }
        const json = (await response.json()) as UsageSummary;
        if (isMounted) {
          setUsage(json);
        }
      } catch (error) {
        console.error("Failed to load usage summary", error);
        toast({
          title: "Usage summary unavailable",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "warning",
        });
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [toast, userId]);

  const usageCards = useMemo<UsageKpi[]>(() => {
    if (!usage) {
      return [
        { id: "plan", label: "Plan overview", value: "Loading…" },
        { id: "queries", label: "Daily keyword queries", value: "—", helper: "Waiting for data" },
        { id: "ai", label: "AI suggestions", value: "—", helper: "Waiting for data" },
        { id: "watchlist", label: "Watchlist additions", value: "—", helper: "Waiting for data" },
      ];
    }

    const aiConsumed = usage.usage?.ai_suggestion ?? 0;
    const aiLimit = usage.limits.aiSuggestionLimit;
    const aiPercent = aiLimit > 0 ? Math.min(aiConsumed / aiLimit, 1) : 0;
    const aiRemaining = Math.max(aiLimit - aiConsumed, 0);

    const keywordQueries = usage.usage?.keyword_query ?? 0;
    const queryLimit = usage.limits.dailyQueryLimit;
    const queryPercent = queryLimit > 0 ? Math.min(keywordQueries / queryLimit, 1) : 0;
    const queryRemaining = Math.max(queryLimit - keywordQueries, 0);

    const watchlistAdds = usage.usage?.watchlist_add ?? 0;
    const watchlistLimit = usage.limits.watchlistItemCapacity;
    const watchlistPercent = watchlistLimit > 0 ? Math.min(watchlistAdds / watchlistLimit, 1) : 0;
    const watchlistRemaining = Math.max(watchlistLimit - watchlistAdds, 0);

    const resolveTone = (percent: number): UsageKpiTone => {
      if (percent <= 0.6) {
        return "positive";
      }
      if (percent <= 0.85) {
        return "caution";
      }
      return "critical";
    };

    const formatCaption = (remaining: number, unit: string): string => {
      if (remaining <= 0) {
        return `Limit reached`;
      }
      return `${formatNumber.format(remaining)} ${unit} left`;
    };

    return [
      {
        id: "plan",
        label: "Current plan",
        value: `${usage.plan} · ${usage.momentum}`,
      },
      {
        id: "queries",
        label: "Keyword queries",
        value: `${formatNumber.format(keywordQueries)} / ${formatNumber.format(queryLimit)}`,
        progress: {
          percent: Math.round(queryPercent * 100),
          caption: formatCaption(queryRemaining, "queries"),
          tone: resolveTone(queryPercent),
        },
      },
      {
        id: "ai",
        label: "AI suggestions",
        value: `${formatNumber.format(aiConsumed)} / ${formatNumber.format(aiLimit)}`,
        progress: {
          percent: Math.round(aiPercent * 100),
          caption: formatCaption(aiRemaining, "suggestions"),
          tone: resolveTone(aiPercent),
        },
      },
      {
        id: "watchlist",
        label: "Watchlist items",
        value: `${formatNumber.format(watchlistAdds)} / ${formatNumber.format(watchlistLimit)}`,
        progress: {
          percent: Math.round(watchlistPercent * 100),
          caption: formatCaption(watchlistRemaining, "spots"),
          tone: resolveTone(watchlistPercent),
        },
      },
    ];
  }, [formatNumber, usage]);

  const planCard = usageCards.find((card) => card.id === "plan");
  const queryCard = usageCards.find((card) => card.id === "queries");
  const aiCard = usageCards.find((card) => card.id === "ai");
  const watchlistCard = usageCards.find((card) => card.id === "watchlist");

  const kpiCards = [queryCard, aiCard, watchlistCard].filter(
    (card): card is UsageKpi => Boolean(card),
  );

  return (
    <div className="space-y-6">
      {/* Hero Section - Redesigned */}
      <Card className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold">Welcome back!</CardTitle>
              <CardDescription className="text-base">
                Here&apos;s your LexyHub overview - track usage, explore insights, and grow your business
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              {planCard?.value ?? "Calculating"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Notification Card */}
      <NotificationCard />

      {/* Main Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Usage & Quick Actions */}
        <div className="space-y-6 lg:col-span-2">
          {/* Usage KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {kpiCards.map((card) => {
              const progressColor = card.progress?.tone === "positive"
                ? "bg-green-500"
                : card.progress?.tone === "caution"
                ? "bg-yellow-500"
                : card.progress?.tone === "critical"
                ? "bg-red-500"
                : undefined;

              const iconColor = card.progress?.tone === "positive"
                ? "text-green-600 dark:text-green-400"
                : card.progress?.tone === "caution"
                ? "text-yellow-600 dark:text-yellow-400"
                : card.progress?.tone === "critical"
                ? "text-red-600 dark:text-red-400"
                : "text-blue-600 dark:text-blue-400";

              const icon = card.id === "queries" ? <Search className={`h-5 w-5 ${iconColor}`} />
                : card.id === "ai" ? <Sparkles className={`h-5 w-5 ${iconColor}`} />
                : <Eye className={`h-5 w-5 ${iconColor}`} />;

              return (
                <Card key={card.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2">
                      {icon}
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          card.progress?.tone === "positive" && "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
                          card.progress?.tone === "caution" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
                          card.progress?.tone === "critical" && "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                        )}
                      >
                        {card.progress?.percent}%
                      </Badge>
                    </div>
                    <CardDescription className="text-xs font-medium">
                      {card.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xl font-bold">{card.value}</div>
                    {card.progress && (
                      <div className="space-y-1">
                        <Progress
                          value={card.progress.percent}
                          className="h-1.5"
                          indicatorClassName={progressColor}
                        />
                        <p className="text-xs text-muted-foreground">{card.progress.caption}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Recent LexyBrain Insights */}
          {recentInsights && (
            <Card className="border-2 border-purple-200 dark:border-purple-800">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      Latest Market Analysis
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {recentInsights.nicheTerms} • {new Date(recentInsights.timestamp).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/insights">
                      View Details
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4">
                  {recentInsights.results?.brief?.top_opportunities?.length > 0 && (
                    <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                      <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-600 dark:text-green-400" />
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {recentInsights.results.brief.top_opportunities.length}
                      </div>
                      <div className="text-xs text-muted-foreground">Opportunities</div>
                    </div>
                  )}
                  {recentInsights.results?.risks?.alerts && (
                    <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                      <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-red-600 dark:text-red-400" />
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {recentInsights.results.risks.alerts.filter((a: any) => a.severity === 'high').length}
                      </div>
                      <div className="text-xs text-muted-foreground">High Risks</div>
                    </div>
                  )}
                  {recentInsights.results?.brief?.confidence && (
                    <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                      <Target className="h-5 w-5 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {Math.round(recentInsights.results.brief.confidence * 100)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Confidence</div>
                    </div>
                  )}
                </div>

                {recentInsights.results?.brief?.top_opportunities?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Top Opportunity:</h4>
                    <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start gap-2">
                          <Badge className="bg-green-600 text-white shrink-0">1</Badge>
                          <div>
                            <strong className="text-green-700 dark:text-green-300">
                              {recentInsights.results.brief.top_opportunities[0].term}
                            </strong>
                            <p className="text-xs text-muted-foreground mt-1">
                              {recentInsights.results.brief.top_opportunities[0].why}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions - Redesigned */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="hover:shadow-md transition-shadow border-2 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-600" />
                  Search Keywords
                </CardTitle>
                <CardDescription className="text-xs">
                  Find profitable keywords for your listings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                  <Link href="/keywords">
                    Start Searching
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow border-2 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  AI Market Analysis
                </CardTitle>
                <CardDescription className="text-xs">
                  Get comprehensive market insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" asChild>
                  <Link href="/insights">
                    Run Analysis
                    <Sparkles className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column - Tools & Resources */}
        <div className="space-y-6">
          {/* LexyBrain Features */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                LexyBrain AI Tools
              </CardTitle>
              <CardDescription className="text-xs">
                Powered by Llama-3-8B
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/insights?tab=keyword-analysis">
                <div className="p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors border border-transparent hover:border-purple-200 dark:hover:border-purple-800">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-sm">Keyword Analysis</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Complete market intelligence</p>
                </div>
              </Link>

              <Link href="/insights?tab=neural-map">
                <div className="p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors border border-transparent hover:border-purple-200 dark:hover:border-purple-800">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-sm">Neural Map</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Visualize keyword relationships</p>
                </div>
              </Link>

              <div className="pt-3 border-t">
                <Button variant="outline" className="w-full text-xs" asChild>
                  <Link href="/insights">
                    Open LexyBrain
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resources</CardTitle>
              <CardDescription className="text-xs">
                Tools to grow your business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-sm" size="sm" asChild>
                <Link href="/watchlist">
                  <Eye className="mr-2 h-4 w-4" />
                  View Watchlist
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm" size="sm" asChild>
                <a href="https://chromewebstore.google.com/detail/lexyhub-etsy-keyword-seo/nfianbjinfbchfmmappglgkdpchfnlkd" target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Chrome Extension
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Tips Card */}
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Quick Tip
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Run a <strong>LexyBrain Analysis</strong> weekly to stay ahead of market trends and discover new opportunities before your competition!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
