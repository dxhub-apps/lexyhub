"use client";

import { useState, useEffect } from "react";
import { Loader2, TrendingUp, Shield, DollarSign, Target, AlertTriangle, CheckCircle2, FileText, Radar as RadarIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMarketplaces } from "@/lib/hooks/useMarketplaces";

/**
 * X-Ray Dashboard - Unified Market Intelligence
 *
 * Provides a comprehensive view of market insights in one click:
 * - Market Brief overview
 * - Opportunity Radar scores
 * - Ad budget recommendations
 * - Risk assessment
 */

// =====================================================
// Types
// =====================================================

interface XRayRequest {
  market: string;
  niche_terms: string[];
  budget_cents?: number;
}

interface XRayResult {
  brief: any;
  radar: any;
  ads: any;
  risks: any;
}

// =====================================================
// Component
// =====================================================

export function XRayDashboard() {
  const [market, setMarket] = useState("etsy");
  const [nicheTerms, setNicheTerms] = useState("");
  const [budgetDollars, setBudgetDollars] = useState("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<XRayResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");

  const { marketplaces, loading: loadingMarketplaces } = useMarketplaces();

  // Load persisted results from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("lexybrain_xray_results");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setResults(parsed.results);
        setMarket(parsed.market);
        setNicheTerms(parsed.nicheTerms);
        setBudgetDollars(parsed.budgetDollars);
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  const handleGenerate = async () => {
    const terms = nicheTerms
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const budgetCents = Math.round(parseFloat(budgetDollars || "0") * 100);

    setLoading(true);
    setError(null);
    setResults(null);
    setProgress(0);

    try {
      // Call all 4 insights sequentially with progress updates
      const xrayResults: XRayResult = {
        brief: null,
        radar: null,
        ads: null,
        risks: null,
      };

      // 1. Market Brief (25%)
      setCurrentTask("Analyzing market overview...");
      setProgress(10);
      const briefResponse = await fetch("/api/lexybrain/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "market_brief",
          market,
          niche_terms: terms,
        }),
      });

      if (briefResponse.ok) {
        xrayResults.brief = await briefResponse.json();
      }
      setProgress(25);

      // 2. Opportunity Radar (50%)
      setCurrentTask("Scanning opportunities...");
      const radarResponse = await fetch("/api/lexybrain/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "radar",
          market,
          niche_terms: terms,
        }),
      });

      if (radarResponse.ok) {
        xrayResults.radar = await radarResponse.json();
      }
      setProgress(50);

      // 3. Ad Insight (75%)
      setCurrentTask("Calculating ad strategy...");
      const adsResponse = await fetch("/api/lexybrain/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ad_insight",
          market,
          niche_terms: terms,
          budget_cents: budgetCents,
        }),
      });

      if (adsResponse.ok) {
        xrayResults.ads = await adsResponse.json();
      }
      setProgress(75);

      // 4. Risk Sentinel (100%)
      setCurrentTask("Identifying risks...");
      const risksResponse = await fetch("/api/lexybrain/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "risk",
          market,
          niche_terms: terms,
        }),
      });

      if (risksResponse.ok) {
        xrayResults.risks = await risksResponse.json();
      }
      setProgress(100);

      setResults(xrayResults);
      setCurrentTask("Complete!");

      // Persist to localStorage
      localStorage.setItem(
        "lexybrain_xray_results",
        JSON.stringify({
          results: xrayResults,
          market,
          nicheTerms,
          budgetDollars,
          timestamp: new Date().toISOString(),
        })
      );

      // Store the keyword for Neural Map tab
      localStorage.setItem("lexybrain_last_search", JSON.stringify({
        market,
        keyword: terms[0] || "",
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate X-Ray analysis");
    } finally {
      setLoading(false);
      setProgress(0);
      setCurrentTask("");
    }
  };

  const isValid = market.length > 0 && nicheTerms.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            Complete Market Analysis
          </CardTitle>
          <CardDescription>
            Get comprehensive insights in one click: Market overview, opportunities, ad strategy, and risk assessment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="xray-market">Marketplace</Label>
              <Select value={market} onValueChange={setMarket} disabled={loadingMarketplaces}>
                <SelectTrigger id="xray-market">
                  <SelectValue placeholder="Select marketplace" />
                </SelectTrigger>
                <SelectContent>
                  {marketplaces.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {mp.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="xray-budget">Daily Ad Budget (USD)</Label>
              <Input
                id="xray-budget"
                type="number"
                min="1"
                step="0.01"
                value={budgetDollars}
                onChange={(e) => setBudgetDollars(e.target.value)}
                placeholder="20.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="xray-keywords">Keywords to Analyze</Label>
            <Textarea
              id="xray-keywords"
              value={nicheTerms}
              onChange={(e) => setNicheTerms(e.target.value)}
              placeholder="e.g., handmade jewelry, vintage rings, custom necklaces"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Enter 3-10 specific keywords for best results
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !isValid}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? currentTask : "Run Complete Analysis"}
          </Button>

          {loading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">{progress}% complete</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Dashboard with Tabs */}
      {results && (
        <Card className="border-2 border-purple-200 dark:border-purple-800">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Analysis Complete
                </CardTitle>
                <CardDescription className="mt-1">
                  {results.brief?.niche || "Market Analysis"} • {results.radar?.items?.length || 0} keywords analyzed
                </CardDescription>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                {Math.round((results.brief?.confidence || 0) * 100)}% Confidence
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="opportunities" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Opportunities
                </TabsTrigger>
                <TabsTrigger value="ads" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Ad Strategy
                </TabsTrigger>
                <TabsTrigger value="risks" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Risks
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label="Opportunities"
                    value={results.brief?.top_opportunities?.length || 0}
                    color="green"
                  />
                  <StatCard
                    icon={<Target className="h-5 w-5" />}
                    label="Keywords"
                    value={results.radar?.items?.length || 0}
                    color="blue"
                  />
                  <StatCard
                    icon={<AlertTriangle className="h-5 w-5" />}
                    label="Risk Alerts"
                    value={results.risks?.alerts?.length || 0}
                    color="red"
                  />
                  <StatCard
                    icon={<DollarSign className="h-5 w-5" />}
                    label="Avg. CPC"
                    value={results.ads?.budget_split?.length > 0 ? `$${(results.ads.budget_split.reduce((sum: number, item: any) => sum + item.expected_cpc_cents, 0) / results.ads.budget_split.length / 100).toFixed(2)}` : "N/A"}
                    color="purple"
                  />
                </div>

                {/* Market Summary */}
                {results.brief && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-2 border-blue-200 dark:border-blue-800">
                      <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        {results.brief.niche}
                      </h4>
                      <p className="text-muted-foreground">{results.brief.summary}</p>
                    </div>

                    {results.brief.actions && results.brief.actions.length > 0 && (
                      <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border-2 border-purple-200 dark:border-purple-800">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-purple-600" />
                          Recommended Actions
                        </h4>
                        <ul className="space-y-2">
                          {results.brief.actions.map((action: string, i: number) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-purple-600 dark:text-purple-400 font-bold">{i + 1}.</span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Opportunities Tab */}
              <TabsContent value="opportunities" className="space-y-4">
                {results.brief?.top_opportunities && results.brief.top_opportunities.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                      <TrendingUp className="h-5 w-5" />
                      Top Market Opportunities
                    </h4>
                    <div className="grid gap-3">
                      {results.brief.top_opportunities.map((opp: any, i: number) => (
                        <Card key={i} className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                          <CardContent className="pt-4 pb-3">
                            <div className="flex items-start gap-3">
                              <Badge className="bg-green-600 text-white dark:bg-green-700 shrink-0">{i + 1}</Badge>
                              <div>
                                <strong className="text-green-700 dark:text-green-300 text-base">{opp.term}</strong>
                                <p className="text-sm text-muted-foreground mt-1">{opp.why}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {results.radar?.items && results.radar.items.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <RadarIcon className="h-5 w-5 text-purple-600" />
                      Detailed Keyword Scores
                    </h4>
                    <div className="grid gap-3">
                      {results.radar.items.map((item: any, i: number) => (
                        <Card key={i} className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                          <CardContent className="pt-4 pb-3">
                            <h5 className="font-semibold mb-3">{item.term}</h5>
                            <div className="grid grid-cols-5 gap-2 mb-2">
                              <ScorePill label="Demand" value={item.scores.demand} color="blue" />
                              <ScorePill label="Momentum" value={item.scores.momentum} color="green" />
                              <ScorePill label="Competition" value={item.scores.competition} color="orange" inverse />
                              <ScorePill label="Novelty" value={item.scores.novelty} color="purple" />
                              <ScorePill label="Profit" value={item.scores.profit} color="yellow" />
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">{item.comment}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Ads Tab */}
              <TabsContent value="ads" className="space-y-4">
                {results.ads?.budget_split && results.ads.budget_split.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950 border-yellow-200 dark:border-yellow-800">
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                            ${(results.ads.budget_split.reduce((sum: number, item: any) => sum + item.expected_cpc_cents, 0) / results.ads.budget_split.length / 100).toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Average CPC</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800">
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {Math.round(results.ads.budget_split.reduce((sum: number, item: any) => sum + item.expected_clicks, 0) / results.ads.budget_split.length)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Avg. Clicks/Day per Keyword</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Strategy Recommendation
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {results.ads.notes || `Based on your keywords, expect an average CPC of $${(results.ads.budget_split.reduce((sum: number, item: any) => sum + item.expected_cpc_cents, 0) / results.ads.budget_split.length / 100).toFixed(2)} and approximately ${Math.round(results.ads.budget_split.reduce((sum: number, item: any) => sum + item.expected_clicks, 0))} total clicks per day across all keywords. Focus your budget on high-profit keywords (70+ profit score) for best ROI.`}
                      </p>
                    </div>
                  </>
                ) : (
                  <Alert>
                    <AlertDescription>No ad strategy data available.</AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              {/* Risks Tab */}
              <TabsContent value="risks" className="space-y-4">
                {results.risks?.alerts && results.risks.alerts.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 border-red-200 dark:border-red-800">
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                            {results.risks.alerts.filter((a: any) => a.severity === 'high').length}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">High Risk</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border-orange-200 dark:border-orange-800">
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                            {results.risks.alerts.filter((a: any) => a.severity === 'medium').length}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Medium Risk</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-yellow-50 to-lime-50 dark:from-yellow-950 dark:to-lime-950 border-yellow-200 dark:border-yellow-800">
                        <CardContent className="pt-6 text-center">
                          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                            {results.risks.alerts.filter((a: any) => a.severity === 'low').length}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Low Risk</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Risk Summary
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {results.risks.alerts.filter((a: any) => a.severity === 'high').length > 0
                          ? `⚠️ ${results.risks.alerts.filter((a: any) => a.severity === 'high').length} keyword${results.risks.alerts.filter((a: any) => a.severity === 'high').length > 1 ? 's show' : ' shows'} high-risk signals (market saturation or declining trends). Consider pivoting to less saturated niches or updating your product positioning.`
                          : results.risks.alerts.filter((a: any) => a.severity === 'medium').length > 0
                          ? `⚡ ${results.risks.alerts.filter((a: any) => a.severity === 'medium').length} keyword${results.risks.alerts.filter((a: any) => a.severity === 'medium').length > 1 ? 's show' : ' shows'} moderate risk. Monitor these closely and be prepared to adjust your strategy if competition increases.`
                          : `✓ Only low-risk warnings detected. Your keywords are in relatively healthy markets. Continue monitoring monthly for changes.`}
                      </p>
                    </div>
                  </>
                ) : (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      🎉 No significant risks detected. Your market looks healthy!
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =====================================================
// Helper Components
// =====================================================

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorClasses = {
    green: "from-green-500/10 to-green-600/10 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
    blue: "from-blue-500/10 to-blue-600/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
    red: "from-red-500/10 to-red-600/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
    purple: "from-purple-500/10 to-purple-600/10 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
  };

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]}`}>
      <CardContent className="pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function ScorePill({ label, value, color, inverse = false }: { label: string; value: number; color: string; inverse?: boolean }) {
  const score = Math.round(value * 100);
  const displayScore = inverse ? 100 - score : score;

  const colorClasses = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    green: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  };

  return (
    <div className="text-center">
      <div className={`rounded-full px-2 py-1 ${colorClasses[color as keyof typeof colorClasses]} text-xs font-bold`}>
        {displayScore}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
