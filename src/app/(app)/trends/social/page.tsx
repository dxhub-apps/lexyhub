"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import Link from "next/link";
import {
  TrendingUp,
  Filter,
  ExternalLink,
  RefreshCw,
  Loader2,
  Users,
  Hash,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlatformBadge, SentimentBadge, MomentumIndicator } from "@/components/social";

type TrendingKeyword = {
  keyword_id: string;
  term: string;
  market?: string;
  platform_count: number;
  platforms: string[];
  total_mentions: number;
  weighted_engagement: number;
  avg_sentiment: number;
  trend_momentum: number;
  platform_breakdown: Record<
    string,
    {
      mentions: number;
      engagement: number;
      sentiment: number;
    }
  >;
  last_collected: string;
};

type FilterOptions = {
  minPlatforms: number;
  sentiment: "all" | "positive" | "negative" | "neutral";
  limit: number;
  lookbackDays: number;
};

export default function SocialTrendsPage(): JSX.Element {
  const [trends, setTrends] = useState<TrendingKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    minPlatforms: 2,
    sentiment: "all",
    limit: 50,
    lookbackDays: 7,
  });
  const { toast } = useToast();
  const session = useSession();

  const loadTrends = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        min_platforms: filters.minPlatforms.toString(),
        limit: filters.limit.toString(),
        lookback_days: filters.lookbackDays.toString(),
      });

      if (filters.sentiment !== "all") {
        params.append("sentiment", filters.sentiment);
      }

      const response = await fetch(`/api/trends/social?${params}`);

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to load trends (${response.status})`);
      }

      const data = await response.json();
      setTrends(data.trends || []);
    } catch (err) {
      console.error("Failed to load social trends", err);
      setError(err instanceof Error ? err.message : "Failed to load social trends");
      toast({
        title: "Error loading trends",
        description: err instanceof Error ? err.message : "Failed to load social trends",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    void loadTrends();
  }, [loadTrends]);

  const handleRefresh = () => {
    void loadTrends();
  };

  const handleAddToWatchlist = async (keyword: TrendingKeyword) => {
    if (!session?.user?.id) {
      toast({
        title: "Sign in required",
        description: "You must be signed in to save to watchlist.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/watchlists/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": session.user.id,
        },
        body: JSON.stringify({
          keywordId: keyword.keyword_id,
          watchlistName: "Lexy Tracking",
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to add to watchlist");
      }

      toast({
        title: "Added to watchlist",
        description: `"${keyword.term}" is now being tracked.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Watchlist error",
        description: err instanceof Error ? err.message : "Failed to add to watchlist",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <Badge variant="outline" className="w-fit">
                Multi-Platform Insights
              </Badge>
              <CardTitle className="text-3xl font-bold">Social Trending Keywords</CardTitle>
              <CardDescription className="text-base">
                Discover trending keywords appearing across multiple social media platforms including Reddit, Twitter, Pinterest, and Google Trends.
              </CardDescription>
            </div>
            <Button onClick={handleRefresh} disabled={loading} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Refine trending keywords by platform count, sentiment, and date range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Platforms</label>
              <Select
                value={filters.minPlatforms.toString()}
                onValueChange={(value) =>
                  setFilters({ ...filters, minPlatforms: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1+ platforms</SelectItem>
                  <SelectItem value="2">2+ platforms</SelectItem>
                  <SelectItem value="3">3+ platforms</SelectItem>
                  <SelectItem value="4">4+ platforms</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sentiment</label>
              <Select
                value={filters.sentiment}
                onValueChange={(value: any) =>
                  setFilters({ ...filters, sentiment: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiments</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Lookback Period</label>
              <Select
                value={filters.lookbackDays.toString()}
                onValueChange={(value) =>
                  setFilters({ ...filters, lookbackDays: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Results Limit</label>
              <Select
                value={filters.limit.toString()}
                onValueChange={(value) =>
                  setFilters({ ...filters, limit: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 keywords</SelectItem>
                  <SelectItem value="50">50 keywords</SelectItem>
                  <SelectItem value="100">100 keywords</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading trending keywords...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : trends.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No trending keywords found matching your filters. Try adjusting the criteria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {trends.length} Trending Keyword{trends.length !== 1 ? "s" : ""}
              </CardTitle>
              <CardDescription>
                Keywords appearing on {filters.minPlatforms}+ platforms in the last{" "}
                {filters.lookbackDays} days
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4">
            {trends.map((keyword, index) => (
              <Card
                key={keyword.keyword_id}
                className="hover:border-primary transition-all hover:shadow-md"
              >
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-lg font-semibold px-3 py-1">
                            #{index + 1}
                          </Badge>
                          <Link
                            href={`/keywords/${encodeURIComponent(keyword.term)}`}
                            className="text-2xl font-bold hover:text-primary transition-colors inline-flex items-center gap-2"
                          >
                            {keyword.term}
                            <ExternalLink className="h-5 w-5" />
                          </Link>
                        </div>

                        {keyword.market && (
                          <Badge variant="secondary" className="text-xs">
                            {keyword.market.toUpperCase()}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddToWatchlist(keyword)}
                        >
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Watch
                        </Button>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Hash className="h-3 w-3" />
                          Mentions
                        </div>
                        <div className="text-xl font-bold">
                          {keyword.total_mentions.toLocaleString()}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          Platforms
                        </div>
                        <div className="text-xl font-bold">{keyword.platform_count}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3" />
                          Engagement
                        </div>
                        <div className="text-xl font-bold">
                          {keyword.weighted_engagement.toFixed(0)}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3" />
                          Sentiment
                        </div>
                        <SentimentBadge sentiment={keyword.avg_sentiment} showLabel={false} />
                      </div>
                    </div>

                    {/* Platforms and Momentum */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {keyword.platforms.map((platform) => (
                          <PlatformBadge
                            key={platform}
                            platform={platform as any}
                            count={keyword.platform_breakdown[platform]?.mentions}
                          />
                        ))}
                      </div>

                      {keyword.trend_momentum !== 0 && (
                        <MomentumIndicator momentum={keyword.trend_momentum} size="sm" />
                      )}
                    </div>

                    {/* Last Updated */}
                    <div className="text-xs text-muted-foreground">
                      Last collected:{" "}
                      {new Date(keyword.last_collected).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
