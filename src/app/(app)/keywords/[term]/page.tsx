"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import {
  ArrowLeft,
  Star,
  Loader2,
  BarChart3,
  Brain,
  TrendingUp,
  Users,
  MessageSquare,
} from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { KeywordOverviewTab } from "@/components/keywords/KeywordOverviewTab";
import { KeywordInsightsTab } from "@/components/keywords/KeywordInsightsTab";
import { KeywordTrendsTab } from "@/components/keywords/KeywordTrendsTab";
import { KeywordCompetitorsTab } from "@/components/keywords/KeywordCompetitorsTab";
import { KeywordChatTab } from "@/components/keywords/KeywordChatTab";

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
  base_demand_index?: number | null;
  adjusted_demand_index?: number | null;
  deseasoned_trend_momentum?: number | null;
  seasonal_label?: string | null;
};

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

export default function KeywordJourneyPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const term = decodeURIComponent(params.term as string);
  const [activeTab, setActiveTab] = useState("overview");

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
      const response = await fetch(
        `/api/keywords/by-term/${encodeURIComponent(term)}?market=us`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to fetch keyword details (${response.status})`);
      }

      const data = await response.json();

      if (data.keyword) {
        setKeyword(data.keyword);
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
              <p className="text-sm text-muted-foreground">Loading keyword intelligence...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !keyword) {
    return (
      <div className="space-y-8">
        <Card className="border-2 border-destructive bg-card">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription className="text-destructive">{error ?? "Keyword not found"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/keywords")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Search
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sourceInfo = SOURCE_DETAILS[keyword.source] ?? {
    title: keyword.source,
    description: "Market data source"
  };

  return (
    <div className="space-y-6">
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
                Back to Search
              </Button>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Keyword Intelligence</Badge>
                  <Badge variant="secondary">{sourceInfo.title}</Badge>
                  {keyword.seasonal_label && (
                    <Badge variant="default">{keyword.seasonal_label}</Badge>
                  )}
                </div>
                <h1 className="text-[32px] font-bold tracking-tight leading-tight">{keyword.term}</h1>
                <CardDescription className="text-base">
                  Comprehensive market intelligence powered by LexyBrain
                </CardDescription>
              </div>
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

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid bg-muted">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="insights" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="trends" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trends
              </TabsTrigger>
              <TabsTrigger value="competitors" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Competitors
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Ask LexyBrain
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>

        <TabsContent value="overview" className="space-y-6">
          <KeywordOverviewTab keyword={keyword} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <KeywordInsightsTab keyword={keyword} userId={userId} />
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <KeywordTrendsTab keyword={keyword} />
        </TabsContent>

        <TabsContent value="competitors" className="space-y-6">
          <KeywordCompetitorsTab keyword={keyword} />
        </TabsContent>

        <TabsContent value="chat" className="space-y-6">
          <KeywordChatTab keyword={keyword} userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
