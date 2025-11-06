"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  TrendingUp,
  BarChart3,
  Target,
  Sparkles,
  Loader2,
  Globe,
  Activity,
  AlertCircle,
} from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { OpportunityQuadrant } from "@/components/niche-explorer/OpportunityQuadrant";
import { KeywordClusterMap } from "@/components/niche-explorer/KeywordClusterMap";
import { Progress } from "@/components/ui/progress";

type NicheAnalysis = {
  overview: {
    totalKeywords: number;
    avgDemand: number;
    avgCompetition: number;
    momentum: "expanding" | "stable" | "cooling";
    topMarkets: Array<{ market: string; share: number }>;
  };
  keywords: Array<{
    term: string;
    demand: number;
    competition: number;
    opportunity: number;
    momentum: number;
    freshness: "emerging" | "stable" | "mature";
  }>;
  trends: {
    historical: Array<{ date: string; demand: number; competition: number }>;
    topGrowing: Array<{
      term: string;
      growthRate: number;
      searchVolume: number;
      socialMentions: number;
    }>;
  };
  clusters: Array<{
    name: string;
    keywords: string[];
    growthRate: number;
    opportunityScore: number;
  }>;
  forecast: Array<{
    cluster: string;
    prediction: "expanding" | "cooling" | "volatile";
    confidence: number;
  }>;
  recommendations: {
    opportunities: string[];
    phaseOut: string[];
    synonymGaps: string[];
  };
};

export default function NicheExplorerPage(): JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [niche, setNiche] = useState(searchParams?.get("niche") || "");
  const [analysis, setAnalysis] = useState<NicheAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<"all" | "emerging" | "stable">("all");

  useEffect(() => {
    const initialNiche = searchParams?.get("niche");
    if (initialNiche && !analysis) {
      setNiche(initialNiche);
      void analyzeNiche(initialNiche);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const analyzeNiche = async (nicheValue?: string) => {
    const searchValue = nicheValue || niche;
    if (!searchValue.trim()) {
      toast({
        title: "Niche required",
        description: "Please enter a niche to analyze",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/niche-explorer/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: searchValue, market: "us" }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed (${response.status})`);
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setSelectedKeywords([]);

      // Update URL
      router.push(`/niche-explorer?niche=${encodeURIComponent(searchValue)}`);
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis failed",
        description: error.message || "Failed to analyze niche",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredKeywords = useMemo(() => {
    if (!analysis) return [];
    if (filterMode === "all") return analysis.keywords;
    if (filterMode === "emerging") {
      return analysis.keywords.filter((kw) => kw.freshness === "emerging");
    }
    return analysis.keywords.filter((kw) => kw.freshness === "stable");
  }, [analysis, filterMode]);


  const getMomentumColor = (momentum: string): string => {
    if (momentum === "expanding") return "text-green-600";
    if (momentum === "cooling") return "text-red-600";
    return "text-yellow-600";
  };

  const getMomentumBadgeVariant = (momentum: string) => {
    if (momentum === "expanding") return "default";
    if (momentum === "cooling") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <Badge variant="outline" className="w-fit">Market Intelligence</Badge>
              <CardTitle className="text-3xl font-bold">Niche Explorer</CardTitle>
              <CardDescription className="text-base">
                Transform vague niche ideas into quantifiable keyword clusters and immediate actions
              </CardDescription>
            </div>
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter a niche (e.g., boho jewelry, eco candles, minimalist art)"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyzeNiche()}
              className="h-11"
            />
            <Button onClick={() => analyzeNiche()} disabled={loading} className="h-11">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Show empty state if no analysis */}
      {!analysis && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ready to explore a niche?</h3>
            <p className="text-muted-foreground mb-4">
              Enter a niche keyword above to get comprehensive market intelligence
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => { setNiche("boho jewelry"); analyzeNiche("boho jewelry"); }}>
                Try: boho jewelry
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setNiche("eco candles"); analyzeNiche("eco candles"); }}>
                Try: eco candles
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setNiche("minimalist art"); analyzeNiche("minimalist art"); }}>
                Try: minimalist art
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* 1. Niche Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Niche Overview
              </CardTitle>
              <CardDescription>Auto-generated market summary for &ldquo;{niche}&rdquo;</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total Keywords</p>
                  <p className="text-3xl font-bold">{analysis.overview.totalKeywords.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Avg Demand</p>
                  <p className="text-3xl font-bold text-blue-600">{analysis.overview.avgDemand}%</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Avg Competition</p>
                  <p className="text-3xl font-bold text-orange-600">{analysis.overview.avgCompetition}%</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Market Momentum</p>
                  <Badge variant={getMomentumBadgeVariant(analysis.overview.momentum)} className="text-sm">
                    {analysis.overview.momentum}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Top Markets</h4>
                <div className="space-y-2">
                  {analysis.overview.topMarkets.map((market) => (
                    <div key={market.market} className="flex items-center gap-3">
                      <span className="text-sm font-medium w-20">{market.market}</span>
                      <Progress value={market.share} className="flex-1 h-2" />
                      <span className="text-sm text-muted-foreground w-12 text-right">{market.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Keyword Landscape */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Keyword Landscape
                  </CardTitle>
                  <CardDescription>Top keywords driving this niche</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={filterMode === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterMode("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={filterMode === "emerging" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterMode("emerging")}
                  >
                    Emerging
                  </Button>
                  <Button
                    variant={filterMode === "stable" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterMode("stable")}
                  >
                    Stable
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium">Keyword</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Demand</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Competition</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Opportunity</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Momentum</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Freshness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKeywords.slice(0, 20).map((keyword, index) => (
                      <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/keywords/${encodeURIComponent(keyword.term)}`}
                            className="text-sm font-medium hover:text-primary"
                          >
                            {keyword.term}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-blue-600">{keyword.demand}%</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-orange-600">{keyword.competition}%</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-green-600">{keyword.opportunity}%</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm">{keyword.momentum}%</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={keyword.freshness === "emerging" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {keyword.freshness}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 3. Trend Acceleration Graph */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Trend Acceleration
              </CardTitle>
              <CardDescription>Growth trajectory of top performing keywords</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analysis.trends.topGrowing} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="term" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={80} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="searchVolume"
                    stroke="#3366FF"
                    strokeWidth={2}
                    name="Search Volume"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="socialMentions"
                    stroke="#16A34A"
                    strokeWidth={2}
                    name="Social Mentions"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 4. Opportunity Quadrant */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Opportunity Quadrant
              </CardTitle>
              <CardDescription>Demand × Competition analysis - click points for details</CardDescription>
            </CardHeader>
            <CardContent>
              <OpportunityQuadrant
                keywords={analysis.keywords.map((kw) => ({
                  term: kw.term,
                  demand: kw.demand,
                  competition: kw.competition,
                  opportunity: kw.opportunity,
                }))}
                onPointClick={(keyword) => {
                  router.push(`/keywords/${encodeURIComponent(keyword.term)}`);
                }}
              />
            </CardContent>
          </Card>

          {/* 5. Keyword Cluster Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Keyword Clusters
              </CardTitle>
              <CardDescription>Auto-grouped themes within this niche</CardDescription>
            </CardHeader>
            <CardContent>
              <KeywordClusterMap clusters={analysis.clusters} />
            </CardContent>
          </Card>

          {/* 6. Forecast Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Market Forecast</CardTitle>
              <CardDescription>Predicted trends for the next 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.forecast.map((forecast, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{forecast.cluster}</h4>
                      <Badge variant={getMomentumBadgeVariant(forecast.prediction)}>
                        {forecast.prediction}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Confidence Level:</span>
                        <span className="font-semibold">{forecast.confidence}%</span>
                      </div>
                      <Progress value={forecast.confidence} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 7. Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Strategic Recommendations
              </CardTitle>
              <CardDescription>Data-driven insights for your niche strategy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3 text-green-600">Top Opportunities</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.recommendations.opportunities.map((kw, idx) => (
                    <Link key={idx} href={`/keywords/${encodeURIComponent(kw)}`}>
                      <Badge variant="outline" className="cursor-pointer hover:bg-green-50">
                        {kw}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-3 text-red-600">Consider Phasing Out</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.recommendations.phaseOut.map((kw, idx) => (
                    <Badge key={idx} variant="outline" className="text-red-600">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-3 text-blue-600">Synonym Gaps</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Related terms competitors use but you haven&apos;t tracked
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysis.recommendations.synonymGaps.map((kw, idx) => (
                    <Link key={idx} href={`/keywords/${encodeURIComponent(kw)}`}>
                      <Badge variant="outline" className="cursor-pointer hover:bg-blue-50">
                        {kw}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 8. Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
              <CardDescription>
                Explore more keyword opportunities and optimize your listings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <Link href="/keywords">
                    <Search className="mr-2 h-4 w-4" />
                    Keyword Explorer
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/editing">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Optimize Listings
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
