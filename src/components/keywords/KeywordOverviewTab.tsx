"use client";

import {
  BarChart3,
  Target,
  TrendingUp,
  Activity,
  Calendar,
  ExternalLink,
  Zap,
  Tag as TagIcon,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import KeywordTrendChart from "./KeywordTrendChart";
import RelatedKeywords from "./RelatedKeywords";
import { SocialMetricsCard } from "@/components/social";

type KeywordDetails = {
  id?: string;
  term: string;
  market: string;
  source: string;
  tier?: string | number;
  method?: string | null;
  extras?: Record<string, unknown> | null;
  trend_momentum?: number | null;
  ai_opportunity_score?: number | null;
  demand_index?: number | null;
  competition_score?: number | null;
  engagement_score?: number | null;
  freshness_ts?: string | null;
  base_demand_index?: number | null;
  adjusted_demand_index?: number | null;
  deseasoned_trend_momentum?: number | null;
  seasonal_label?: string | null;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const percent = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(clamp01(n) * 100) : 0;

export function KeywordOverviewTab({ keyword }: { keyword: KeywordDetails }) {
  const demandScore = percent(keyword.adjusted_demand_index ?? keyword.demand_index ?? keyword.ai_opportunity_score);
  const competitionScore = percent(keyword.competition_score);
  const trendScore = percent(keyword.deseasoned_trend_momentum ?? keyword.trend_momentum);
  const engagementScore = percent(keyword.engagement_score);

  const tags = (keyword.extras?.["tags"] as string[] | undefined) ?? [];
  const category = keyword.extras?.["category"] as string | undefined;

  return (
    <>
      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Demand Index</CardDescription>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold">{demandScore}%</div>
              </div>
              <Progress value={demandScore} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {keyword.adjusted_demand_index
                  ? "Seasonal-adjusted search demand"
                  : "Search demand and market interest"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Competition</CardDescription>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{competitionScore}%</div>
              <Progress value={competitionScore} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Market saturation and intensity
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Trend Momentum</CardDescription>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{trendScore}%</div>
              <Progress value={trendScore} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {keyword.deseasoned_trend_momentum
                  ? "Deseasoned growth trajectory"
                  : "Growth and trending potential"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Engagement</CardDescription>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{engagementScore}%</div>
              <Progress value={engagementScore} className="h-2" />
              <p className="text-xs text-muted-foreground">
                User interaction and conversion
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
          <CardDescription>
            Opportunity assessment and performance indicators
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Opportunity Assessment */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Opportunity Assessment</h3>
            <div className="rounded-lg border border-border bg-muted p-4 space-y-2">
              <p className="text-sm leading-relaxed">
                <strong>{keyword.term}</strong> shows{" "}
                {demandScore > 70 ? "strong" : demandScore > 40 ? "moderate" : "emerging"}{" "}
                demand signals with{" "}
                {competitionScore > 70 ? "high" : competitionScore > 40 ? "moderate" : "low"}{" "}
                competition. The{" "}
                {trendScore > 60 ? "positive" : "stable"} trend momentum suggests{" "}
                {trendScore > 60 ? "growing" : "consistent"} market interest.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {demandScore > 70 && (
                  <Badge variant="default">High Demand</Badge>
                )}
                {competitionScore < 40 && (
                  <Badge variant="default">Low Competition</Badge>
                )}
                {trendScore > 60 && (
                  <Badge variant="default">Trending Up</Badge>
                )}
                {demandScore > 60 && competitionScore < 50 && (
                  <Badge className="bg-success text-success-foreground">
                    Prime Opportunity
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Performance Trend</h3>
            <KeywordTrendChart
              keyword={keyword.term}
              demandScore={demandScore}
              competitionScore={competitionScore}
              trendScore={trendScore}
              engagementScore={engagementScore}
            />
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Data Lineage</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Last Updated: </span>
                  <span className="font-medium">
                    {keyword.freshness_ts
                      ? new Date(keyword.freshness_ts).toLocaleString()
                      : "Not available"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Market: </span>
                  <span className="font-medium">{keyword.market.toUpperCase()}</span>
                </div>
              </div>
              {keyword.method && (
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Method: </span>
                    <span className="font-medium">{keyword.method}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      {tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Associated Tags</CardTitle>
            <CardDescription>
              Relevant product attributes and categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-sm">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Social Media Insights */}
      {keyword.id && (
        <SocialMetricsCard
          keywordId={keyword.id}
          keywordTerm={keyword.term}
          lookbackDays={30}
        />
      )}

      {/* Related Keywords */}
      <Card>
        <CardHeader>
          <CardTitle>Related Opportunities</CardTitle>
          <CardDescription>
            AI-powered keyword suggestions based on user intent and behavioral patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RelatedKeywords keyword={keyword.term} market={keyword.market} />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Explore related keywords and track this opportunity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href={`/keywords?query=${encodeURIComponent(keyword.term)}`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Explore Similar Keywords
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/watchlists">
                <Activity className="mr-2 h-4 w-4" />
                View Watchlist
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
