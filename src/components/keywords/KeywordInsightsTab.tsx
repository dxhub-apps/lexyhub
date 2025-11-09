"use client";

import { useState } from "react";
import { Brain, Loader2, AlertTriangle, Lightbulb, TrendingUp, Shield } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

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
};

type InsightResponse = {
  insight?: string;
  recommendations?: string[];
  risks?: string[];
  compliance?: string;
  references?: string[];
  error?: string;
};

export function KeywordInsightsTab({
  keyword,
  userId,
}: {
  keyword: KeywordDetails;
  userId: string | null;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightResponse | null>(null);

  const generateInsights = async (capability: "keyword_insights" | "recommendations" | "compliance_check") => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "You must be signed in to use LexyBrain insights.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/lexybrain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          capability,
          context: {
            keyword: keyword.term,
            market: keyword.market,
            demand_index: keyword.demand_index,
            competition_score: keyword.competition_score,
            trend_momentum: keyword.trend_momentum,
            engagement_score: keyword.engagement_score,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to generate insights (${response.status})`);
      }

      const data = await response.json();
      setInsights(data);

      toast({
        title: "Insights generated",
        description: "LexyBrain has analyzed this keyword.",
        variant: "success",
      });
    } catch (err: any) {
      console.error("Failed to generate insights", err);
      toast({
        title: "Insights generation failed",
        description: err?.message ?? "Failed to generate insights",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* LexyBrain Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Brain className="h-6 w-6 text-primary" />
            <div className="space-y-1">
              <CardTitle>LexyBrain AI Analysis</CardTitle>
              <CardDescription>
                Get deep market insights, strategic recommendations, and risk assessment
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => generateInsights("keyword_insights")}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Generate Market Insights
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => generateInsights("recommendations")}
              disabled={loading}
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              Get Recommendations
            </Button>
            <Button
              variant="outline"
              onClick={() => generateInsights("compliance_check")}
              disabled={loading}
            >
              <Shield className="mr-2 h-4 w-4" />
              Check Compliance
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Insights */}
      {insights && (
        <>
          {insights.insight && (
            <Card>
              <CardHeader>
                <CardTitle>Market Intelligence</CardTitle>
                <CardDescription>
                  LexyBrain&apos;s analysis of &ldquo;{keyword.term}&rdquo;
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {insights.insight}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {insights.recommendations && insights.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  <div className="space-y-1">
                    <CardTitle>Strategic Recommendations</CardTitle>
                    <CardDescription>
                      Actionable next steps to capitalize on this opportunity
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {insights.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {idx + 1}
                      </Badge>
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {insights.risks && insights.risks.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Risk Assessment</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {insights.risks.map((risk, idx) => (
                    <li key={idx} className="text-sm">
                      {risk}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {insights.compliance && (
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-500" />
                  <div className="space-y-1">
                    <CardTitle>Compliance Check</CardTitle>
                    <CardDescription>
                      Regulatory and marketplace policy considerations
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {insights.compliance}
                </p>
              </CardContent>
            </Card>
          )}

          {insights.references && insights.references.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sources</CardTitle>
                <CardDescription>
                  Data sources used for this analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {insights.references.map((ref, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {ref}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty State */}
      {!insights && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">No insights generated yet</CardTitle>
            <CardDescription className="mb-4">
              Click one of the buttons above to get AI-powered analysis
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </>
  );
}
