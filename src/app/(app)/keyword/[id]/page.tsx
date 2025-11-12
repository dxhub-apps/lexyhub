"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { ArrowLeft, Brain, Loader2 } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface KeywordRecord {
  id: string;
  term: string;
  market: string;
  source: string;
  trend_momentum?: number | null;
  demand_index?: number | null;
  competition_score?: number | null;
  engagement_score?: number | null;
  adjusted_demand_index?: number | null;
  deseasoned_trend_momentum?: number | null;
  // DataForSEO raw metrics
  search_volume?: number | null;
  cpc?: number | null;
  dataforseo_competition?: number | null;
  monthly_trend?: Array<{ year: number; month: number; searches: number }> | null;
}

interface TimeseriesPoint {
  ts_date: string;
  demand: number | null;
  competition: number | null;
}

interface InsightPayload {
  summary: string;
  metrics?: Array<{ label: string; value: string }>;
  risk_summary?: string;
}

export default function KeywordJourney(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClientComponentClient(), []);
  const keywordId = params.id;

  const [keyword, setKeyword] = useState<KeywordRecord | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [insight, setInsight] = useState<InsightPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    const loadKeyword = async () => {
      if (!keywordId) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("keywords")
          .select(
            "id, term, market, source, trend_momentum, demand_index, competition_score, engagement_score, adjusted_demand_index, deseasoned_trend_momentum, search_volume, cpc, dataforseo_competition, monthly_trend"
          )
          .eq("id", keywordId)
          .single();

        if (fetchError || !data) {
          throw new Error(fetchError?.message ?? "Keyword not found");
        }

        setKeyword(data as KeywordRecord);
        await loadTimeseries(data.term, data.market);
        await loadInsight(data);
      } catch (err) {
        console.error("Failed to load keyword", err);
        setError(err instanceof Error ? err.message : "Keyword unavailable");
      } finally {
        setLoading(false);
      }
    };

    const loadTimeseries = async (term: string, market: string) => {
      const normalized = normalizeTerm(term);
      const { data } = await supabase
        .from("keyword_timeseries")
        .select("ts_date, demand, competition")
        .eq("term_normalized", normalized)
        .eq("market", market)
        .order("ts_date", { ascending: true })
        .limit(60);
      setTimeseries(
        (data ?? []).map((row) => ({
          ts_date: row.ts_date as string,
          demand: row.demand as number | null,
          competition: row.competition as number | null,
        }))
      );
    };

    const loadInsight = async (record: KeywordRecord) => {
      setInsightLoading(true);
      try {
        const response = await fetch("/api/lexybrain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability: "keyword_insights",
            keywordIds: [record.id],
            query: record.term,
            marketplace: record.market,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? `LexyBrain insight failed (${response.status})`);
        }

        const payload = await response.json();
        const insightPayload: InsightPayload = {
          summary: payload?.insight?.summary ?? "LexyBrain insight generated.",
          metrics: payload?.insight?.metrics ?? [],
          risk_summary: payload?.insight?.risk_summary ?? null,
        };
        setInsight(insightPayload);
      } catch (err) {
        console.error("Failed to load LexyBrain insight", err);
        setInsight(null);
      } finally {
        setInsightLoading(false);
      }
    };

    void loadKeyword();
  }, [keywordId, supabase]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading keyword…
      </div>
    );
  }

  if (error || !keyword) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go back
        </Button>
        <p className="text-sm text-destructive">{error ?? "Keyword not available."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-[28px] font-semibold leading-none">{keyword.term}</h1>
            <Badge variant="outline" className="uppercase">
              {keyword.market}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Source: {keyword.source} • Last refreshed: {formatDate(timeseries.at(-1)?.ts_date)}</p>
        </div>
        <Button
          variant="accent"
          onClick={() => {
            window.location.href = `/ask-lexybrain?keyword=${encodeURIComponent(keyword.term)}`;
          }}
        >
          <Brain className="mr-2 h-4 w-4" /> Ask LexyBrain
        </Button>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Search Volume"
          value={typeof keyword.search_volume === "number" ? keyword.search_volume.toLocaleString() : "—"}
          color="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20"
        />
        <MetricCard
          label="CPC"
          value={typeof keyword.cpc === "number" ? `$${keyword.cpc.toFixed(2)}` : "—"}
          color="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20"
        />
        <MetricCard
          label="Competition"
          value={typeof keyword.dataforseo_competition === "number"
            ? `${Math.round(keyword.dataforseo_competition * 100)}%`
            : "—"
          }
          color="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20"
        />
        <MetricCard
          label="Trend Momentum"
          value={formatPercent(keyword.trend_momentum)}
          color="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20"
        />
      </div>

      {/* Trends Chart - Immediately Visible */}
      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-blue-400">Trend Analysis</CardTitle>
          <CardDescription>Visual representation of search volume and demand over time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Monthly Trend from DataForSEO */}
          {keyword.monthly_trend && keyword.monthly_trend.length > 0 ? (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-blue-300">Monthly Search Volume Trend</h4>
              <div className="h-64 rounded-lg bg-black/20 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={keyword.monthly_trend
                      .map((item) => ({
                        date: `${item.year}-${String(item.month).padStart(2, "0")}`,
                        searches: item.searches,
                      }))
                      .sort((a, b) => a.date.localeCompare(b.date))}
                  >
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#000",
                        color: "#fff",
                        borderRadius: 8,
                        border: "1px solid #3b82f6",
                      }}
                      formatter={(value: number) => [value.toLocaleString(), "Searches"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="searches"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#3b82f6" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No monthly trend data available.</p>
          )}

          {/* Historical Timeseries Data */}
          {timeseries.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-blue-300">Historical Demand & Competition</h4>
              <div className="h-64 rounded-lg bg-black/20 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeseries}>
                    <XAxis dataKey="ts_date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} domain={[0, 1]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#000",
                        color: "#fff",
                        borderRadius: 8,
                        border: "1px solid #3b82f6",
                      }}
                      formatter={(value: number) => [(value * 100).toFixed(1) + "%", ""]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="demand"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name="Demand"
                    />
                    <Line
                      type="monotone"
                      dataKey="competition"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      name="Competition"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">Demand Index</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-500" />
                  <span className="text-muted-foreground">Competition Score</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LexyBrain Insights */}
      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-400">
            <Brain className="h-5 w-5" />
            LexyBrain Insights
          </CardTitle>
          <CardDescription>AI-powered analysis and strategic recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          {insightLoading ? (
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching LexyBrain insight…
            </div>
          ) : insight ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">{insight.summary}</p>
              {insight.metrics && insight.metrics.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {insight.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-sm">
                      <span className="font-medium text-purple-300">{metric.label}:</span>
                      <span className="ml-2">{metric.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">LexyBrain insight unavailable.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Advanced Metrics */}
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-green-400">Advanced Metrics</CardTitle>
            <CardDescription>Synthesized marketplace intelligence</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <MetricRow
                label="Demand Index"
                value={formatPercent(keyword.demand_index)}
                description="Overall market demand indicator"
              />
              <MetricRow
                label="Competition Score"
                value={formatPercent(keyword.competition_score)}
                description="Competitive landscape intensity"
              />
              <MetricRow
                label="Engagement Score"
                value={formatPercent(keyword.engagement_score)}
                description="User engagement potential"
              />
              <MetricRow
                label="Adjusted Demand"
                value={formatPercent(keyword.adjusted_demand_index)}
                description="Seasonally adjusted demand"
              />
              <MetricRow
                label="Deseasoned Momentum"
                value={formatPercent(keyword.deseasoned_trend_momentum)}
                description="Trend momentum without seasonal effects"
              />
            </dl>
          </CardContent>
        </Card>

        {/* Risk Analysis */}
        <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-red-400">Risk Analysis</CardTitle>
            <CardDescription>Potential concerns and considerations</CardDescription>
          </CardHeader>
          <CardContent>
            {insight?.risk_summary ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-sm leading-relaxed">{insight.risk_summary}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <p className="text-sm text-green-300">No active risks detected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overview & Context */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>About this keyword tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            LexyHub synthesizes marketplace demand, competition, and trend momentum to keep this keyword grounded in the golden
            source database. Data is continuously updated to provide the most accurate market intelligence for strategic decision-making.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-2xl font-bold">{value}</dd>
    </div>
  );
}

function MetricRow({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-green-500/10 bg-green-500/5 p-3">
      <div className="space-y-1">
        <dt className="text-sm font-medium">{label}</dt>
        <dd className="text-xs text-muted-foreground">{description}</dd>
      </div>
      <dd className="text-lg font-semibold text-green-400">{value}</dd>
    </div>
  );
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  const bounded = Math.max(0, Math.min(1, value));
  return `${Math.round(bounded * 100)}%`;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}
