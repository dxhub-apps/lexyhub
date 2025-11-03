"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";

import KeywordSparkline from "@/components/keywords/KeywordSparkline";
import { useToast } from "@/components/ui/ToastProvider";

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
  insights?: {
    summary: string;
    generatedAt: string;
    model: string;
  };
};

type TagOptimizerResult = {
  tags: string[];
  reasoning: string;
  confidence: number;
  model: string;
};

type FiltersState = {
  sources: string[];
  market: string;
  tags: string;
};

type FilterChip = {
  id: string;
  label: string;
  onRemove?: () => void;
};

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

const INITIAL_FILTERS: FiltersState = {
  sources: DEFAULT_SOURCES,
  market: "us",
  tags: "",
};

const DEFAULT_PLAN: PlanTier = "growth";

const deriveOpportunityScore = (keyword: KeywordResult): number => {
  if (typeof keyword.ai_opportunity_score === "number") {
    return keyword.ai_opportunity_score;
  }
  if (typeof keyword.trend_momentum === "number") {
    return keyword.trend_momentum;
  }
  if (typeof keyword.similarity === "number") {
    return keyword.similarity;
  }
  return 0;
};

const parseTagTokens = (tags: string): string[] =>
  tags
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

type FilterChipListProps = {
  chips: FilterChip[];
  disabled?: boolean;
};

function FilterChipList({ chips, disabled }: FilterChipListProps): JSX.Element | null {
  if (!chips.length) {
    return null;
  }

  return (
    <ul className="filter-chips" aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.id}>
          <span className="filter-chip">
            {chip.label}
            {chip.onRemove ? (
              <button
                type="button"
                aria-label={`Remove filter ${chip.label}`}
                onClick={chip.onRemove}
                disabled={disabled}
              >
                ×
              </button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

type KeywordSearchPanelProps = {
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  canRefresh: boolean;
  filters: FiltersState;
  availableSources: string[];
  chips: FilterChip[];
  onToggleSource: (source: string) => void;
  onMarketChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onClearAll: () => void;
};

function KeywordSearchPanel({
  query,
  onQueryChange,
  loading,
  onSubmit,
  onRefresh,
  canRefresh,
  filters,
  availableSources,
  chips,
  onToggleSource,
  onMarketChange,
  onTagChange,
  onClearAll,
}: KeywordSearchPanelProps): JSX.Element {
  return (
    <section className="keywords-search-card surface-card" aria-label="Keyword search controls">
      <header className="keywords-search-card__header">
        <div>
          <h2>Search intelligence</h2>
          <p>Run a fresh analysis, fine-tune the data sources, and surface opportunities without leaving the workspace.</p>
        </div>
        <button type="button" onClick={onClearAll} disabled={loading || chips.length === 0}>
          Reset filters
        </button>
      </header>
      <form className="keywords-search-form" onSubmit={onSubmit}>
        <div className="keywords-search-grid">
          <div className="keywords-search-main">
            <label htmlFor="keyword-query">Keyword or product idea</label>
            <div className="keywords-search-input">
              <input
                id="keyword-query"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search for opportunities, e.g. boho nursery decor"
                disabled={loading}
                autoComplete="off"
                aria-describedby="keyword-hint"
              />
            </div>
            <p id="keyword-hint" className="keywords-search-form__hint">
              Press Enter or tap Search to refresh demand signals.
            </p>
          </div>
          <div className="keywords-search-controls">
            <div className="keywords-search-control">
              <span className="keywords-search-control__label">Market</span>
              <select
                value={filters.market}
                onChange={(event) => onMarketChange(event.target.value)}
                disabled={loading}
              >
                {MARKET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="keywords-search-control">
              <span className="keywords-search-control__label">Signals</span>
              <div className="keywords-search-sources">
                {availableSources.map((source) => {
                  const active = filters.sources.includes(source);
                  const detail = SOURCE_DETAILS[source];
                  return (
                    <button
                      type="button"
                      key={source}
                      className={active ? "keywords-source is-active" : "keywords-source"}
                      onClick={() => onToggleSource(source)}
                      disabled={loading || (active && filters.sources.length === 1)}
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
                value={filters.tags}
                onChange={(event) => onTagChange(event.target.value)}
                placeholder="e.g. boho, nursery, eco"
                disabled={loading}
              />
              <p className="keywords-search-control__hint">Comma separate phrases to influence AI suggestions.</p>
            </div>
          </div>
        </div>
        <div className="keywords-search-form__actions">
          <button type="submit" disabled={loading || !query.trim()}>
            {loading ? "Searching…" : "Search"}
          </button>
          <button type="button" onClick={onRefresh} disabled={loading || !canRefresh}>
            Replay last search
          </button>
        </div>
      </form>
      <div className="keywords-active-filters" aria-live="polite">
        {chips.length ? (
          <FilterChipList chips={chips} disabled={loading} />
        ) : (
          <p className="keywords-active-filters__hint">All approved sources and markets are currently in scope.</p>
        )}
      </div>
    </section>
  );
}

type KeywordResultsTableProps = {
  results: KeywordResult[];
  loading: boolean;
  query: string;
  filteredOutCount: number;
  sourceLineageLabel: string;
  dataLineage: { freshest: string };
  onWatchlist: (keyword: KeywordResult) => void;
  onOptimize: (keyword: KeywordResult) => void;
  topOpportunity: KeywordResult | null;
};

function KeywordResultsTable({
  results,
  loading,
  query,
  filteredOutCount,
  sourceLineageLabel,
  dataLineage,
  onWatchlist,
  onOptimize,
  topOpportunity,
}: KeywordResultsTableProps): JSX.Element {
  const opportunityTotal = loading ? "…" : results.length;

  return (
    <section className="keywords-opportunities-card surface-card" aria-live="polite">
      <header className="keywords-opportunities__header">
        <div>
          <h2>Keyword opportunities</h2>
          <p className="keywords-opportunities__subtitle">
            {query ? `Insights for “${query}”` : "Run a search to populate opportunities."}
          </p>
        </div>
        <div className="keywords-opportunities__actions">
          <button type="button" disabled={!results.length || loading}>
            Export CSV
          </button>
          <button type="button" disabled={!results.length || loading}>
            Add to watchlist
          </button>
        </div>
      </header>

      <div className="keywords-opportunities__stats" role="list">
        <div role="listitem">
          <span className="keywords-opportunities__label">Visible keywords</span>
          <span className="keywords-opportunities__value">{opportunityTotal}</span>
        </div>
        <div role="listitem">
          <span className="keywords-opportunities__label">Signals</span>
          <span className="keywords-opportunities__value">{sourceLineageLabel}</span>
        </div>
        <div role="listitem">
          <span className="keywords-opportunities__label">Freshest sync</span>
          <span className="keywords-opportunities__value">{dataLineage.freshest}</span>
        </div>
        {filteredOutCount > 0 ? (
          <div role="listitem" className="keywords-opportunities__note">
            {filteredOutCount} results hidden by tag or source filters
          </div>
        ) : null}
      </div>

      {topOpportunity ? (
        <aside className="keywords-opportunities__highlight" role="note">
          <h3>Priority opportunity</h3>
          <p>
            <strong>{topOpportunity.term}</strong> is showing the strongest combined momentum across the active signals.
          </p>
          <p className="keywords-opportunities__highlight-meta">
            {SOURCE_DETAILS[topOpportunity.source]?.title ?? topOpportunity.source} · {" "}
            {topOpportunity.freshness_ts ? new Date(topOpportunity.freshness_ts).toLocaleString() : "Not yet synced"}
          </p>
        </aside>
      ) : null}

      <div className="keywords-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Keyword</th>
              <th scope="col">Demand index</th>
              <th scope="col">Competition</th>
              <th scope="col">Trend momentum</th>
              <th scope="col">Source</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="keywords-empty">
                  Searching for opportunities…
                </td>
              </tr>
            ) : null}
            {!loading && results.length
              ? results.map((keyword) => {
                  const category = keyword.extras?.["category"];
                  const opportunityScore =
                    typeof keyword.ai_opportunity_score === "number"
                      ? `${(keyword.ai_opportunity_score * 100).toFixed(0)}%`
                      : "—";
                  const trendMomentum =
                    typeof keyword.trend_momentum === "number"
                      ? `${(keyword.trend_momentum * 100).toFixed(0)}%`
                      : "—";
                  const competition =
                    typeof keyword.compositeScore === "number"
                      ? `${(keyword.compositeScore * 100).toFixed(0)}%`
                      : "—";
                  const keywordTags = (keyword.extras?.["tags"] as string[] | undefined) ?? [];

                  return (
                    <tr key={`${keyword.term}-${keyword.source}`}>
                      <th scope="row">
                        <div className="keyword-term">
                          <span className="keyword-term__title">{keyword.term}</span>
                          {category ? <span className="keyword-term__meta">{String(category)}</span> : null}
                          {keywordTags.length ? (
                            <ul className="keyword-term__tags" aria-label="Associated tags">
                              {keywordTags.map((tag) => (
                                <li key={tag}>
                                  <span>{tag}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </th>
                      <td>{opportunityScore}</td>
                      <td>{competition}</td>
                      <td>{trendMomentum}</td>
                      <td>
                        <span className="keyword-source">
                          {SOURCE_DETAILS[keyword.source]?.title ?? keyword.source}
                        </span>
                      </td>
                      <td className="keyword-actions">
                        <button className="keyword-watch" onClick={() => onWatchlist(keyword)}>
                          Add to watchlist
                        </button>
                        <button className="keyword-optimize" onClick={() => onOptimize(keyword)}>
                          Optimize tags
                        </button>
                      </td>
                    </tr>
                  );
                })
              : null}
            {!loading && !results.length ? (
              <tr>
                <td colSpan={6} className="keywords-empty">
                  <h3>No keyword insights yet</h3>
                  <p>Adjust your filters or run a new search to populate the opportunity table.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type KeywordInsightsPanelProps = {
  insights: SearchResponse["insights"] | null;
  complianceNotes: string;
  dataLineage: { sources: string[]; freshest: string; recordCount: number };
  sparklinePoints: Array<{ value: number; label: string; timestamp: string | null }>;
  tagTokens: string[];
};

function KeywordInsightsPanel({
  insights,
  complianceNotes,
  dataLineage,
  sparklinePoints,
  tagTokens,
}: KeywordInsightsPanelProps): JSX.Element {
  return (
    <div className="keywords-overview">
      <section className="keywords-highlight surface-card">
        <header className="keywords-highlight__header">
          <p className="keywords-highlight__eyebrow">Helpful highlights</p>
          <h3>What the signals are saying</h3>
        </header>
        <p className="keywords-highlight__summary">
          {insights?.summary ?? "Run a search to unlock AI-assisted guidance around the strongest keyword opportunities."}
        </p>
        <div className="keywords-highlight__meta">
          <span>
            Last updated: {insights?.generatedAt ? new Date(insights.generatedAt).toLocaleString() : "Not yet generated"}
          </span>
          {insights?.model ? <span>Model: {insights.model}</span> : null}
        </div>
        <KeywordSparkline points={sparklinePoints} />
      </section>

      <div className="keywords-overview-grid">
        <section className="keywords-overview-card surface-card">
          <h3>Signal lineage</h3>
          <p className="keywords-overview-card__description">{complianceNotes}</p>
          <dl className="keyword-data-info">
            <div>
              <dt>Sources</dt>
              <dd>{dataLineage.sources.join(", ")}</dd>
            </div>
            <div>
              <dt>Freshest sync</dt>
              <dd>{dataLineage.freshest}</dd>
            </div>
            <div>
              <dt>Records in view</dt>
              <dd>{dataLineage.recordCount}</dd>
            </div>
          </dl>
        </section>

        <section className="keywords-overview-card surface-card">
          <h3>Momentum playbook</h3>
          <ul className="keywords-playbook">
            <li>Export top movers and sync them to the Market Twin for visibility simulations.</li>
            <li>Use the watchlist action to trigger alerts without leaving this page.</li>
            <li>Refine the Tag focus to shape AI suggestions for merchandising.</li>
          </ul>
          {tagTokens.length ? (
            <div className="keywords-tag-focus" aria-label="Tag focus">
              <span>Tag emphasis</span>
              <ul>
                {tagTokens.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

type TagOptimizerModalProps = {
  open: boolean;
  keyword: KeywordResult | null;
  loading: boolean;
  error: string | null;
  result: TagOptimizerResult | null;
  onClose: () => void;
};

function TagOptimizerModal({ open, keyword, loading, error, result, onClose }: TagOptimizerModalProps): JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header>
          <h2>Tag Optimizer</h2>
          <button type="button" className="modal-close" aria-label="Close optimizer" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body">
          {keyword ? (
            <p className="modal-subtitle">
              Keyword context: <strong>{keyword.term}</strong> ({keyword.market})
            </p>
          ) : null}
          {loading ? <p>Generating AI suggestions…</p> : null}
          {error ? <p className="modal-error">{error}</p> : null}
          {result ? (
            <div className="optimizer-result">
              <h3>
                Suggested Tags <span>({result.model})</span>
              </h3>
              <ul>
                {result.tags.map((tag) => (
                  <li key={tag}>
                    <code>{tag}</code>
                  </li>
                ))}
              </ul>
              <p className="optimizer-reasoning">{result.reasoning}</p>
              <p className="optimizer-confidence">Confidence: {(result.confidence * 100).toFixed(0)}%</p>
            </div>
          ) : null}
        </div>
        <footer className="modal-footer">
          <button type="button" className="keyword-watch" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function KeywordsPage(): JSX.Element {
  const [filters, setFilters] = useState<FiltersState>({
    sources: [...INITIAL_FILTERS.sources],
    market: INITIAL_FILTERS.market,
    tags: INITIAL_FILTERS.tags,
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [insights, setInsights] = useState<SearchResponse["insights"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [responseSources, setResponseSources] = useState<string[]>([...INITIAL_FILTERS.sources]);

  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<TagOptimizerResult | null>(null);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordResult | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "opportunities">("opportunities");

  const { push } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const availableSources = useMemo(() => Object.keys(SOURCE_DETAILS), []);

  const toggleSource = useCallback(
    (source: string) => {
      setFilters((current) => {
        const normalized = source.toLowerCase();
        if (current.sources.includes(normalized)) {
          if (current.sources.length === 1) {
            return current;
          }
          return {
            ...current,
            sources: current.sources.filter((item) => item !== normalized),
          };
        }
        return {
          ...current,
          sources: Array.from(new Set([...current.sources, normalized])),
        };
      });
    },
    [],
  );

  const clearAllFilters = useCallback(() => {
    setFilters({
      sources: [...availableSources],
      market: INITIAL_FILTERS.market,
      tags: INITIAL_FILTERS.tags,
    });
  }, [availableSources]);

  useEffect(() => {
    setFilters((current) => {
      const normalized = current.sources.filter((item) => availableSources.includes(item));
      if (normalized.length === current.sources.length && normalized.length > 0) {
        return current;
      }
      return { ...current, sources: normalized.length ? normalized : [...availableSources] };
    });
  }, [availableSources]);

  const performSearch = useCallback(
    async (term: string) => {
      const normalizedTerm = term.trim();
      if (!normalizedTerm) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/keywords/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: normalizedTerm,
            market: filters.market,
            limit: 25,
            plan: DEFAULT_PLAN,
            sources: filters.sources,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Keyword search failed (${response.status})`);
        }

        const payload = (await response.json()) as SearchResponse;
        setResults(payload.results ?? []);
        setInsights(payload.insights ?? null);
        setLastQuery(payload.query ?? normalizedTerm);
        setResponseSources(payload.sources ?? filters.sources);
      } catch (err) {
        console.error("Failed to execute keyword search", err);
        setError(err instanceof Error ? err.message : "Unexpected error occurred");
      } finally {
        setLoading(false);
      }
    },
    [filters.market, filters.sources],
  );

  const handleWatchlist = useCallback(
    async (keyword: KeywordResult) => {
      if (!userId) {
        push({
          title: "Sign in required",
          description: "You must be signed in to save watchlist items.",
          tone: "error",
        });
        return;
      }
      try {
        const response = await fetch("/api/watchlists/add", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({ keywordId: keyword.id, watchlistName: "Lexy Tracking" }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Unable to add keyword (${response.status})`);
        }
        push({
          title: "Added to watchlist",
          description: `"${keyword.term}" is now monitored.`,
          tone: "success",
        });
      } catch (err) {
        console.error("Failed to add keyword to watchlist", err);
        push({
          title: "Watchlist error",
          description: err instanceof Error ? err.message : "Unexpected error",
          tone: "error",
        });
      }
    },
    [push, userId],
  );

  const handleOptimize = useCallback(
    async (keyword: KeywordResult) => {
      setSelectedKeyword(keyword);
      setOptimizerOpen(true);
      setOptimizerLoading(true);
      setOptimizerResult(null);
      setOptimizerError(null);
      if (!userId) {
        setOptimizerLoading(false);
        setOptimizerError("Sign in to request AI tag suggestions.");
        return;
      }
      try {
        const response = await fetch("/api/ai/tag-optimizer", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({
            keywordId: keyword.id,
            listingTitle: keyword.term,
            market: keyword.market,
            currentTags: keyword.extras?.["tags"] as string[] | undefined,
            goals: ["visibility", "conversion"],
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Optimizer request failed (${response.status})`);
        }

        const payload = (await response.json()) as TagOptimizerResult;
        setOptimizerResult(payload);
      } catch (err) {
        console.error("Failed to optimize tags", err);
        setOptimizerError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setOptimizerLoading(false);
      }
    },
    [userId],
  );

  const complianceNotes = useMemo(() => {
    if (!results.length) {
      return "Connect an approved source and run a search to unlock lineage details.";
    }

    const uniqueSources = (
      responseSources.length ? responseSources : Array.from(new Set(results.map((item) => item.source)))
    ).join(", ");
    const freshest = results[0]?.freshness_ts ? new Date(results[0]?.freshness_ts).toLocaleString() : "Not yet synced";

    return `Sources: ${uniqueSources || "synthetic"}. Freshness: ${freshest}.`;
  }, [responseSources, results]);

  const dataLineage = useMemo(() => {
    const freshest = results.reduce<string | null>((latest, record) => {
      if (!record.freshness_ts) {
        return latest;
      }
      const timestamp = record.freshness_ts;
      if (!latest) {
        return timestamp;
      }
      return new Date(timestamp).getTime() > new Date(latest).getTime() ? timestamp : latest;
    }, null);

    return {
      sources: responseSources.length ? responseSources : ["synthetic"],
      freshest: freshest ? new Date(freshest).toLocaleString() : "Not yet synced",
      recordCount: results.length,
    };
  }, [responseSources, results]);

  const tagTokens = useMemo(() => parseTagTokens(filters.tags), [filters.tags]);

  const visibleResults = useMemo(() => {
    if (!tagTokens.length) {
      return results;
    }
    return results.filter((keyword) => {
      const keywordTags = ((keyword.extras?.["tags"] as string[] | undefined) ?? []).map((tag) => tag.toLowerCase());
      const normalizedTerm = keyword.term.toLowerCase();
      return tagTokens.some((token) =>
        normalizedTerm.includes(token) || keywordTags.some((tag) => tag.includes(token)),
      );
    });
  }, [results, tagTokens]);

  const filteredOutCount = results.length - visibleResults.length;

  const sparklinePoints = useMemo(() => {
    const deriveValue = (keyword: KeywordResult): number | null => {
      if (typeof keyword.compositeScore === "number" && Number.isFinite(keyword.compositeScore)) {
        return Math.max(0, Math.min(1, keyword.compositeScore));
      }
      if (typeof keyword.trend_momentum === "number" && Number.isFinite(keyword.trend_momentum)) {
        return Math.max(0, Math.min(1, keyword.trend_momentum));
      }
      if (typeof keyword.ai_opportunity_score === "number" && Number.isFinite(keyword.ai_opportunity_score)) {
        return Math.max(0, Math.min(1, keyword.ai_opportunity_score));
      }
      if (Number.isFinite(keyword.similarity)) {
        return Math.max(0, Math.min(1, keyword.similarity));
      }
      return null;
    };

    const parseTimestamp = (value: string | null | undefined): number => {
      if (!value) {
        return 0;
      }
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    return visibleResults
      .map((keyword) => {
        const value = deriveValue(keyword);
        if (value == null) {
          return null;
        }
        return {
          value,
          label: keyword.term,
          timestamp: keyword.freshness_ts ?? null,
          order: parseTimestamp(keyword.freshness_ts),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.order - b.order)
      .map(({ value, label, timestamp }) => ({ value, label, timestamp }))
      .slice(-24);
  }, [visibleResults]);

  const lastSuccessfulQuery = lastQuery;
  const canRefresh = Boolean(lastSuccessfulQuery);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setActiveTab("opportunities");
      void performSearch(query);
    },
    [performSearch, query, setActiveTab],
  );

  const handleRefresh = useCallback(() => {
    if (!lastSuccessfulQuery) {
      return;
    }
    setActiveTab("opportunities");
    void performSearch(lastSuccessfulQuery);
  }, [lastSuccessfulQuery, performSearch, setActiveTab]);

  const sourceLineageLabel = useMemo(() => {
    if (!responseSources.length) {
      return "synthetic";
    }
    const mapped = responseSources.map((source) => SOURCE_DETAILS[source]?.title ?? source).join(", ");
    return mapped || "synthetic";
  }, [responseSources]);

  const topOpportunity = useMemo(() => {
    if (!visibleResults.length) {
      return null;
    }
    const ranked = [...visibleResults].sort((a, b) => deriveOpportunityScore(b) - deriveOpportunityScore(a));
    return ranked[0];
  }, [visibleResults]);

  const resetMarket = useCallback(() => {
    setFilters((current) => ({ ...current, market: INITIAL_FILTERS.market }));
  }, []);

  const resetSources = useCallback(() => {
    setFilters((current) => ({ ...current, sources: [...availableSources] }));
  }, [availableSources]);

  const removeTag = useCallback((tag: string) => {
    setFilters((current) => {
      const tokens = parseTagTokens(current.tags).filter((token) => token !== tag.toLowerCase());
      return { ...current, tags: tokens.join(tokens.length ? ", " : "") };
    });
  }, []);

  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];

    if (filters.market !== INITIAL_FILTERS.market) {
      const label = `Market: ${MARKET_OPTIONS.find((option) => option.value === filters.market)?.label ?? filters.market}`;
      chips.push({ id: "market", label, onRemove: resetMarket });
    }

    if (filters.sources.length !== availableSources.length) {
      chips.push({
        id: "sources",
        label: `Sources: ${filters.sources.map((source) => SOURCE_DETAILS[source]?.title ?? source).join(", ")}`,
        onRemove: resetSources,
      });
    }

    parseTagTokens(filters.tags).forEach((token) => {
      chips.push({ id: `tag-${token}`, label: `Tag: ${token}`, onRemove: () => removeTag(token) });
    });

    return chips;
  }, [filters, availableSources, resetMarket, resetSources, removeTag]);

  const overviewPanelId = "keywords-panel-overview";
  const opportunitiesPanelId = "keywords-panel-opportunities";
  const tabs: Array<{ id: "overview" | "opportunities"; label: string; description?: string }> = [
    { id: "overview", label: "Overview", description: "Narrative & lineage" },
    {
      id: "opportunities",
      label: "Opportunities",
      description: loading ? "Updating…" : `${visibleResults.length} keywords`,
    },
  ];

  return (
    <div className="keywords-page">
      <section className="keywords-hero-card surface-card" aria-labelledby="keywords-title">
        <div className="keywords-hero-card__intro">
          <p className="keywords-hero__eyebrow">Keyword workspace</p>
          <h1 id="keywords-title">Keyword Intelligence</h1>
          <p>
            Monitor live demand, uncover AI-suggested opportunities, and orchestrate watchlists without leaving a single, analyst-ready canvas.
          </p>
        </div>
        <div className="keywords-hero-card__stats">
          <div>
            <span>Latest search</span>
            <strong>{lastSuccessfulQuery ? `“${lastSuccessfulQuery}”` : "Awaiting search"}</strong>
          </div>
          <div>
            <span>Signals in scope</span>
            <strong>{sourceLineageLabel}</strong>
          </div>
          <div>
            <span>Records in view</span>
            <strong>{loading ? "…" : visibleResults.length}</strong>
          </div>
        </div>
      </section>

      <KeywordSearchPanel
        query={query}
        onQueryChange={setQuery}
        loading={loading}
        onSubmit={handleSubmit}
        onRefresh={handleRefresh}
        canRefresh={canRefresh}
        filters={filters}
        availableSources={availableSources}
        chips={filterChips}
        onToggleSource={toggleSource}
        onMarketChange={(value) => setFilters((current) => ({ ...current, market: value }))}
        onTagChange={(value) => setFilters((current) => ({ ...current, tags: value }))}
        onClearAll={clearAllFilters}
      />

      {error ? <div className="keyword-error" role="alert">{error}</div> : null}

      <nav className="keywords-tabs" role="tablist" aria-label="Keyword insights">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const controls = tab.id === "overview" ? overviewPanelId : opportunitiesPanelId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`keywords-tab-${tab.id}`}
              aria-controls={controls}
              aria-selected={isActive}
              className={isActive ? "keywords-tab is-active" : "keywords-tab"}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.description ? <span className="keywords-tab__description">{tab.description}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="keywords-tabpanels">
        <div
          id={overviewPanelId}
          role="tabpanel"
          aria-labelledby="keywords-tab-overview"
          hidden={activeTab !== "overview"}
        >
          <KeywordInsightsPanel
            insights={insights}
            complianceNotes={complianceNotes}
            dataLineage={dataLineage}
            sparklinePoints={sparklinePoints}
            tagTokens={tagTokens}
          />
        </div>
        <div
          id={opportunitiesPanelId}
          role="tabpanel"
          aria-labelledby="keywords-tab-opportunities"
          hidden={activeTab !== "opportunities"}
        >
          <KeywordResultsTable
            results={visibleResults}
            loading={loading}
            query={lastSuccessfulQuery || query}
            filteredOutCount={filteredOutCount}
            sourceLineageLabel={sourceLineageLabel}
            dataLineage={dataLineage}
            onWatchlist={handleWatchlist}
            onOptimize={handleOptimize}
            topOpportunity={topOpportunity}
          />
        </div>
      </div>

      <TagOptimizerModal
        open={optimizerOpen}
        keyword={selectedKeyword}
        loading={optimizerLoading}
        error={optimizerError}
        result={optimizerResult}
        onClose={() => setOptimizerOpen(false)}
      />
    </div>
  );
}
