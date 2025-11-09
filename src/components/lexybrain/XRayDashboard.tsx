"use client";

import { useState, useEffect } from "react";
import { Loader2, TrendingUp, Shield, DollarSign, Target, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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
            Complete Market X-Ray
          </CardTitle>
          <CardDescription>
            Get a comprehensive analysis with one click: Market overview, opportunities, ad strategy, and risk assessment
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
              Enter 3-10 keywords separated by commas for best results
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !isValid}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? currentTask : "Run Complete X-Ray Analysis"}
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

      {/* Results Dashboard */}
      {results && (
        <div className="space-y-6">
          {/* Header Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Opportunities"
              value={results.brief?.top_opportunities?.length || 0}
              color="green"
            />
            <StatCard
              icon={<Target className="h-5 w-5" />}
              label="Keywords Analyzed"
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
              label="Confidence"
              value={`${Math.round((results.brief?.confidence || 0) * 100)}%`}
              color="purple"
            />
          </div>

          {/* Market Brief */}
          {results.brief && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Market Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-lg mb-2">{results.brief.niche}</h4>
                  <p className="text-muted-foreground">{results.brief.summary}</p>
                </div>

                {results.brief.top_opportunities && results.brief.top_opportunities.length > 0 && (
                  <div className="grid gap-2">
                    <h4 className="font-semibold text-green-600 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Top Opportunities
                    </h4>
                    {results.brief.top_opportunities.map((opp: any, i: number) => (
                      <Card key={i} className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start gap-2">
                            <Badge variant="secondary" className="mt-0.5">{i + 1}</Badge>
                            <div>
                              <strong className="text-green-700 dark:text-green-300">{opp.term}</strong>
                              <p className="text-sm text-muted-foreground mt-1">{opp.why}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {results.brief.actions && results.brief.actions.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Recommended Actions
                    </h4>
                    <ul className="space-y-1">
                      {results.brief.actions.map((action: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-purple-600 dark:text-purple-400">•</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Opportunity Radar */}
          {results.radar && results.radar.items && results.radar.items.length > 0 && (
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-600" />
                  Opportunity Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {results.radar.items.slice(0, 5).map((item: any, i: number) => (
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
                        <p className="text-sm text-muted-foreground">{item.comment}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Alerts */}
          {results.risks && results.risks.alerts && results.risks.alerts.length > 0 && (
            <Card className="border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.risks.alerts.map((alert: any, i: number) => (
                    <Card key={i} className={getSeverityClass(alert.severity)}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex justify-between items-start mb-2">
                          <strong className="font-semibold">{alert.term}</strong>
                          <Badge variant="outline" className="uppercase text-xs">
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium mb-1">{alert.issue}</p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Evidence:</strong> {alert.evidence}
                        </p>
                        <p className="text-sm">
                          <strong>Action:</strong> {alert.action}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {results.risks && results.risks.alerts && results.risks.alerts.length === 0 && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                No significant risks detected. Your market looks healthy!
              </AlertDescription>
            </Alert>
          )}

          {/* Ad Budget Breakdown */}
          {results.ads && results.ads.budget_split && results.ads.budget_split.length > 0 && (
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                  Ad Budget Strategy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.ads.budget_split.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                      <div>
                        <strong className="block">{item.term}</strong>
                        <span className="text-sm text-muted-foreground">
                          ${(item.expected_cpc_cents / 100).toFixed(2)} CPC • {item.expected_clicks} clicks/day
                        </span>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                        ${(item.daily_cents / 100).toFixed(2)}/day
                      </Badge>
                    </div>
                  ))}
                </div>
                {results.ads.notes && (
                  <p className="text-sm text-muted-foreground mt-4 p-3 bg-slate-100 dark:bg-slate-800 rounded">
                    {results.ads.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
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

function getSeverityClass(severity: string) {
  const classes = {
    low: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
    medium: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
    high: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
  };
  return classes[severity as keyof typeof classes] || classes.medium;
}
