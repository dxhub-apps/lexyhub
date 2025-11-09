"use client";

import { TrendingUp, Calendar, BarChart3 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import KeywordTrendChart from "./KeywordTrendChart";

type KeywordDetails = {
  id?: string;
  term: string;
  market: string;
  source: string;
  trend_momentum?: number | null;
  ai_opportunity_score?: number | null;
  demand_index?: number | null;
  competition_score?: number | null;
  engagement_score?: number | null;
  freshness_ts?: string | null;
  adjusted_demand_index?: number | null;
  deseasoned_trend_momentum?: number | null;
  seasonal_label?: string | null;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const percent = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(clamp01(n) * 100) : 0;

export function KeywordTrendsTab({ keyword }: { keyword: KeywordDetails }) {
  const demandScore = percent(keyword.adjusted_demand_index ?? keyword.demand_index ?? keyword.ai_opportunity_score);
  const competitionScore = percent(keyword.competition_score);
  const trendScore = percent(keyword.deseasoned_trend_momentum ?? keyword.trend_momentum);
  const engagementScore = percent(keyword.engagement_score);

  const isSeasonalAdjusted = !!keyword.adjusted_demand_index;
  const isDeseasonedTrend = !!keyword.deseasoned_trend_momentum;

  return (
    <>
      {/* Trend Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <div className="space-y-1">
              <CardTitle>Trend Analysis</CardTitle>
              <CardDescription>
                Historical performance and momentum indicators for &ldquo;{keyword.term}&rdquo;
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seasonal Adjustment Info */}
          {(isSeasonalAdjusted || isDeseasonedTrend || keyword.seasonal_label) && (
            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Seasonal Intelligence
                </h3>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {isSeasonalAdjusted && "Demand index has been seasonally adjusted to remove cyclical patterns. "}
                {isDeseasonedTrend && "Trend momentum is deseasoned to show underlying growth. "}
                {keyword.seasonal_label && (
                  <span>
                    This keyword is classified as <Badge variant="secondary" className="ml-1">{keyword.seasonal_label}</Badge>
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Trend Chart */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Performance Over Time</h3>
            <KeywordTrendChart
              keyword={keyword.term}
              demandScore={demandScore}
              competitionScore={competitionScore}
              trendScore={trendScore}
              engagementScore={engagementScore}
            />
          </div>

          {/* Momentum Summary */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Momentum Summary</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Current Trend</span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{trendScore}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {trendScore > 70 ? "Strong upward momentum" :
                   trendScore > 40 ? "Moderate growth" :
                   trendScore > 20 ? "Stable" : "Declining"}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Market Demand</span>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{demandScore}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {demandScore > 70 ? "High demand volume" :
                   demandScore > 40 ? "Moderate demand" :
                   "Emerging opportunity"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Card */}
      <Card>
        <CardHeader>
          <CardTitle>Growth Forecast</CardTitle>
          <CardDescription>
            Predictive indicators based on current momentum
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="text-sm font-semibold mb-2">Short-term Outlook (30 days)</h4>
              <p className="text-sm leading-relaxed">
                Based on the current trend momentum of <strong>{trendScore}%</strong>, this keyword is
                {trendScore > 60 ? " expected to continue growing" :
                 trendScore > 30 ? " likely to remain stable" :
                 " showing uncertain trajectory"}.
                {demandScore > 70 && " High existing demand provides a strong foundation for sustained interest."}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="text-sm font-semibold mb-2">Market Position</h4>
              <p className="text-sm leading-relaxed">
                {demandScore > 60 && competitionScore < 50 && "This keyword is in an attractive market position with strong demand and manageable competition. "}
                {demandScore > 60 && competitionScore >= 50 && "High demand but competitive market. Consider differentiation strategies. "}
                {demandScore <= 60 && competitionScore < 50 && "Emerging opportunity with low competition. Good for early movers. "}
                {demandScore <= 60 && competitionScore >= 50 && "Challenging market with moderate demand and competition. "}
                Monitor trend momentum to identify optimal entry timing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Freshness */}
      <Card>
        <CardHeader>
          <CardTitle>Data Currency</CardTitle>
          <CardDescription>
            When this data was last updated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Last updated: <strong>
                {keyword.freshness_ts
                  ? new Date(keyword.freshness_ts).toLocaleString()
                  : "Not available"}
              </strong>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Trend data is updated daily based on marketplace activity and search patterns.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
