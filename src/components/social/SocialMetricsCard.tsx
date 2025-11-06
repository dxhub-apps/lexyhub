// src/components/social/SocialMetricsCard.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { PlatformBadge } from "./PlatformBadge";
import { SentimentBadge } from "./SentimentBadge";
import { MomentumIndicator } from "./MomentumIndicator";
import { Users, Zap, Hash, TrendingUp } from "lucide-react";

interface SocialMetrics {
  keyword_id: string;
  term: string;
  market?: string;
  summary: {
    total_platforms: number;
    total_mentions: number;
    avg_sentiment: number;
    weighted_engagement: number;
    trend_momentum: number;
  };
  platforms: Array<{
    platform: string;
    mentions: number;
    engagement_score: number;
    sentiment_score: number;
    trending_subreddits?: string[];
    trending_hashtags?: string[];
    trending_categories?: string[];
  }>;
}

interface SocialMetricsCardProps {
  keywordId: string;
  keywordTerm: string;
  lookbackDays?: number;
}

export function SocialMetricsCard({
  keywordId,
  keywordTerm,
  lookbackDays = 30,
}: SocialMetricsCardProps) {
  const [metrics, setMetrics] = useState<SocialMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSocialMetrics() {
      if (!keywordId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/keywords/${keywordId}/social?lookback_days=${lookbackDays}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch social metrics (${response.status})`);
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to fetch social metrics:", err);
        setError(err instanceof Error ? err.message : "Failed to load social metrics");
      } finally {
        setLoading(false);
      }
    }

    fetchSocialMetrics();
  }, [keywordId, lookbackDays]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Social Media Insights
          </CardTitle>
          <CardDescription>
            Analyzing social trends across multiple platforms...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics || metrics.platforms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Social Media Insights
          </CardTitle>
          <CardDescription>
            No social media data available for this keyword yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Social media data will appear once this keyword has been collected across platforms like Reddit, Twitter, Pinterest, and Google Trends.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { summary, platforms } = metrics;
  const engagementPercent = Math.min(100, Math.round((summary.weighted_engagement / 1000) * 100));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Social Media Insights
            </CardTitle>
            <CardDescription>
              Past {lookbackDays} days across {summary.total_platforms} platform{summary.total_platforms !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          {summary.trend_momentum !== 0 && (
            <MomentumIndicator momentum={summary.trend_momentum} size="sm" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" />
              Mentions
            </div>
            <div className="text-2xl font-bold">
              {summary.total_mentions.toLocaleString()}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              Platforms
            </div>
            <div className="text-2xl font-bold">{summary.total_platforms}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              Engagement
            </div>
            <div className="flex items-baseline gap-1">
              <div className="text-2xl font-bold">{engagementPercent}%</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Sentiment
            </div>
            <div className="flex items-center gap-1">
              <SentimentBadge sentiment={summary.avg_sentiment} showLabel={false} />
              <span className="text-sm font-semibold">
                {summary.avg_sentiment > 0 ? "+" : ""}
                {(summary.avg_sentiment * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Engagement Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Overall Engagement Score</span>
            <span className="font-semibold">{summary.weighted_engagement.toFixed(0)}</span>
          </div>
          <Progress value={engagementPercent} className="h-2" />
        </div>

        {/* Platform Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Platform Breakdown</h4>
          <div className="space-y-2">
            {platforms
              .sort((a, b) => b.engagement_score - a.engagement_score)
              .map((platform) => (
                <div
                  key={platform.platform}
                  className="border rounded-lg p-3 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PlatformBadge
                          platform={platform.platform as any}
                          count={platform.mentions}
                        />
                        <SentimentBadge sentiment={platform.sentiment_score} />
                      </div>

                      {/* Trending topics */}
                      {platform.trending_hashtags && platform.trending_hashtags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">Trending:</span>
                          {platform.trending_hashtags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {platform.trending_subreddits && platform.trending_subreddits.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">Subreddits:</span>
                          {platform.trending_subreddits.slice(0, 3).map((sub) => (
                            <Badge key={sub} variant="secondary" className="text-xs">
                              r/{sub}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {platform.trending_categories && platform.trending_categories.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">Categories:</span>
                          {platform.trending_categories.slice(0, 2).map((cat) => (
                            <Badge key={cat} variant="secondary" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {platform.engagement_score.toFixed(0)}
                      </div>
                      <div className="text-xs text-muted-foreground">engagement</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
