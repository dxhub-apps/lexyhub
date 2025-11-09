"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSession } from "@supabase/auth-helpers-react";
import {
  ArrowUpRight,
  Brain,
  LineChart,
  Loader2,
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
    async (term: string) => {
      if (!term.trim()) {
        setResults([]);
        setSelectedIndex(null);
        return;
      }
      setLoadingResults(true);
      setError(null);
      try {
        const response = await fetch(`/api/keywords/search?q=${encodeURIComponent(term)}&limit=${RESULT_LIMIT}`);
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchSuggestions(query);
    }, 150);
    return () => clearTimeout(timeout);
  }, [query, fetchSuggestions]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchResults(query);
    }, 220);
    return () => clearTimeout(timeout);
  }, [query, fetchResults]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void fetchResults(query);
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

        <form onSubmit={handleSubmit} className="relative">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for a keyword"
            className="h-14 rounded-lg border border-border px-12 text-lg font-medium"
            autoComplete="off"
          />
          <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground" />
          {loadingSuggestions && (
            <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-foreground" />
          )}

          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-2 w-full rounded-lg border border-border bg-background">
              {suggestions.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-secondary"
                    onClick={() => {
                      setQuery(item);
                      setSuggestions([]);
                      void fetchResults(item);
                    }}
                  >
                    <span>{item}</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
                  <th className="px-3 py-2 font-medium">Volume</th>
                  <th className="px-3 py-2 font-medium">Competition</th>
                  <th className="px-3 py-2 font-medium">Trend</th>
                  <th className="px-3 py-2 font-medium">LexyBrain</th>
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
                          {formatPercent(keyword.demand_index)}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium">
                          {formatPercent(keyword.competition_score)}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium">
                          {formatPercent(keyword.trend_momentum)}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {insight && isActive ? insight.summary : "Open LexyBrain"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
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
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                void loadInsight(keyword);
                              }}
                            >
                              <Brain className="mr-1 h-4 w-4" />
                              Ask
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

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  const bounded = Math.max(0, Math.min(1, value));
  return `${Math.round(bounded * 100)}%`;
}
