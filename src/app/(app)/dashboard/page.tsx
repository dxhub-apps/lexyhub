"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { Search, Download } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const formatNumber = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 0,
      }),
    [],
  );

  const formatPercent = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "percent",
        maximumFractionDigits: 0,
      }),
    [],
  );

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
        return `Limit reached for ${unit}`;
      }
      return `${formatNumber.format(remaining)} ${unit} remaining`;
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

  const kpiCards = [planCard, queryCard, aiCard, watchlistCard].filter(
    (card): card is UsageKpi => Boolean(card),
  );

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold">Dashboard</CardTitle>
              <CardDescription className="text-base">
                Track your usage and discover keyword opportunities
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {planCard?.value ?? "Calculating"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Usage KPI Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const progressColor = card.progress?.tone === "positive"
            ? "bg-green-500"
            : card.progress?.tone === "caution"
            ? "bg-yellow-500"
            : card.progress?.tone === "critical"
            ? "bg-red-500"
            : undefined;

          return (
            <Card key={card.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardDescription className="text-sm font-medium">
                    {card.label}
                  </CardDescription>
                  {card.progress && (
                    <Badge
                      variant={card.progress.tone === "positive" ? "default" : "secondary"}
                      className={cn(
                        "h-5 gap-1 px-2 text-xs",
                        card.progress.tone === "caution" && "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-400",
                        card.progress.tone === "critical" && "bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-400"
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {card.progress.caption}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-bold">{card.value}</div>
                {card.helper && (
                  <p className="text-xs text-muted-foreground">{card.helper}</p>
                )}
                {card.progress && (
                  <div className="space-y-2">
                    <Progress
                      value={card.progress.percent}
                      className="h-2"
                      indicatorClassName={progressColor}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Quick actions to improve your listings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" size="lg" asChild>
              <a href="/keywords">
                <Search className="mr-2 h-4 w-4" />
                Search keywords
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start" size="lg" asChild>
              <a href="https://chromewebstore.google.com/detail/lexyhub-etsy-keyword-seo/nfianbjinfbchfmmappglgkdpchfnlkd" target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Install Chrome extension
              </a>
            </Button>
          </CardContent>
        </Card>
    </div>
  );
}
