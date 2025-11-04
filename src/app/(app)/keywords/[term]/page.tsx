"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import {
  ArrowLeft,
  TrendingUp,
  BarChart3,
  Target,
  Star,
  Zap,
  ExternalLink,
  Loader2,
  Calendar,
  Tag as TagIcon,
  Activity
} from "lucide-react";
import Link from "next/link";

import KeywordTrendChart from "@/components/keywords/KeywordTrendChart";
import RelatedKeywords from "@/components/keywords/RelatedKeywords";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
  similarity?: number;
  compositeScore?: number;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const percent = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(clamp01(n) * 100) : 0;

const SOURCE_DETAILS: Record<string, { title: string; description: string }> = {
  synthetic: {
    title: "Synthetic AI",
    description: "AI-generated demand signals exploring new market territory",
  },
  amazon: {
    title: "Amazon Marketplace",
    description: "Real buyer search data from Amazon marketplace",
  },
};

export default function KeywordDetailsPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const term = decodeURIComponent(params.term as string);

  const [keyword, setKeyword] = useState<KeywordDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);

  // Fetch keyword details
  const fetchKeywordDetails = useCallback(async () => {
    if (!term) return;

    setLoading(true);
    setError(null);

    try {
      // Search for this specific keyword
      const response = await fetch("/api/keywords/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: term,
          market: "us",
          limit: 1,
          plan: "growth",
          sources: ["synthetic", "amazon"]
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to fetch keyword details (${response.status})`);
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        // Find exact match or closest match
        const exactMatch = data.results.find((r: any) =>
          r.term.toLowerCase() === term.toLowerCase()
        );
        setKeyword(exactMatch || data.results[0]);
      } else {
        setError("Keyword not found");
      }
    } catch (err: any) {
      console.error("Failed to fetch keyword details", err);
      setError(err?.message ?? "Failed to load keyword details");
    } finally {
      setLoading(false);
    }
  }, [term]);

  useEffect(() => {
    void fetchKeywordDetails();
  }, [fetchKeywordDetails]);

  const handleAddToWatchlist = async () => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "You must be signed in to save to watchlist.",
        variant: "destructive"
      });
      return;
    }

    if (!keyword?.id) {
      toast({
        title: "Error",
        description: "Cannot add keyword without ID to watchlist.",
        variant: "destructive"
      });
      return;
    }

    setAddingToWatchlist(true);
    try {
      const response = await fetch("/api/watchlists/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId
        },
        body: JSON.stringify({
          keywordId: keyword.id,
          watchlistName: "Lexy Tracking"
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to add to watchlist (${response.status})`);
      }

      toast({
        title: "Added to watchlist",
        description: `"${keyword.term}" is now being tracked.`,
        variant: "success"
      });
    } catch (err: any) {
      toast({
        title: "Watchlist error",
        description: err?.message ?? "Failed to add to watchlist",
        variant: "destructive"
      });
    } finally {
      setAddingToWatchlist(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading keyword details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !keyword) {
    return (
      <div className="space-y-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error ?? "Keyword not found"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/keywords")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Keywords
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const demandScore = percent(keyword.demand_index ?? keyword.ai_opportunity_score);
  const competitionScore = percent(keyword.competition_score ?? keyword.compositeScore);
  const trendScore = percent(keyword.trend_momentum);
  const engagementScore = percent(keyword.engagement_score);

  const tags = (keyword.extras?.["tags"] as string[] | undefined) ?? [];
  const category = keyword.extras?.["category"] as string | undefined;
  const sourceInfo = SOURCE_DETAILS[keyword.source] ?? {
    title: keyword.source,
    description: "Market data source"
  };

  const sparklinePoints = [{
    value: clamp01(keyword.trend_momentum ?? keyword.ai_opportunity_score ?? 0.5),
    label: keyword.term,
    timestamp: keyword.freshness_ts ?? null
  }];

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/keywords")}
                className="-ml-3"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Keywords
              </Button>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Keyword Details</Badge>
                  <Badge variant="secondary">{sourceInfo.title}</Badge>
                </div>
                <CardTitle className="text-4xl font-bold">{keyword.term}</CardTitle>
                <CardDescription className="text-base">
                  {sourceInfo.description}
                </CardDescription>
              </div>

              {category && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TagIcon className="h-4 w-4" />
                  <span>Category: {category}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleAddToWatchlist}
              disabled={addingToWatchlist || !keyword.id}
            >
              {addingToWatchlist ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Star className="mr-2 h-4 w-4" />
                  Add to Watchlist
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

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
              <div className="text-3xl font-bold">{demandScore}%</div>
              <Progress value={demandScore} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Indicates search demand and market interest
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
                Market saturation and competitive intensity
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
                Growth trajectory and trending potential
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
                User interaction and conversion signals
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
          <CardDescription>
            Intelligence summary and performance indicators
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Opportunity Assessment */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Opportunity Assessment</h3>
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
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
                  <Badge variant="default" className="bg-green-600">
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
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Source: </span>
                  <span className="font-medium">{sourceInfo.title}</span>
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

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
          <CardDescription>
            Recommended actions to capitalize on this opportunity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {demandScore > 60 && competitionScore < 50 && (
              <li className="flex gap-2">
                <Badge variant="outline" className="shrink-0">1</Badge>
                <span>
                  <strong>High Priority:</strong> This keyword shows strong demand with manageable competition.
                  Consider developing a product targeting this search term.
                </span>
              </li>
            )}
            <li className="flex gap-2">
              <Badge variant="outline" className="shrink-0">{demandScore > 60 && competitionScore < 50 ? "2" : "1"}</Badge>
              <span>
                <strong>Market Research:</strong> Use the Market Twin simulator to test different product variations
                and optimize visibility for this keyword.
              </span>
            </li>
            <li className="flex gap-2">
              <Badge variant="outline" className="shrink-0">{demandScore > 60 && competitionScore < 50 ? "3" : "2"}</Badge>
              <span>
                <strong>Track Progress:</strong> Add this keyword to your watchlist to monitor trend changes
                and timing for market entry.
              </span>
            </li>
            <li className="flex gap-2">
              <Badge variant="outline" className="shrink-0">{demandScore > 60 && competitionScore < 50 ? "4" : "3"}</Badge>
              <span>
                <strong>Find Related Terms:</strong> Search for similar keywords to identify complementary
                opportunities and build a comprehensive product strategy.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Related Keywords */}
      <Card>
        <CardHeader>
          <CardTitle>Related Opportunities</CardTitle>
          <CardDescription>
            AI-powered keyword suggestions based on user intent and behavioral patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RelatedKeywords keyword={term} market={keyword.market} />
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/market-twin?keyword=${encodeURIComponent(term)}`}>
                <Zap className="mr-2 h-4 w-4" />
                Run Market Simulation
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/keywords?query=${encodeURIComponent(term)}`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Explore Similar Keywords
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/niche-explorer?niche=${encodeURIComponent(term)}`}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Explore Niche
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/watchlists">
                <Star className="mr-2 h-4 w-4" />
                View Watchlist
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
