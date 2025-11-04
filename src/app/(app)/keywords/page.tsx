"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import KeywordSparkline from "@/components/keywords/KeywordSparkline";
import { useToast } from "@/components/ui/use-toast";

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
  const PAGE = PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const pageSafe = Math.min(Math.max(1, state.page), pageCount);
  const pageSlice = useMemo(() => {
    const start = (pageSafe - 1) * PAGE;
    return sorted.slice(start, start + PAGE);
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
    <div className="keywords-page">
      {/* Hero */}
      <section className="keywords-hero-card surface-card" aria-labelledby="keywords-title">
        <div className="keywords-hero-card__intro">
          <p className="keywords-hero__eyebrow">Keyword workspace</p>
          <h1 id="keywords-title">Keyword Intelligence</h1>
          <p>Monitor live demand, uncover AI-suggested opportunities, and orchestrate watchlists in one canvas.</p>
        </div>
        <div className="keywords-hero-card__stats">
          <div>
            <span>Latest search</span>
            <strong>{state.lastQuery ? `“${state.lastQuery}”` : "Awaiting search"}</strong>
          </div>
          <div>
            <span>Signals in scope</span>
            <strong>{sourceLineageLabel}</strong>
          </div>
          <div>
            <span>Records in view</span>
            <strong>{state.loading ? "…" : visibleResults.length}</strong>
          </div>
        </div>
      </section>

      {/* Search controls */}
      <section className="keywords-search-card surface-card" aria-label="Keyword search controls">
        <header className="keywords-search-card__header">
          <div>
            <h2>Search intelligence</h2>
            <p>Run a fresh analysis, tune sources, and surface opportunities.</p>
          </div>
          <button type="button" onClick={() => dispatch({ type: "SET_FILTERS", v: { sources: [...DEFAULT_SOURCES], market: "us", tags: "" } })} disabled={state.loading || chips.length === 0}>
            Reset filters
          </button>
        </header>
        <form className="keywords-search-form" onSubmit={(e) => { e.preventDefault(); dispatch({ type: "SET_TAB", v: "opportunities" }); void performSearch(state.query); }}>
          <div className="keywords-search-grid">
            <div className="keywords-search-main">
              <label htmlFor="keyword-query">Keyword or product idea</label>
              <div className="keywords-search-input">
                <input
                  id="keyword-query"
                  value={state.query}
                  onChange={(e) => { dispatch({ type: "SET_QUERY", v: e.target.value }); debouncedSubmit(e.target.value); }}
                  placeholder="Search for opportunities, e.g. boho nursery decor"
                  disabled={state.loading}
                  autoComplete="off"
                  aria-describedby="keyword-hint"
                />
              </div>
              <p id="keyword-hint" className="keywords-search-form__hint">Press Enter to refresh demand signals.</p>
            </div>

            <div className="keywords-search-controls">
              <div className="keywords-search-control">
                <span className="keywords-search-control__label">Market</span>
                <select
                  value={state.filters.market}
                  onChange={(e) => dispatch({ type: "SET_FILTERS", v: { ...state.filters, market: e.target.value } })}
                  disabled={state.loading}
                >
                  {MARKET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="keywords-search-control">
                <span className="keywords-search-control__label">Signals</span>
                <div className="keywords-search-sources">
                  {DEFAULT_SOURCES.map((source) => {
                    const active = state.filters.sources.includes(source);
                    const detail = SOURCE_DETAILS[source];
                    return (
                      <button
                        type="button"
                        key={source}
                        className={active ? "keywords-source is-active" : "keywords-source"}
                        onClick={() => toggleSource(source)}
                        disabled={state.loading || (active && state.filters.sources.length === 1)}
                      >
                        <span className="keywords-source__title">{detail?.title ?? source}</span>
                        <span className="keywords-source__description">{detail?.description ?? ""}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="keywords-search-control">
                <span className="keywords-search-control__label">Tag focus</span>
                <input
                  type="text"
                  value={state.filters.tags}
                  onChange={(e) => dispatch({ type: "SET_FILTERS", v: { ...state.filters, tags: e.target.value } })}
                  placeholder="e.g. boho, nursery, eco"
                  disabled={state.loading}
                />
                <p className="keywords-search-control__hint">Comma separate phrases to influence AI suggestions.</p>
              </div>
            </div>
          </div>

          <div className="keywords-search-form__actions">
            <button type="submit" disabled={state.loading || !state.query.trim()}> {state.loading ? "Searching…" : "Search"} </button>
            <button type="button" onClick={() => { if (!state.lastQuery) return; dispatch({ type: "SET_TAB", v: "opportunities" }); void performSearch(state.lastQuery); }} disabled={state.loading || !Boolean(state.lastQuery)}>Replay last search</button>
          </div>
        </form>

        <div className="keywords-active-filters" aria-live="polite">
          {filterChips.length ? (
            <ul className="filter-chips" aria-label="Active filters">
              {filterChips.map((chip) => (
                <li key={chip.id}>
                  <span className="filter-chip">
                    {chip.label}
                    {chip.onRemove ? (
                      <button type="button" aria-label={`Remove filter ${chip.label}`} onClick={chip.onRemove} disabled={state.loading}>×</button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="keywords-active-filters__hint">All approved sources and markets are in scope.</p>
          )}
        </div>
      </section>

      {/* Tabs */}
      <nav className="keywords-tabs" role="tablist" aria-label="Keyword insights" onKeyDown={onTabsKeyDown}>
        {tabs.map((t) => {
          const isActive = state.activeTab === t.id;
          const controls = t.id === "overview" ? "keywords-panel-overview" : "keywords-panel-opportunities";
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`keywords-tab-${t.id}`}
              aria-controls={controls}
              aria-selected={isActive}
              className={isActive ? "keywords-tab is-active" : "keywords-tab"}
              onClick={() => dispatch({ type: "SET_TAB", v: t.id })}
            >
              <span>{t.label}</span>
              {t.description ? <span className="keywords-tab__description">{t.description}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="keywords-tabpanels">
        {/* Overview */}
        <div id="keywords-panel-overview" role="tabpanel" aria-labelledby="keywords-tab-overview" hidden={state.activeTab !== "overview"}>
          <div className="keywords-overview">
            <section className="keywords-highlight surface-card">
              <header className="keywords-highlight__header">
                <p className="keywords-highlight__eyebrow">Helpful highlights</p>
                <h3>What the signals are saying</h3>
              </header>
              <p className="keywords-highlight__summary">{state.insights?.summary ?? "Run a search to unlock AI-assisted guidance."}</p>
              <div className="keywords-highlight__meta">
                <span>Last updated: {state.insights?.generatedAt ? new Date(state.insights.generatedAt).toLocaleString() : "Not yet generated"}</span>
                {state.insights?.model ? <span>Model: {state.insights.model}</span> : null}
              </div>
              <KeywordSparkline points={sparklinePoints} />
            </section>

            <div className="keywords-overview-grid">
              <section className="keywords-overview-card surface-card">
                <h3>Signal lineage</h3>
                <p className="keywords-overview-card__description">Sources: {(state.responseSources.length ? state.responseSources : ["synthetic"]).join(", ")} · Freshness: {freshestTs}</p>
                <dl className="keyword-data-info">
                  <div><dt>Sources</dt><dd>{state.responseSources.join(", ")}</dd></div>
                  <div><dt>Freshest sync</dt><dd>{freshestTs}</dd></div>
                  <div><dt>Records in view</dt><dd>{visibleResults.length}</dd></div>
                </dl>
              </section>

              <section className="keywords-overview-card surface-card">
                <h3>Momentum playbook</h3>
                <ul className="keywords-playbook">
                  <li>Export top movers and sync them to the Market Twin for visibility simulations.</li>
                  <li>Use the watchlist action to trigger alerts without leaving this page.</li>
                  <li>Refine Tag focus to shape AI suggestions.</li>
                </ul>
                {tagTokens.length ? (
                  <div className="keywords-tag-focus" aria-label="Tag focus">
                    <span>Tag emphasis</span>
                    <ul>{tagTokens.map((t) => (<li key={t}>{t}</li>))}</ul>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </div>

        {/* Opportunities */}
        <div id="keywords-panel-opportunities" role="tabpanel" aria-labelledby="keywords-tab-opportunities" hidden={state.activeTab !== "opportunities"}>
          <section className="keywords-opportunities-card surface-card" aria-live="polite">
            <header className="keywords-opportunities__header">
              <div>
                <h2>Keyword opportunities</h2>
                <p className="keywords-opportunities__subtitle">{state.lastQuery ? `Insights for “${state.lastQuery}”` : "Run a search to populate opportunities."}</p>
              </div>
              <div className="keywords-opportunities__actions">
                <button type="button" disabled={!sorted.length || state.loading}>Export CSV</button>
                <button type="button" disabled={!sorted.length || state.loading}>Add to watchlist</button>
              </div>
            </header>

            <div className="keywords-opportunities__stats" role="list">
              <div role="listitem"><span className="keywords-opportunities__label">Visible keywords</span><span className="keywords-opportunities__value">{state.loading ? "…" : sorted.length}</span></div>
              <div role="listitem"><span className="keywords-opportunities__label">Signals</span><span className="keywords-opportunities__value">{sourceLineageLabel}</span></div>
              <div role="listitem"><span className="keywords-opportunities__label">Freshest sync</span><span className="keywords-opportunities__value">{freshestTs}</span></div>
              {state.results.length - visibleResults.length > 0 ? (
                <div role="listitem" className="keywords-opportunities__note">{state.results.length - visibleResults.length} results hidden by tag or source filters</div>
              ) : null}
            </div>

            {topOpportunity ? (
              <aside className="keywords-opportunities__highlight" role="note">
                <h3>Priority opportunity</h3>
                <p><strong>{topOpportunity.term}</strong> shows the strongest combined momentum across active signals.</p>
                <p className="keywords-opportunities__highlight-meta">{SOURCE_DETAILS[topOpportunity.source]?.title ?? topOpportunity.source} · {topOpportunity.freshness_ts ? new Date(topOpportunity.freshness_ts).toLocaleString() : "Not yet synced"}</p>
              </aside>
            ) : null}

            <div className="keywords-table">
              <table>
                <thead>
                  <tr>
                    {([
                      { key: "term", label: "Keyword" },
                      { key: "ai_opportunity_score", label: "Demand index" },
                      { key: "compositeScore", label: "Competition" },
                      { key: "trend_momentum", label: "Trend momentum" },
                      { key: "source", label: "Source" },
                      { key: "__actions", label: "Actions" },
                    ] as const).map((col) => (
                      <th key={col.key}
                          scope="col"
                          aria-sort={state.sortKey === col.key ? (state.sortDir === "asc" ? "ascending" : "descending") : "none"}
                      >
                        {col.key === "__actions" ? (
                          <span>{col.label}</span>
                        ) : (
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => dispatch({ type: "SET_SORT", key: col.key as any, dir: state.sortKey === col.key && state.sortDir === "desc" ? "asc" : "desc" })}
                            aria-label={`Sort by ${col.label}`}
                          >
                            {col.label}
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.loading ? (
                    <tr><td colSpan={6} className="keywords-empty">Searching for opportunities…</td></tr>
                  ) : null}

                  {!state.loading && pageSlice.length ? (
                    pageSlice.map((k) => {
                      const cats = k.extras?.["category"] as string | undefined;
                      const tags = (k.extras?.["tags"] as string[] | undefined) ?? [];
                      return (
                        <tr key={`${k.term}-${k.source}`}>
                          <th scope="row">
                            <div className="keyword-term">
                              <span className="keyword-term__title">{k.term}</span>
                              {cats ? <span className="keyword-term__meta">{cats}</span> : null}
                              {tags.length ? (
                                <ul className="keyword-term__tags" aria-label="Associated tags">
                                  {tags.map((t) => (<li key={t}><span>{t}</span></li>))}
                                </ul>
                              ) : null}
                            </div>
                          </th>
                          <td>{percent(k.ai_opportunity_score ?? null)}</td>
                          <td>{percent(k.compositeScore ?? null)}</td>
                          <td>{percent(k.trend_momentum ?? null)}</td>
                          <td><span className="keyword-source">{SOURCE_DETAILS[k.source]?.title ?? k.source}</span></td>
                          <td className="keyword-actions">
                            <button className="keyword-watch" onClick={() => handleWatchlist(k)}>Add to watchlist</button>
                            <button className="keyword-optimize" onClick={() => handleOptimize(k)}>Optimize tags</button>
                          </td>
                        </tr>
                      );
                    })
                  ) : null}

                  {!state.loading && !pageSlice.length ? (
                    <tr><td colSpan={6} className="keywords-empty"><h3>No keyword insights yet</h3><p>Adjust filters or run a new search.</p></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="keywords-opportunities__actions" aria-label="Pagination">
              <button type="button" onClick={() => dispatch({ type: "SET_PAGE", v: Math.max(1, pageSafe - 1) })} disabled={pageSafe <= 1}>Prev</button>
              <span className="keywords-opportunities__value" style={{ alignSelf: "center" }}>Page {pageSafe} / {pageCount}</span>
              <button type="button" onClick={() => dispatch({ type: "SET_PAGE", v: Math.min(pageCount, pageSafe + 1) })} disabled={pageSafe >= pageCount}>Next</button>
            </div>
          </section>
        </div>
      </div>

      {/* Error */}
      {state.error ? <div className="keyword-error" role="alert">{state.error}</div> : null}

      {/* Optimizer modal */}
      {state.optOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <header>
              <h2>Tag Optimizer</h2>
              <button type="button" className="modal-close" aria-label="Close optimizer" onClick={() => dispatch({ type: "OPT_CLOSE" })}>×</button>
            </header>
            <div className="modal-body">
              {state.optKeyword ? (
                <p className="modal-subtitle">Keyword context: <strong>{state.optKeyword.term}</strong> ({state.optKeyword.market})</p>
              ) : null}
              {state.optLoading ? <p>Generating AI suggestions…</p> : null}
              {state.optError ? <p className="modal-error">{state.optError}</p> : null}
              {state.optResult ? (
                <div className="optimizer-result">
                  <h3>Suggested Tags <span>({state.optResult.model})</span></h3>
                  <ul>{state.optResult.tags.map((t) => (<li key={t}><code>{t}</code></li>))}</ul>
                  <p className="optimizer-reasoning">{state.optResult.reasoning}</p>
                  <p className="optimizer-confidence">Confidence: {Math.round(state.optResult.confidence * 100)}%</p>
                </div>
              ) : null}
            </div>
            <footer className="modal-footer">
              <button type="button" className="keyword-watch" onClick={() => dispatch({ type: "OPT_CLOSE" })}>Close</button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
