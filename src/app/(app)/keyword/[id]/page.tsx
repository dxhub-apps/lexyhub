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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
            "id, term, market, source, trend_momentum, demand_index, competition_score, engagement_score, adjusted_demand_index, deseasoned_trend_momentum"
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
    <div className="flex flex-col gap-6">
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
          <p className="text-sm text-foreground">Source: {keyword.source}</p>
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

      <section className="rounded-lg border border-border p-4">
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Volume" value={formatPercent(keyword.demand_index ?? keyword.adjusted_demand_index)} />
          <Stat label="Competition" value={formatPercent(keyword.competition_score)} />
          <Stat label="Trend" value={formatPercent(keyword.trend_momentum)} />
          <Stat label="Engagement" value={formatPercent(keyword.engagement_score)} />
        </dl>
      </section>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">LexyBrain Insights</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="ask">Ask LexyBrain</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-sm leading-relaxed">
            LexyHub synthesizes marketplace demand, competition, and trend momentum to keep this keyword grounded in the golden
            source database.
          </p>
          <p className="text-xs">Last refreshed: {formatDate(timeseries.at(-1)?.ts_date)}</p>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4 rounded-lg border border-border p-4">
          {insightLoading ? (
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching LexyBrain insight…
            </div>
          ) : insight ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">{insight.summary}</p>
              {insight.metrics && insight.metrics.length > 0 && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {insight.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-border p-3 text-sm">
                      <span className="font-medium">{metric.label}</span>
                      <span className="ml-2">{metric.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm">LexyBrain insight unavailable.</p>
          )}
        </TabsContent>

        <TabsContent value="trends" className="rounded-lg border border-border p-4">
          {timeseries.length === 0 ? (
            <p className="text-sm">No trend data captured yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeseries}>
                  <XAxis dataKey="ts_date" hide />
                  <YAxis hide domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#000",
                      color: "#fff",
                      borderRadius: 8,
                      border: "1px solid #2563EB",
                    }}
                  />
                  <Line type="monotone" dataKey="demand" stroke="#2563EB" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="competition" stroke="#111111" strokeWidth={1} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </TabsContent>

        <TabsContent value="risks" className="rounded-lg border border-border p-4">
          {insight?.risk_summary ? (
            <p className="text-sm leading-relaxed">{insight.risk_summary}</p>
          ) : (
            <p className="text-sm">No active risks detected.</p>
          )}
        </TabsContent>

        <TabsContent value="competitors" className="rounded-lg border border-border p-4">
          <p className="text-sm">Competitor tracking is unified under LexyBrain. Use the compare action from search to populate this view.</p>
        </TabsContent>

        <TabsContent value="ask" className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-sm">Send this keyword to Ask LexyBrain for contextual reasoning.</p>
          <Button
            variant="accent"
            onClick={() => {
              window.location.href = `/ask-lexybrain?keyword=${encodeURIComponent(keyword.term)}`;
            }}
          >
            <Brain className="mr-2 h-4 w-4" /> Continue in Ask LexyBrain
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs font-semibold uppercase">{label}</dt>
      <dd className="mt-2 text-lg font-semibold">{value}</dd>
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
