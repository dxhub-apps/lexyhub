"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import Link from "next/link";
import { Search, TrendingUp, BarChart3, Star, X, RefreshCw, Download, Plus } from "lucide-react";

import KeywordSparkline from "@/components/keywords/KeywordSparkline";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// UX refactor goals, no feature loss:
// - Single reducer manages state
// - Debounced search + AbortController
// - LocalStorage persistence for filters
// - Keyboard a11y for tabs and table sorting
// - Client-side sorting and pagination
// - Sticky status bar under the hero
// - Same endpoints and actions

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

type PlanTier = "free" | "growth" | "scale";

type KeywordResult = {
  id?: string;
  term: string;
  source: string;
  market: string;
  similarity: number;
  ai_opportunity_score?: number | null;
  trend_momentum?: number | null;
  freshness_ts?: string | null;
  method?: string | null;
  extras?: Record<string, unknown> | null;
  compositeScore?: number;
};

type SearchResponse = {
  query: string;
  market: string;
  source: string;
  plan: PlanTier;
  sources: string[];
  results: KeywordResult[];
  insights?: { summary: string; generatedAt: string; model: string };
};

type TagOptimizerResult = {
  tags: string[];
  reasoning: string;
  confidence: number;
  model: string;
};

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

const SOURCE_DETAILS: Record<string, { title: string; description: string }> = {
  synthetic: {
    title: "Synthetic AI",
    description: "Simulated demand signals to explore new territory.",
  },
  amazon: {
    title: "Amazon Marketplace",
    description: "Real buyer search data for commercial alignment.",
  },
};

const MARKET_OPTIONS = [
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "de", label: "Germany" },
];

const DEFAULT_SOURCES = Object.keys(SOURCE_DETAILS);
const DEFAULT_PLAN: PlanTier = "growth";
const PAGE_SIZE = 25;
const LS_KEY = "lexyhub.keywords.filters.v1";

// ---------------------------------------------------------
// Utils
// ---------------------------------------------------------

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const percent = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `${Math.round(clamp01(n) * 100)}%` : "—";

const parseTagTokens = (tags: string): string[] =>
  tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

const deriveOpportunityScore = (k: KeywordResult): number => {
  if (typeof k.ai_opportunity_score === "number") return k.ai_opportunity_score;
  if (typeof k.trend_momentum === "number") return k.trend_momentum;
  if (typeof k.similarity === "number") return k.similarity;
  return 0;
};

const byKey = <T,>(key: keyof T, dir: "asc" | "desc" = "asc") => (a: T, b: T) => {
  const av = (a[key] as unknown) as number | string | null | undefined;
  const bv = (b[key] as unknown) as number | string | null | undefined;
  const na = av == null ? -Infinity : (av as number);
  const nb = bv == null ? -Infinity : (bv as number);
  const sa = typeof av === "string" ? av.toLowerCase() : "";
  const sb = typeof bv === "string" ? bv.toLowerCase() : "";
  let cmp = 0;
  if (typeof av === "number" || typeof bv === "number") cmp = na - nb;
  else cmp = sa.localeCompare(sb);
  return dir === "asc" ? cmp : -cmp;
};

// ---------------------------------------------------------
// State
// ---------------------------------------------------------

type Filters = { sources: string[]; market: string; tags: string };

type State = {
  query: string;
  lastQuery: string;
  filters: Filters;
  results: KeywordResult[];
  responseSources: string[];
  insights: SearchResponse["insights"] | null;
  loading: boolean;
  error: string | null;
  // view
  activeTab: "overview" | "opportunities";
  // table controls
  sortKey: "term" | "ai_opportunity_score" | "trend_momentum" | "compositeScore" | "source" | "freshness_ts";
  sortDir: "asc" | "desc";
  page: number;
  // optimizer modal
  optOpen: boolean;
  optLoading: boolean;
  optError: string | null;
  optResult: TagOptimizerResult | null;
  optKeyword: KeywordResult | null;
};

const initialState: State = {
  query: "",
  lastQuery: "",
  filters: { sources: [...DEFAULT_SOURCES], market: "us", tags: "" },
  results: [],
  responseSources: [...DEFAULT_SOURCES],
  insights: null,
  loading: false,
  error: null,
  activeTab: "opportunities",
  sortKey: "ai_opportunity_score",
  sortDir: "desc",
  page: 1,
  optOpen: false,
  optLoading: false,
  optError: null,
  optResult: null,
  optKeyword: null,
};

type Action =
  | { type: "SET_QUERY"; v: string }
  | { type: "SET_FILTERS"; v: Filters }
  | { type: "LOAD_FILTERS"; v?: Filters }
  | { type: "SEARCH_START" }
  | { type: "SEARCH_OK"; v: { payload: SearchResponse; fallback: string[] } }
  | { type: "SEARCH_ERR"; v: string }
  | { type: "SET_TAB"; v: State["activeTab"] }
  | { type: "SET_SORT"; key: State["sortKey"]; dir: State["sortDir"] }
  | { type: "SET_PAGE"; v: number }
  | { type: "OPT_OPEN"; v: KeywordResult }
  | { type: "OPT_CLOSE" }
  | { type: "OPT_LOADING"; v: boolean }
  | { type: "OPT_OK"; v: TagOptimizerResult }
  | { type: "OPT_ERR"; v: string };

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "SET_QUERY":
      return { ...state, query: a.v };
    case "SET_FILTERS":
      return { ...state, filters: a.v, page: 1 };
    case "LOAD_FILTERS":
      return a.v ? { ...state, filters: a.v } : state;
    case "SEARCH_START":
      return { ...state, loading: true, error: null };
    case "SEARCH_OK": {
      const { payload, fallback } = a.v;
      return {
        ...state,
        loading: false,
        results: payload.results ?? [],
        insights: payload.insights ?? null,
        lastQuery: payload.query ?? state.query,
        responseSources: payload.sources?.length ? payload.sources : fallback,
        page: 1,
      };
    }
    case "SEARCH_ERR":
      return { ...state, loading: false, error: a.v };
    case "SET_TAB":
      return { ...state, activeTab: a.v };
    case "SET_SORT":
      return { ...state, sortKey: a.key, sortDir: a.dir, page: 1 };
    case "SET_PAGE":
      return { ...state, page: a.v };
    case "OPT_OPEN":
      return { ...state, optOpen: true, optLoading: true, optResult: null, optError: null, optKeyword: a.v };
    case "OPT_CLOSE":
      return { ...state, optOpen: false, optLoading: false, optResult: null, optError: null, optKeyword: null };
    case "OPT_LOADING":
      return { ...state, optLoading: a.v };
    case "OPT_OK":
      return { ...state, optLoading: false, optResult: a.v };
    case "OPT_ERR":
      return { ...state, optLoading: false, optError: a.v };
    default:
      return state;
  }
}

// ---------------------------------------------------------
// Component
// ---------------------------------------------------------

export default function KeywordsPage(): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Load filters from storage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Filters;
        const normalized: Filters = {
          market: parsed.market ?? "us",
          tags: parsed.tags ?? "",
          sources: (parsed.sources ?? DEFAULT_SOURCES).filter((s) => DEFAULT_SOURCES.includes(s)),
        };
        dispatch({ type: "LOAD_FILTERS", v: normalized });
      }
    } catch {}
  }, []);

  // Persist filters
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state.filters));
    } catch {}
  }, [state.filters]);

  // Visible results with tag filter
  const tagTokens = useMemo(() => parseTagTokens(state.filters.tags), [state.filters.tags]);

  const visibleResults = useMemo(() => {
    if (!tagTokens.length) return state.results;
    return state.results.filter((k) => {
      const tags = ((k.extras?.["tags"] as string[] | undefined) ?? []).map((t) => t.toLowerCase());
      const term = k.term.toLowerCase();
      return tagTokens.some((t) => term.includes(t) || tags.some((tg) => tg.includes(t)));
    });
  }, [state.results, tagTokens]);

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...visibleResults];
    if (state.sortKey === "term" || state.sortKey === "source" || state.sortKey === "freshness_ts") {
      return arr.sort(byKey<any>(state.sortKey, state.sortDir));
    }
    return arr.sort((a, b) => {
      const primary = byKey<any>(state.sortKey, state.sortDir)(a as any, b as any);
      if (primary !== 0) return primary;
      return byKey<any>("ai_opportunity_score", "desc")(a as any, b as any);
    });
  }, [visibleResults, state.sortKey, state.sortDir]);

  // Pagination
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, state.page), pageCount);
  const pageSlice = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, pageSafe]);

  // Lineage + sparkline inputs
  const freshestTs = useMemo(() => {
    const ts = state.results.reduce<string | null>((latest, r) => {
      const t = r.freshness_ts;
      if (!t) return latest;
      if (!latest) return t;
      return new Date(t).getTime() > new Date(latest).getTime() ? t : latest;
    }, null);
    return ts ? new Date(ts).toLocaleString() : "Not yet synced";
  }, [state.results]);

  const sparklinePoints = useMemo(() => {
    const deriveVal = (k: KeywordResult): number | null => {
      if (typeof k.compositeScore === "number") return clamp01(k.compositeScore);
      if (typeof k.trend_momentum === "number") return clamp01(k.trend_momentum);
      if (typeof k.ai_opportunity_score === "number") return clamp01(k.ai_opportunity_score);
      if (Number.isFinite(k.similarity)) return clamp01(k.similarity);
      return null;
    };
    const parseTs = (v?: string | null) => (v ? new Date(v).getTime() || 0 : 0);
    return visibleResults
      .map((k) => {
        const v = deriveVal(k);
        if (v == null) return null;
        return { value: v, label: k.term, timestamp: k.freshness_ts ?? null, order: parseTs(k.freshness_ts) };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.order - b.order)
      .slice(-24)
      .map(({ value, label, timestamp }: any) => ({ value, label, timestamp }));
  }, [visibleResults]);

  // Chips
  const filterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void }> = [];
    if (state.filters.market !== "us") {
      const label = `Market: ${MARKET_OPTIONS.find((o) => o.value === state.filters.market)?.label ?? state.filters.market}`;
      chips.push({ id: "market", label, onRemove: () => dispatch({ type: "SET_FILTERS", v: { ...state.filters, market: "us" } }) });
    }
    if (state.filters.sources.length !== DEFAULT_SOURCES.length) {
      chips.push({
        id: "sources",
        label: `Sources: ${state.filters.sources.map((s) => SOURCE_DETAILS[s]?.title ?? s).join(", ")}`,
        onRemove: () => dispatch({ type: "SET_FILTERS", v: { ...state.filters, sources: [...DEFAULT_SOURCES] } }),
      });
    }
    parseTagTokens(state.filters.tags).forEach((t) => {
      const removeTag = () => {
        const tokens = parseTagTokens(state.filters.tags).filter((x) => x !== t);
        dispatch({ type: "SET_FILTERS", v: { ...state.filters, tags: tokens.join(tokens.length ? ", " : "") } });
      };
      chips.push({ id: `tag-${t}`, label: `Tag: ${t}`, onRemove: removeTag });
    });
    return chips;
  }, [state.filters]);

  // Search with debounce + abort
  const performSearch = useCallback(
    async (term: string) => {
      const q = term.trim();
      if (!q) return;
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      dispatch({ type: "SEARCH_START" });
      try {
        const res = await fetch("/api/keywords/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, market: state.filters.market, limit: PAGE_SIZE, plan: DEFAULT_PLAN, sources: state.filters.sources }),
          signal: ctl.signal,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error ?? `Keyword search failed (${res.status})`);
        }
        const payload = (await res.json()) as SearchResponse;
        dispatch({ type: "SEARCH_OK", v: { payload, fallback: state.filters.sources } });
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        dispatch({ type: "SEARCH_ERR", v: e instanceof Error ? e.message : "Unexpected error" });
      }
    },
    [state.filters.market, state.filters.sources]
  );

  const debouncedSubmit = useCallback(
    (term: string) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        dispatch({ type: "SET_TAB", v: "opportunities" });
        void performSearch(term);
      }, 250);
    },
    [performSearch]
  );

  // Actions
  const canRefresh = Boolean(state.lastQuery);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    dispatch({ type: "SET_TAB", v: "opportunities" });
    void performSearch(state.query);
  };
  const onRefresh = () => {
    if (!state.lastQuery) return;
    dispatch({ type: "SET_TAB", v: "opportunities" });
    void performSearch(state.lastQuery);
  };

  const handleWatchlist = useCallback(
    async (keyword: KeywordResult) => {
      if (!userId) {
        toast({ title: "Sign in required", description: "You must be signed in to save watchlist items.", variant: "destructive" });
        return;
      }
      try {
        const res = await fetch("/api/watchlists/add", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({ keywordId: keyword.id, watchlistName: "Lexy Tracking" }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error ?? `Unable to add keyword (${res.status})`);
        }
        toast({ title: "Added to watchlist", description: `"${keyword.term}" is now monitored.`, variant: "success" });
      } catch (err: any) {
        toast({ title: "Watchlist error", description: err?.message ?? "Unexpected error", variant: "destructive" });
      }
    },
    [toast, userId]
  );

  const handleOptimize = useCallback(
    async (keyword: KeywordResult) => {
      dispatch({ type: "OPT_OPEN", v: keyword });
      if (!userId) {
        dispatch({ type: "OPT_ERR", v: "Sign in to request AI tag suggestions." });
        return;
      }
      try {
        const res = await fetch("/api/ai/tag-optimizer", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({
            keywordId: keyword.id,
            listingTitle: keyword.term,
            market: keyword.market,
            currentTags: (keyword.extras?.["tags"] as string[] | undefined) ?? [],
            goals: ["visibility", "conversion"],
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error ?? `Optimizer request failed (${res.status})`);
        }
        const payload = (await res.json()) as TagOptimizerResult;
        dispatch({ type: "OPT_OK", v: payload });
      } catch (err: any) {
        dispatch({ type: "OPT_ERR", v: err?.message ?? "Unexpected error" });
      }
    },
    [userId]
  );

  // Derived labels
  const sourceLineageLabel = useMemo(() => {
    if (!state.responseSources.length) return "synthetic";
    return state.responseSources.map((s) => SOURCE_DETAILS[s]?.title ?? s).join(", ") || "synthetic";
  }, [state.responseSources]);

  const topOpportunity = useMemo(() => {
    if (!visibleResults.length) return null;
    return [...visibleResults].sort((a, b) => deriveOpportunityScore(b) - deriveOpportunityScore(a))[0];
  }, [visibleResults]);

  const chips = useMemo(() => filterChips, [filterChips]);

  // UI
  const tabs: Array<{ id: State["activeTab"]; label: string; description?: string }> = [
    { id: "overview", label: "Overview", description: "Narrative & lineage" },
    { id: "opportunities", label: "Opportunities", description: state.loading ? "Updating…" : `${visibleResults.length} keywords` },
  ];

  // Handlers for filters
  const toggleSource = (src: string) => {
    const s = src.toLowerCase();
    const exists = state.filters.sources.includes(s);
    const next = exists ? state.filters.sources.filter((x) => x !== s) : Array.from(new Set([...state.filters.sources, s]));
    if (!next.length) return; // keep at least one
    dispatch({ type: "SET_FILTERS", v: { ...state.filters, sources: next } });
  };

  const onTabsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const localTabs = tabs;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const idx = localTabs.findIndex((t) => t.id === state.activeTab);
      const next = e.key === "ArrowRight" ? (idx + 1) % localTabs.length : (idx - 1 + localTabs.length) % localTabs.length;
      dispatch({ type: "SET_TAB", v: localTabs[next].id });
    }
  };

  // Render
  return (
    <div className="space-y-8">
      {/* Hero */}
      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div>
              <Badge variant="outline" className="mb-2">Keyword workspace</Badge>
              <CardTitle className="text-3xl font-bold">Keyword Intelligence</CardTitle>
              <CardDescription className="mt-2 text-base">
                Monitor live demand, uncover AI-suggested opportunities, and orchestrate watchlists in one canvas.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Latest search</span>
              <strong className="text-base font-semibold">{state.lastQuery ? `"${state.lastQuery}"` : "Awaiting search"}</strong>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Signals in scope</span>
              <strong className="text-base font-semibold">{sourceLineageLabel}</strong>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Records in view</span>
              <strong className="text-base font-semibold">{state.loading ? "…" : visibleResults.length}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search controls */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Search intelligence</CardTitle>
              <CardDescription>Run a fresh analysis, tune sources, and surface opportunities.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "SET_FILTERS", v: { sources: [...DEFAULT_SOURCES], market: "us", tags: "" } })}
              disabled={state.loading || chips.length === 0}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={(e) => { e.preventDefault(); dispatch({ type: "SET_TAB", v: "opportunities" }); void performSearch(state.query); }} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyword-query">Keyword or product idea</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="keyword-query"
                      value={state.query}
                      onChange={(e) => { dispatch({ type: "SET_QUERY", v: e.target.value }); }}
                      placeholder="Search for opportunities, e.g. boho nursery decor"
                      disabled={state.loading}
                      autoComplete="off"
                      aria-describedby="keyword-hint"
                      className="pl-9"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); dispatch({ type: "SET_TAB", v: "opportunities" }); void performSearch(state.query); } }}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => { dispatch({ type: "SET_TAB", v: "opportunities" }); void performSearch(state.query); }}
                    disabled={state.loading || !state.query.trim()}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </Button>
                </div>
                <p id="keyword-hint" className="text-xs text-muted-foreground">Click Search button or press Enter to find opportunities.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="market-select">Market</Label>
                  <Select
                    value={state.filters.market}
                    onValueChange={(value) => dispatch({ type: "SET_FILTERS", v: { ...state.filters, market: value } })}
                    disabled={state.loading}
                  >
                    <SelectTrigger id="market-select">
                      <SelectValue placeholder="Select market" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKET_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tag-focus">Tag focus</Label>
                  <Input
                    id="tag-focus"
                    type="text"
                    value={state.filters.tags}
                    onChange={(e) => dispatch({ type: "SET_FILTERS", v: { ...state.filters, tags: e.target.value } })}
                    placeholder="e.g. boho, nursery, eco"
                    disabled={state.loading}
                  />
                  <p className="text-xs text-muted-foreground">Comma separate phrases to influence AI suggestions.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { if (!state.lastQuery) return; dispatch({ type: "SET_TAB", v: "opportunities" }); void performSearch(state.lastQuery); }}
                disabled={state.loading || !Boolean(state.lastQuery)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Replay last search
              </Button>
            </div>
          </form>

          {/* Active filters */}
          {filterChips.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-live="polite">
              {filterChips.map((chip) => (
                <Badge key={chip.id} variant="secondary" className="gap-2">
                  {chip.label}
                  {chip.onRemove && (
                    <button
                      type="button"
                      className="ml-1 hover:text-foreground"
                      aria-label={`Remove filter ${chip.label}`}
                      onClick={chip.onRemove}
                      disabled={state.loading}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}
          {filterChips.length === 0 && (
            <p className="text-sm text-muted-foreground">All approved sources and markets are in scope.</p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={state.activeTab} onValueChange={(v) => dispatch({ type: "SET_TAB", v: v as State["activeTab"] })}>
        <TabsList className="w-full justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="flex-col items-start gap-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <span>{t.label}</span>
              {t.description && <span className="text-xs opacity-70">{t.description}</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <Badge variant="outline" className="w-fit mb-2">Helpful highlights</Badge>
              <CardTitle>What the signals are saying</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{state.insights?.summary ?? "Run a search to unlock AI-assisted guidance."}</p>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Last updated: {state.insights?.generatedAt ? new Date(state.insights.generatedAt).toLocaleString() : "Not yet generated"}</span>
                {state.insights?.model && <span>Model: {state.insights.model}</span>}
              </div>
              <KeywordSparkline points={sparklinePoints} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Signal lineage</CardTitle>
                <CardDescription>
                  Sources: {(state.responseSources.length ? state.responseSources : ["synthetic"]).join(", ")} · Freshness: {freshestTs}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-border pb-2">
                    <dt className="font-medium">Sources</dt>
                    <dd className="text-muted-foreground">{state.responseSources.join(", ")}</dd>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <dt className="font-medium">Freshest sync</dt>
                    <dd className="text-muted-foreground">{freshestTs}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium">Records in view</dt>
                    <dd className="text-muted-foreground">{visibleResults.length}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Momentum playbook</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>Export top movers and sync them to the Market Twin for visibility simulations.</li>
                  <li>Use the watchlist action to trigger alerts without leaving this page.</li>
                  <li>Refine Tag focus to shape AI suggestions.</li>
                </ul>
                {tagTokens.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Tag emphasis</span>
                    <div className="flex flex-wrap gap-2">
                      {tagTokens.map((t) => (
                        <Badge key={t} variant="secondary">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Keyword opportunities</CardTitle>
                  <CardDescription>{state.lastQuery ? `Insights for "${state.lastQuery}"` : "Run a search to populate opportunities."}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!sorted.length || state.loading}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button size="sm" disabled={!sorted.length || state.loading}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add to watchlist
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Visible keywords</span>
                  <span className="text-lg font-semibold">{state.loading ? "…" : sorted.length}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Signals</span>
                  <span className="text-lg font-semibold">{sourceLineageLabel}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Freshest sync</span>
                  <span className="text-lg font-semibold">{freshestTs}</span>
                </div>
              </div>

              {state.results.length - visibleResults.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {state.results.length - visibleResults.length} results hidden by tag or source filters
                </p>
              )}

              {topOpportunity && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-base">Priority opportunity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm"><strong>{topOpportunity.term}</strong> shows the strongest combined momentum across active signals.</p>
                    <p className="mt-2 text-xs text-muted-foreground">{SOURCE_DETAILS[topOpportunity.source]?.title ?? topOpportunity.source} · {topOpportunity.freshness_ts ? new Date(topOpportunity.freshness_ts).toLocaleString() : "Not yet synced"}</p>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {([
                        { key: "term", label: "Keyword" },
                        { key: "ai_opportunity_score", label: "Demand index" },
                        { key: "compositeScore", label: "Competition" },
                        { key: "trend_momentum", label: "Trend momentum" },
                        { key: "source", label: "Source" },
                        { key: "__actions", label: "Actions" },
                      ] as const).map((col) => (
                        <th
                          key={col.key}
                          scope="col"
                          className="px-4 py-3 text-left text-sm font-medium"
                          aria-sort={state.sortKey === col.key ? (state.sortDir === "asc" ? "ascending" : "descending") : "none"}
                        >
                          {col.key === "__actions" ? (
                            <span>{col.label}</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-8"
                              onClick={() => dispatch({ type: "SET_SORT", key: col.key as any, dir: state.sortKey === col.key && state.sortDir === "desc" ? "asc" : "desc" })}
                              aria-label={`Sort by ${col.label}`}
                            >
                              {col.label}
                              {state.sortKey === col.key && (
                                <TrendingUp className={cn("ml-2 h-4 w-4", state.sortDir === "asc" && "rotate-180")} />
                              )}
                            </Button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.loading && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          Searching for opportunities…
                        </td>
                      </tr>
                    )}

                    {!state.loading && pageSlice.length > 0 && pageSlice.map((k) => {
                      const cats = k.extras?.["category"] as string | undefined;
                      const tags = (k.extras?.["tags"] as string[] | undefined) ?? [];
                      return (
                        <tr key={`${k.term}-${k.source}`} className="border-b last:border-0 hover:bg-muted/50">
                          <th scope="row" className="px-4 py-3 text-left font-medium">
                            <div className="space-y-1">
                              <Link
                                href={`/keywords/${encodeURIComponent(k.term)}`}
                                className="font-semibold text-primary hover:underline"
                              >
                                {k.term}
                              </Link>
                              {cats && <div className="text-xs text-muted-foreground">{cats}</div>}
                              {tags.length > 0 && (
                                <div className="flex flex-wrap gap-1" aria-label="Associated tags">
                                  {tags.map((t) => (
                                    <Badge key={t} variant="outline" className="text-xs">
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </th>
                          <td className="px-4 py-3 text-sm">{percent(k.ai_opportunity_score ?? null)}</td>
                          <td className="px-4 py-3 text-sm">{percent(k.compositeScore ?? null)}</td>
                          <td className="px-4 py-3 text-sm">{percent(k.trend_momentum ?? null)}</td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant="secondary">{SOURCE_DETAILS[k.source]?.title ?? k.source}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleWatchlist(k)}>
                                <Star className="mr-1 h-3 w-3" />
                                Watch
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleOptimize(k)}>
                                Optimize
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {!state.loading && pageSlice.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center">
                          <h3 className="font-semibold">No keyword insights yet</h3>
                          <p className="text-sm text-muted-foreground">Adjust filters or run a new search.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dispatch({ type: "SET_PAGE", v: Math.max(1, pageSafe - 1) })}
                  disabled={pageSafe <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {pageSafe} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dispatch({ type: "SET_PAGE", v: Math.min(pageCount, pageSafe + 1) })}
                  disabled={pageSafe >= pageCount}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error */}
      {state.error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive" role="alert">{state.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Optimizer modal */}
      <Dialog open={state.optOpen} onOpenChange={(open) => !open && dispatch({ type: "OPT_CLOSE" })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tag Optimizer</DialogTitle>
            <DialogDescription>
              {state.optKeyword && (
                <>
                  Keyword context: <strong>{state.optKeyword.term}</strong> ({state.optKeyword.market})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {state.optLoading && <p className="text-sm text-muted-foreground">Generating AI suggestions…</p>}
            {state.optError && <p className="text-sm text-destructive">{state.optError}</p>}
            {state.optResult && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">
                    Suggested Tags <span className="text-xs text-muted-foreground">({state.optResult.model})</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {state.optResult.tags.map((t) => (
                      <Badge key={t} variant="default">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{state.optResult.reasoning}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Confidence: {Math.round(state.optResult.confidence * 100)}%
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => dispatch({ type: "OPT_CLOSE" })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
