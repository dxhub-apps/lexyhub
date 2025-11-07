"use client";

import { useState } from "react";
import { FileText, Radar, DollarSign, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLexyBrainGenerate } from "@/lib/lexybrain/hooks";
import type { LexyBrainOutputType } from "@/lib/lexybrain-schemas";

export function InsightGenerator() {
  const [market, setMarket] = useState("etsy");
  const [nicheTerms, setNicheTerms] = useState("");
  const [budgetDollars, setBudgetDollars] = useState("20");
  const [activeTab, setActiveTab] = useState<LexyBrainOutputType>("market_brief");

  const { generate, loading, error, data, reset } = useLexyBrainGenerate();

  const handleGenerate = async () => {
    const terms = nicheTerms
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const request: any = {
      type: activeTab,
      market,
      niche_terms: terms.length > 0 ? terms : undefined,
    };

    if (activeTab === "ad_insight") {
      const budgetCents = Math.round(parseFloat(budgetDollars || "0") * 100);
      if (budgetCents > 0) {
        request.budget_cents = budgetCents;
      }
    }

    await generate(request);
  };

  const isValid = market.length > 0 && (activeTab !== "ad_insight" || parseFloat(budgetDollars || "0") > 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Generate AI Insights
          </CardTitle>
          <CardDescription>
            Use LexyBrain to analyze your market and get actionable recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Insight Type Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as LexyBrainOutputType);
            reset();
          }}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="market_brief" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Brief</span>
              </TabsTrigger>
              <TabsTrigger value="radar" className="flex items-center gap-1">
                <Radar className="h-4 w-4" />
                <span className="hidden sm:inline">Radar</span>
              </TabsTrigger>
              <TabsTrigger value="ad_insight" className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Ads</span>
              </TabsTrigger>
              <TabsTrigger value="risk" className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">Risks</span>
              </TabsTrigger>
            </TabsList>

            {/* Input Form */}
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="market">Marketplace</Label>
                <Input
                  id="market"
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  placeholder="e.g., etsy, amazon"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="niche">Niche Keywords (comma-separated)</Label>
                <Textarea
                  id="niche"
                  value={nicheTerms}
                  onChange={(e) => setNicheTerms(e.target.value)}
                  placeholder="e.g., handmade jewelry, vintage rings, custom necklaces"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Enter keywords related to your niche. Leave empty for general market analysis.
                </p>
              </div>

              {activeTab === "ad_insight" && (
                <div className="space-y-2">
                  <Label htmlFor="budget">Daily Ad Budget (USD)</Label>
                  <Input
                    id="budget"
                    type="number"
                    min="1"
                    step="0.01"
                    value={budgetDollars}
                    onChange={(e) => setBudgetDollars(e.target.value)}
                    placeholder="20.00"
                  />
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={loading || !isValid}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Generating..." : `Generate ${activeTab.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}`}
              </Button>
            </div>
          </Tabs>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results Display */}
          {data && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Results</h3>
                <Button variant="outline" size="sm" onClick={reset}>
                  Clear
                </Button>
              </div>

              {activeTab === "market_brief" && <MarketBriefDisplay data={data} />}
              {activeTab === "radar" && <RadarDisplay data={data} />}
              {activeTab === "ad_insight" && <AdInsightDisplay data={data} />}
              {activeTab === "risk" && <RiskDisplay data={data} />}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================
// Result Display Components
// =====================================================

function MarketBriefDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{data.niche}</CardTitle>
          <Badge variant="secondary">Confidence: {Math.round((data.confidence || 0) * 100)}%</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Summary</h4>
            <p className="text-sm text-muted-foreground">{data.summary}</p>
          </div>

          {data.top_opportunities && data.top_opportunities.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-green-600">Top Opportunities</h4>
              <ul className="space-y-2">
                {data.top_opportunities.map((opp: any, i: number) => (
                  <li key={i} className="text-sm">
                    <strong>{opp.term}:</strong> {opp.why}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.risks && data.risks.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-red-600">Risks</h4>
              <ul className="space-y-2">
                {data.risks.map((risk: any, i: number) => (
                  <li key={i} className="text-sm">
                    <strong>{risk.term}:</strong> {risk.why}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.actions && data.actions.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Recommended Actions</h4>
              <ol className="space-y-1 list-decimal list-inside">
                {data.actions.map((action: string, i: number) => (
                  <li key={i} className="text-sm">{action}</li>
                ))}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RadarDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-2">
      {data.items && data.items.map((item: any, i: number) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <h4 className="font-semibold mb-3">{item.term}</h4>
            <div className="grid grid-cols-5 gap-2 mb-2">
              <ScoreBadge label="Demand" value={item.scores.demand} />
              <ScoreBadge label="Momentum" value={item.scores.momentum} />
              <ScoreBadge label="Competition" value={item.scores.competition} inverse />
              <ScoreBadge label="Novelty" value={item.scores.novelty} />
              <ScoreBadge label="Profit" value={item.scores.profit} />
            </div>
            <p className="text-sm text-muted-foreground">{item.comment}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AdInsightDisplay({ data }: { data: any }) {
  const total = data.budget_split?.reduce((sum: number, item: any) => sum + item.daily_cents, 0) || 0;

  return (
    <div className="space-y-4">
      {data.budget_split && data.budget_split.map((item: any, i: number) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold">{item.term}</h4>
              <Badge variant="outline">${(item.daily_cents / 100).toFixed(2)}/day</Badge>
            </div>
            <div className="text-sm space-y-1">
              <p>Expected CPC: ${(item.expected_cpc_cents / 100).toFixed(2)}</p>
              <p>Expected Clicks: {item.expected_clicks}/day</p>
            </div>
          </CardContent>
        </Card>
      ))}

      {data.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Strategic Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{data.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RiskDisplay({ data }: { data: any }) {
  const severityColors = {
    low: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950",
    medium: "text-orange-600 bg-orange-50 dark:bg-orange-950",
    high: "text-red-600 bg-red-50 dark:bg-red-950",
  };

  return (
    <div className="space-y-2">
      {data.alerts && data.alerts.length === 0 && (
        <Alert>
          <AlertDescription>No significant risks detected. Your market looks healthy!</AlertDescription>
        </Alert>
      )}

      {data.alerts && data.alerts.map((alert: any, i: number) => (
        <Card key={i} className={severityColors[alert.severity as keyof typeof severityColors]}>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold">{alert.term}</h4>
              <Badge variant="outline" className="uppercase">{alert.severity}</Badge>
            </div>
            <p className="text-sm font-medium mb-2">{alert.issue}</p>
            <p className="text-sm text-muted-foreground mb-2"><strong>Evidence:</strong> {alert.evidence}</p>
            <p className="text-sm"><strong>Action:</strong> {alert.action}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ScoreBadge({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const score = Math.round(value * 100);
  const displayScore = inverse ? 100 - score : score;
  const color = displayScore >= 70 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                displayScore >= 40 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";

  return (
    <div className="text-center">
      <div className={`rounded px-2 py-1 ${color} text-xs font-semibold`}>
        {displayScore}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
