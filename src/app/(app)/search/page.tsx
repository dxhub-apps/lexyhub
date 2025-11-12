"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSession } from "@supabase/auth-helpers-react";
import {
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Brain,
  ExternalLink,
  LineChart,
  Loader2,
  Minus,
  Plus,
  Search as SearchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DEFAULT_MARKET = "us";
const SUGGESTION_LIMIT = 6;
const RESULT_LIMIT = 20;

interface KeywordResult {
  id?: string;
  term: string;
  market: string;
  source: string;
  trend_momentum?: number | null;
  ai_opportunity_score?: number | null;
  demand_index?: number | null;
  competition_score?: number | null;
  engagement_score?: number | null;
  freshness_ts?: string | null;
  adjusted_demand_index?: number | null;
  deseasoned_trend_momentum?: number | null;
  // DataForSEO raw metrics from extras field
  search_volume?: number | null;
  cpc?: number | null;
  monthly_trend?: Array<{ year: number; month: number; searches: number }> | null;
  dataforseo_competition?: number | null;
}

interface SearchResponse {
  results: KeywordResult[];
  insights?: { summary: string } | null;
}

interface LexyBrainInsight {
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  sources?: Array<{ title: string; url?: string }>; 
}

export default function SearchWorkspace(): JSX.Element {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [results, setResults] = useState<KeywordResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedKeyword = selectedIndex != null ? results[selectedIndex] ?? null : null;

  const [insight, setInsight] = useState<LexyBrainInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const loadInsight = useCallback(
    async (keyword: KeywordResult | undefined) => {
      if (!keyword) return;
      setInsightLoading(true);
      setInsightError(null);
      try {
        const response = await fetch("/api/lexybrain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability: "keyword_insights",
            keywordIds: keyword.id ? [keyword.id] : [],
            query: keyword.term,
            marketplace: keyword.market,
            metadata: { source: keyword.source, userId },
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? `LexyBrain insight failed (${response.status})`);
        }

        const payload = await response.json();
        const summary = payload?.insight?.summary ?? "LexyBrain did not return a summary.";
        const metrics = Array.isArray(payload?.insight?.metrics)
          ? (payload.insight.metrics as Array<{ label: string; value: string }>)
          : [];
        const sources = Array.isArray(payload?.insight?.sources)
          ? (payload.insight.sources as Array<{ title: string; url?: string }>)
          : [];
        setInsight({ summary, metrics, sources });
      } catch (err) {
        console.error("LexyBrain insight failed", err);
        setInsightError(err instanceof Error ? err.message : "LexyBrain insight failed");
        setInsight(null);
      } finally {
        setInsightLoading(false);
      }
    },
    [userId]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "/") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (!results.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => {
          if (prev == null) return 0;
          const next = prev + 1;
          return next >= results.length ? 0 : next;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => {
          if (prev == null) return results.length - 1;
          const next = prev - 1;
          return next < 0 ? results.length - 1 : next;
        });
      } else if (event.key === "Enter" && selectedIndex != null) {
        event.preventDefault();
        void loadInsight(results[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [results, selectedIndex, loadInsight]);

  const fetchSuggestions = useCallback(
    async (term: string) => {
      if (term.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      setLoadingSuggestions(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("keywords")
          .select("term")
          .ilike("term", `${term}%`)
          .eq("market", DEFAULT_MARKET)
          .order("term", { ascending: true })
          .limit(SUGGESTION_LIMIT);

        if (fetchError) throw fetchError;
        setSuggestions((data ?? []).map((row) => row.term));
      } catch (err) {
        console.error("Suggestion fetch failed", err);
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [supabase]
  );

  const fetchResults = useCallback(
    async (term: string, isFinal = false) => {
      if (!term.trim()) {
        setResults([]);
        setSelectedIndex(null);
        return;
      }
      setLoadingResults(true);
      setError(null);
      try {
        const url = new URL('/api/keywords/search', window.location.origin);
        url.searchParams.set('q', term);
        url.searchParams.set('limit', String(RESULT_LIMIT));
        if (isFinal) {
          url.searchParams.set('final', 'true');
        }
        const response = await fetch(url.toString());
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Failed to search keywords (${response.status})`);
        }
        const payload = (await response.json()) as SearchResponse;
        setResults(payload.results ?? []);
        setSelectedIndex(payload.results.length ? 0 : null);
      } catch (err) {
        console.error("Keyword search failed", err);
        setError(err instanceof Error ? err.message : "Keyword search failed");
      } finally {
        setLoadingResults(false);
      }
    },
    []
  );

  // Disabled autocomplete suggestions to prevent overlap with results
  // useEffect(() => {
  //   const timeout = setTimeout(() => {
  //     void fetchSuggestions(query);
  //   }, 150);
  //   return () => clearTimeout(timeout);
  // }, [query, fetchSuggestions]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchResults(query);
    }, 220);
    return () => clearTimeout(timeout);
  }, [query, fetchResults]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void fetchResults(query, true);
    },
    [fetchResults, query]
  );

  const handleAddToWatchlist = useCallback(
    async (keyword: KeywordResult) => {
      if (!keyword.id) {
        setError("Keyword missing identifier; cannot add to watchlist.");
        return;
      }

      try {
        const response = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword_id: keyword.id }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Failed to add to watchlist (${response.status})`);
        }
      } catch (err) {
        console.error("Add to watchlist failed", err);
        setError(err instanceof Error ? err.message : "Unable to add to watchlist");
      }
    },
    []
  );

  return (
    <div className="flex h-full flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold leading-none">Keyword Intelligence</h1>
            <p className="mt-2 text-sm text-foreground">Search, rank, and reason across the LexyHub keyword graph.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for a keyword"
              className="h-14 rounded-lg border border-border px-12 text-lg font-medium"
              autoComplete="off"
            />
            <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground" />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-14 px-8"
            disabled={loadingResults || !query.trim()}
          >
            Search
          </Button>
        </form>
      </section>

      <section className="flex flex-1 gap-6">
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              <h2 className="text-base font-medium">Results</h2>
            </div>
            <span className="text-xs text-foreground">{results.length} keywords</span>
          </header>

          <div className="flex-1 overflow-auto">
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase">
                  <th className="px-3 py-2 font-medium">Keyword</th>
                  <th className="px-3 py-2 font-medium">Search Volume</th>
                  <th className="px-3 py-2 font-medium">CPC</th>
                  <th className="px-3 py-2 font-medium">Competition</th>
                  <th className="px-3 py-2 font-medium">Trend</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingResults ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center">
                      <div className="inline-flex items-center gap-2 text-sm font-medium">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading keywords…
                      </div>
                    </td>
                  </tr>
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm">
                      {error ? error : "Start typing to explore the keyword universe."}
                    </td>
                  </tr>
                ) : (
                  results.map((keyword, index) => {
                    const isActive = selectedIndex === index;
                    return (
                      <tr
                        key={`${keyword.id ?? keyword.term}-${index}`}
                        className={cn(
                          "cursor-pointer border-t border-border",
                          isActive ? "bg-secondary" : "hover:bg-secondary"
                        )}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onClick={() => {
                          setSelectedIndex(index);
                          void loadInsight(keyword);
                        }}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{keyword.term}</span>
                            <Badge variant="outline" className="uppercase">
                              {keyword.market}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm font-medium">
                          {formatSearchVolume(keyword)}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium">
                          {formatCPC(keyword)}
                        </td>
                        <td className="px-3 py-3">
                          {formatCompetitionWithColor(keyword)}
                        </td>
                        <td className="px-3 py-3">
                          {formatTrendWithColor(keyword)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                void loadInsight(keyword);
                              }}
                            >
                              <Brain className="mr-1 h-3 w-3" />
                              Ask LexyBrain
                            </Button>
                            {keyword.id && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  window.location.href = `/keyword/${keyword.id}`;
                                }}
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                View
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleAddToWatchlist(keyword);
                              }}
                            >
                              <Plus className="mr-1 h-4 w-4" />
                              Watchlist
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="w-[360px] border-l border-border pl-6">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            <h2 className="text-base font-medium">LexyBrain Insight</h2>
          </div>
          <div className="mt-4 space-y-4">
            {insightLoading ? (
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                Summoning LexyBrain…
              </div>
            ) : insightError ? (
              <p className="text-sm text-foreground">{insightError}</p>
            ) : insight ? (
              <>
                <p className="text-sm leading-relaxed">{insight.summary}</p>
                {insight.metrics.length > 0 && (
                  <div className="space-y-2">
                    {insight.metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{metric.label}</span>
                        <span>{metric.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="accent"
                    className="flex-1"
                    onClick={() => {
                      if (!selectedKeyword?.id) return;
                      window.location.href = `/keyword/${selectedKeyword.id}`;
                    }}
                  >
                    Open Keyword
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void loadInsight(selectedKeyword ?? undefined)}
                  >
                    Refresh
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-foreground">
                Select a keyword to load a LexyBrain briefing.
              </p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function formatSearchVolume(keyword: KeywordResult): string {
  if (typeof keyword.search_volume === "number") {
    return keyword.search_volume.toLocaleString();
  }
  return "—";
}

function formatCPC(keyword: KeywordResult): string {
  if (typeof keyword.cpc === "number") {
    return `$${keyword.cpc.toFixed(2)}`;
  }
  return "—";
}

function getCompetitionColor(competition: number): string {
  // Green (0) to Red (100) scale
  if (competition <= 33) {
    return "text-green-600";
  } else if (competition <= 66) {
    return "text-yellow-600";
  } else {
    return "text-red-600";
  }
}

function formatCompetitionWithColor(keyword: KeywordResult): JSX.Element {
  let competition: number | null = null;

  // Use dataforseo_competition (0-1 scale)
  if (typeof keyword.dataforseo_competition === "number") {
    competition = keyword.dataforseo_competition * 100;
  }

  if (competition === null) {
    return <span className="text-sm font-medium">—</span>;
  }

  const colorClass = getCompetitionColor(competition);
  return (
    <span className={`text-sm font-semibold ${colorClass}`}>
      {Math.round(competition)}
    </span>
  );
}

function getTrendStatus(keyword: KeywordResult): { label: string; color: string; icon: JSX.Element } | null {
  // Calculate trend from monthly_trend data
  if (Array.isArray(keyword.monthly_trend) && keyword.monthly_trend.length >= 2) {
    const sorted = [...keyword.monthly_trend].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    const oldest = sorted[0]?.searches ?? 0;
    const newest = sorted[sorted.length - 1]?.searches ?? 0;

    if (oldest === 0 && newest === 0) {
      return { label: "Stale", color: "text-yellow-600", icon: <Minus className="h-4 w-4" /> };
    }

    const change = oldest > 0 ? ((newest - oldest) / oldest) * 100 : (newest > 0 ? 100 : 0);

    if (change > 10) {
      return { label: "Rising", color: "text-green-600", icon: <TrendingUp className="h-4 w-4" /> };
    } else if (change < -10) {
      return { label: "Dropping", color: "text-red-600", icon: <TrendingDown className="h-4 w-4" /> };
    } else {
      return { label: "Stale", color: "text-yellow-600", icon: <Minus className="h-4 w-4" /> };
    }
  }

  return null;
}

function formatTrendWithColor(keyword: KeywordResult): JSX.Element {
  const trendStatus = getTrendStatus(keyword);

  if (!trendStatus) {
    return <span className="text-sm font-medium">—</span>;
  }

  return (
    <div className={`flex items-center gap-1.5 text-sm font-semibold ${trendStatus.color}`}>
      {trendStatus.icon}
      <span>{trendStatus.label}</span>
    </div>
  );
}
