"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";

import KeywordSparkline from "@/components/keywords/KeywordSparkline";
import { useToast } from "@/components/ui/ToastProvider";
import type { KeywordDetailPayload } from "@/types/keyword-serp";

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
  source_method?: string | null;
  source_reason?: string | null;
  extras?: Record<string, unknown> | null;
  compositeScore?: number;
  source_label?: string | null;
  provenance?: string | null;
  provenance_label?: string | null;
  dataset?: string | null;
  sample_count?: number | null;
  serp_total_results?: number | null;
  serp_captured_at?: string | null;
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
  tier: PlanTier;
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
  etsy: {
    title: "Etsy Marketplace",
    description: "Seller-side inventory trends and performance telemetry.",
  },
  etsy_serp: {
    title: "Etsy SERP Samples",
    description: "Organic SERP captures with live listing examples and metrics.",
  },
};

const INITIAL_SOURCE_KEYS = Object.keys(SOURCE_DETAILS);

function formatSourceLabel(source: string): string {
  const detail = SOURCE_DETAILS[source];
  if (detail) {
    return detail.title;
  }
  return source
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString();
}

const MARKET_OPTIONS = [
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "de", label: "Germany" },
];

const DEFAULT_SOURCES = Object.keys(SOURCE_DETAILS);

const INITIAL_FILTERS: FiltersState = {
  sources: DEFAULT_SOURCES,
  market: "us",
  tier: "growth",
  tags: "",
};

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

type KeywordFiltersProps = {
  filters: FiltersState;
  chips: FilterChip[];
  availableSources: string[];
  disabled: boolean;
  onClearAll: () => void;
  onToggleSource: (source: string) => void;
  onMarketChange: (value: string) => void;
  onTierChange: (tier: PlanTier) => void;
  onTagChange: (value: string) => void;
};

function KeywordFilters({
  filters,
  chips,
  availableSources,
  disabled,
  onClearAll,
  onToggleSource,
  onMarketChange,
  onTierChange,
  onTagChange,
}: KeywordFiltersProps): JSX.Element {
  return (
    <aside className="keywords-filters">
      <div className="filter-card" aria-labelledby="filter-summary">
        <header>
          <h2 id="filter-summary">Active filters</h2>
          <button type="button" onClick={onClearAll} disabled={disabled || chips.length === 0}>
            Reset
          </button>
        </header>
        {chips.length ? (
          <FilterChipList chips={chips} disabled={disabled} />
        ) : (
          <p className="filter-summary__hint">Showing insights from every connected source.</p>
        )}
      </div>

      <div className="filter-card" aria-labelledby="filter-sources">
        <header>
          <h2 id="filter-sources">Sources</h2>
        </header>
        <p>Select the marketplaces and synthetic feeds that fuel opportunity scoring.</p>
        <div className="keywords-sources__options">
          {availableSources.map((source) => {
            const active = filters.sources.includes(source);
            const detail = SOURCE_DETAILS[source];
            return (
              <label key={source} className={active ? "source-option is-active" : "source-option"}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onToggleSource(source)}
                  disabled={disabled || (active && filters.sources.length === 1)}
                />
                <span className="source-option__content">
                  <span className="source-option__title">{detail?.title ?? source}</span>
                  <span className="source-option__description">{detail?.description ?? ""}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="filter-card" aria-labelledby="filter-market">
        <header>
          <h2 id="filter-market">Market</h2>
        </header>
        <p>Align results with the regional storefront you operate.</p>
        <select value={filters.market} onChange={(event) => onMarketChange(event.target.value)} disabled={disabled}>
          {MARKET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-card" aria-labelledby="filter-tier">
        <header>
          <h2 id="filter-tier">Tier focus</h2>
        </header>
        <p>Preview how opportunities shift across monetisation tiers.</p>
        <select
          value={filters.tier}
          onChange={(event) => onTierChange(event.target.value as PlanTier)}
          disabled={disabled}
        >
          <option value="free">Starter</option>
          <option value="growth">Growth</option>
          <option value="scale">Scale</option>
        </select>
      </div>

      <div className="filter-card" aria-labelledby="filter-tags">
        <header>
          <h2 id="filter-tags">Tag keywords</h2>
        </header>
        <p>Track the thematic focus you want surfaced in AI suggestions.</p>
        <input
          type="text"
          value={filters.tags}
          onChange={(event) => onTagChange(event.target.value)}
          placeholder="e.g. boho, nursery, eco"
          disabled={disabled}
        />
      </div>
    </aside>
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
  return (
    <section className="keywords-results-card surface-card" aria-live="polite">
      <header className="keywords-results__header">
        <div>
          <h2>Keyword opportunities</h2>
          <p className="keyword-meta">Query: {query || "—"}</p>
          {filteredOutCount > 0 ? (
            <p className="keyword-filtered-meta">{filteredOutCount} results hidden by filter preferences</p>
          ) : null}
        </div>
        <div className="keywords-bulk-actions">
          <button type="button" disabled={!results.length || loading}>
            Export CSV
          </button>
          <button type="button" disabled={!results.length || loading}>
            Add to watchlist
          </button>
        </div>
      </header>

      {topOpportunity ? (
        <div className="keywords-results__highlight" role="note">
          <h3>Top opportunity to review</h3>
          <p>
            <strong>{topOpportunity.term}</strong> shows the strongest signal based on current filters.
          </p>
          <p className="keywords-results__highlight-meta">
            Source: {SOURCE_DETAILS[topOpportunity.source]?.title ?? topOpportunity.source} · Freshness: {" "}
            {topOpportunity.freshness_ts ? new Date(topOpportunity.freshness_ts).toLocaleString() : "Not yet synced"}
          </p>
        </div>
      ) : null}

      <dl className="keywords-results__stats">
        <div>
          <dt>Visible matches</dt>
          <dd>{loading ? "…" : results.length}</dd>
        </div>
        <div>
          <dt>Sources</dt>
          <dd>{sourceLineageLabel}</dd>
        </div>
        <div>
          <dt>Freshest sync</dt>
          <dd>{dataLineage.freshest}</dd>
        </div>
      </dl>

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
    <div className="keywords-panel">
      <section>
        <h3>Helpful highlights</h3>
        <p className="keyword-summary">{insights?.summary ?? "Run a search to see helpful keyword tips."}</p>
        <div className="keyword-insight-meta">
          <span>Last updated: {insights?.generatedAt ? new Date(insights.generatedAt).toLocaleString() : "Not available yet"}</span>
          {insights?.model ? <span>Model: {insights.model}</span> : null}
        </div>
        <KeywordSparkline points={sparklinePoints} />
      </section>

      <section>
        <h3>Data lineage</h3>
        <p>{complianceNotes}</p>
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
            <dt>Records</dt>
            <dd>{dataLineage.recordCount}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3>Momentum playbook</h3>
        <ul>
          <li>Export top movers and sync them to the Market Twin for visibility simulations.</li>
          <li>Use the Add to watchlist action to feed alerts without leaving the table.</li>
          <li>Tag filters help you track thematic focus areas for merchandising.</li>
        </ul>
        {tagTokens.length ? (
          <div className="keywords-results__highlight-tags" aria-label="Tag focus">
            <span>Tag focus:</span>
            <ul>
              {tagTokens.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
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
    tier: INITIAL_FILTERS.tier,
    tags: INITIAL_FILTERS.tags,
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [insights, setInsights] = useState<SearchResponse["insights"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [availableSources, setAvailableSources] = useState<string[]>(INITIAL_SOURCE_KEYS);
  const [sourceFilters, setSourceFilters] = useState<string[]>(INITIAL_SOURCE_KEYS);
  const [responseSources, setResponseSources] = useState<string[]>(INITIAL_SOURCE_KEYS);
  const [marketFilter, setMarketFilter] = useState<string>("us");
  const [tierFilter, setTierFilter] = useState<PlanTier>("growth");
  const [tagFilter, setTagFilter] = useState<string>("");

  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<TagOptimizerResult | null>(null);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [optimizerKeyword, setOptimizerKeyword] = useState<KeywordResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailKeyword, setDetailKeyword] = useState<KeywordResult | null>(null);
  const [detailData, setDetailData] = useState<KeywordDetailPayload | null>(null);

  const { push } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;

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
      tier: INITIAL_FILTERS.tier,
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

  useEffect(() => {
    setAvailableSources((current) => {
      const merged = new Set(current);
      responseSources.forEach((source) => {
        if (typeof source === "string" && source.trim()) {
          merged.add(source.trim().toLowerCase());
        }
      });
      results.forEach((keyword) => {
        if (keyword.source) {
          merged.add(keyword.source.toLowerCase());
        }
      });
      return Array.from(merged);
    });
  }, [responseSources, results]);

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
            plan: filters.tier,
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
        const normalizedSources = Array.isArray(payload.sources)
          ? Array.from(
              new Set(
                payload.sources
                  .filter((value): value is string => typeof value === "string" && Boolean(value))
                  .map((value) => value.trim().toLowerCase()),
              ),
            )
          : sourceFilters;
        setResponseSources(normalizedSources);
        setAvailableSources((current) => {
          const discovered = new Set(current);
          const merge = (values: unknown) => {
            if (!Array.isArray(values)) {
              return;
            }
            for (const value of values) {
              if (typeof value === "string" && value.trim()) {
                discovered.add(value.trim().toLowerCase());
              }
            }
          };
          merge(payload.sources);
          merge((payload.results ?? []).map((item) => item.source));
          return Array.from(discovered);
        });
      } catch (err) {
        console.error("Failed to execute keyword search", err);
        setError(err instanceof Error ? err.message : "Unexpected error occurred");
      } finally {
        setLoading(false);
      }
    },
    [filters.market, filters.sources, filters.tier],
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
      setOptimizerKeyword(keyword);
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

  const handleViewDetails = useCallback(
    async (keyword: KeywordResult) => {
      if (!keyword.id) {
        setDetailKeyword(keyword);
        setDetailData(null);
        setDetailError("Keyword identifier unavailable; connect a source with lineage to inspect SERPs.");
        setDetailOpen(true);
        setDetailLoading(false);
        return;
      }

      setDetailKeyword(keyword);
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailError(null);
      setDetailData(null);

      try {
        const response = await fetch(`/api/keywords/${encodeURIComponent(keyword.id)}/serp?limit=12`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Unable to load SERP samples (${response.status})`);
        }
        const payload = (await response.json()) as KeywordDetailPayload;
        setDetailData(payload);
      } catch (err) {
        console.error("Failed to load keyword SERP detail", err);
        setDetailError(err instanceof Error ? err.message : "Unexpected error loading keyword detail");
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  const closeDetailModal = useCallback(() => {
    setDetailOpen(false);
    setDetailLoading(false);
    setDetailError(null);
    setDetailKeyword(null);
    setDetailData(null);
  }, []);

  const complianceNotes = useMemo(() => {
    if (!results.length) {
      return "Connect an approved source and run a search to unlock lineage details.";
    }

    const uniqueSources = (
      responseSources.length ? responseSources : Array.from(new Set(results.map((item) => item.source)))
    ).join(", ");
    const freshest = results[0]?.freshness_ts ? new Date(results[0]?.freshness_ts).toLocaleString() : "Not yet synced";

    return `Sources: ${uniqueSources || "synthetic"}. Freshness: ${freshest}. Tier focus: ${filters.tier.toUpperCase()}.`;
  }, [responseSources, results, filters.tier]);

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

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void performSearch(query);
    },
    [performSearch, query],
  );

  const lastSuccessfulQuery = lastQuery;
  const canRefresh = Boolean(lastSuccessfulQuery);

  const sourceLineageLabel = useMemo(() => {
    const lineageSources = responseSources.length
      ? responseSources
      : Array.from(new Set(results.map((item) => item.source)));
    if (!lineageSources.length) {
      return formatSourceLabel("synthetic");
    }
    const mapped = lineageSources
      .map((source) => {
        const normalized = typeof source === "string" ? source.toLowerCase() : "";
        const match = results.find((item) => item.source === source || item.source === normalized);
        return match?.source_label ?? formatSourceLabel(normalized);
      })
      .filter(Boolean)
      .join(", ");
    return mapped || formatSourceLabel("synthetic");
  }, [responseSources, results]);

  const detailSourceLabel = detailKeyword
    ? detailKeyword.source_label ?? formatSourceLabel(detailKeyword.source)
    : null;
  const detailProvenanceLabel = detailKeyword?.provenance_label ?? null;
  const detailMarketLabel = detailKeyword ? detailKeyword.market.toUpperCase() : null;
  const detailCaptureTimestamp = formatTimestamp(detailData?.capturedAt ?? detailKeyword?.serp_captured_at ?? null);
  const detailTotalResults = detailData?.totalResults ?? detailKeyword?.serp_total_results ?? null;

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

  const resetTier = useCallback(() => {
    setFilters((current) => ({ ...current, tier: INITIAL_FILTERS.tier }));
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

    if (filters.tier !== INITIAL_FILTERS.tier) {
      const label = `Tier: ${filters.tier}`;
      chips.push({ id: "tier", label, onRemove: resetTier });
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
  }, [filters, availableSources, resetMarket, resetTier, resetSources, removeTag]);

  return (
    <div className="keywords-page">
      <section className="keywords-hero-card" aria-labelledby="keywords-title">
        <div>
          <p className="keywords-hero__eyebrow">Search intelligence</p>
          <h1 id="keywords-title">Keyword Intelligence</h1>
          <p>
            Monitor live demand, uncover AI-suggested opportunities, and orchestrate watchlists from one analytics-first
            workspace.
          </p>
        </div>
        <dl className="keywords-hero__meta">
          <div>
            <dt>Plan tier</dt>
            <dd>{filters.tier === "growth" ? "Growth Scale Plan" : filters.tier}</dd>
          </div>
          <div>
            <dt>Market focus</dt>
            <dd>{MARKET_OPTIONS.find((option) => option.value === filters.market)?.label ?? "United States"}</dd>
          </div>
          <div>
            <dt>Active sources</dt>
            <dd>{sourceLineageLabel}</dd>
          </div>
        </dl>
      </section>

      <div className="keywords-layout">
        <KeywordFilters
          filters={filters}
          chips={filterChips}
          availableSources={availableSources}
          disabled={loading}
          onClearAll={clearAllFilters}
          onToggleSource={toggleSource}
          onMarketChange={(value) => setFilters((current) => ({ ...current, market: value }))}
          onTierChange={(tier) => setFilters((current) => ({ ...current, tier }))}
          onTagChange={(value) => setFilters((current) => ({ ...current, tags: value }))}
        />

        <div className="keywords-main">
          <section className="keywords-search-card surface-card" aria-label="Keyword search controls">
            <form className="keywords-search-form" onSubmit={handleSubmit}>
              <div className="keywords-search-form__field">
                <label htmlFor="keyword-query">Keyword or product idea</label>
                <div className="keywords-search-form__input">
                  <input
                    id="keyword-query"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search for opportunities, e.g. boho nursery decor"
                    disabled={loading}
                    autoComplete="off"
                    aria-describedby="keyword-hint"
                  />
                </div>
                <p id="keyword-hint" className="keywords-search-form__hint">
                  Press Enter or use the Search button to run analysis.
                </p>
              </div>
              <div className="keywords-search-form__actions">
                <button type="submit" disabled={loading || !query.trim()}>
                  {loading ? "Searching…" : "Search"}
                </button>
                <button
                  type="button"
                  onClick={() => void performSearch(query.trim() || lastSuccessfulQuery)}
                  disabled={loading || (!query.trim() && !canRefresh)}
                >
                  Refresh last search
                </button>
              </div>
            </form>
          </section>

          {error ? <div className="keyword-error">{error}</div> : null}

          <section className="keywords-results-card surface-card" aria-live="polite">
            <header className="keywords-results__header">
              <div>
                <h2>Keyword opportunities</h2>
                <p className="keyword-meta">Query: {lastSuccessfulQuery || "—"}</p>
              </div>
              <div className="keywords-bulk-actions">
                <button type="button" disabled={!results.length}>
                  Export CSV
                </button>
                <button type="button" disabled={!results.length}>
                  Add to watchlist
                </button>
              </div>
            </header>
            <dl className="keywords-results__stats">
              <div>
                <dt>Matches</dt>
                <dd>{results.length}</dd>
              </div>
              <div>
                <dt>Sources</dt>
                <dd>{sourceLineageLabel}</dd>
              </div>
              <div>
                <dt>Freshest sync</dt>
                <dd>{dataLineage.freshest}</dd>
              </div>
            </dl>
            <div className="keywords-source-chips" aria-label="Active data sources">
              {(responseSources.length
                ? responseSources
                : Array.from(new Set(results.map((item) => item.source))))
                .filter((source): source is string => typeof source === "string" && Boolean(source))
                .map((source) => {
                  const normalized = source.toLowerCase();
                  const label =
                    results.find((item) => item.source === source || item.source === normalized)?.source_label ??
                    formatSourceLabel(normalized);
                  return (
                    <span key={normalized} className="keyword-chip">
                      {label}
                    </span>
                  );
                })}
            </div>
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
                  {results.map((keyword) => {
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
                    const sourceLabel = keyword.source_label ?? formatSourceLabel(keyword.source);
                    const provenanceLabel = keyword.provenance_label;
                    const serpRecency = formatTimestamp(keyword.serp_captured_at);
                    const sampleCount = typeof keyword.sample_count === "number" ? keyword.sample_count : null;
                    return (
                      <tr key={`${keyword.term}-${keyword.market}`}>
                        <td>
                          <div className="keyword-term">
                            <strong>{keyword.term}</strong>
                            <ul className="keyword-term__meta">
                              <li>{keyword.market.toUpperCase()}</li>
                              <li>{sourceLabel}</li>
                              {provenanceLabel ? <li>Provenance: {provenanceLabel}</li> : null}
                              {sampleCount ? <li>SERP samples: {sampleCount}</li> : null}
                              {serpRecency ? <li>Last SERP capture: {serpRecency}</li> : null}
                              {category ? <li>Category: {String(category)}</li> : null}
                              {tagFilter ? <li>Tag focus: {tagFilter}</li> : null}
                            </ul>
                          </div>
                        </td>
                        <td>
                          <dl className="keyword-score-list">
                            <div>
                              <dt>Similarity</dt>
                              <dd>{(keyword.similarity * 100).toFixed(1)}%</dd>
                            </div>
                            <div>
                              <dt>AI signal</dt>
                              <dd>{opportunityScore}</dd>
                            </div>
                          </dl>
                        </td>
                        <td>
                          <span className="keyword-freshness">{competition}</span>
                        </td>
                        <td>
                          <span className="keyword-freshness">{trendMomentum}</span>
                        </td>
                        <td>
                          <span className="keyword-freshness">
                            {sourceLabel}
                          </span>
                        </td>
                        <td className="keyword-actions">
                          <button className="keyword-detail" onClick={() => void handleViewDetails(keyword)}>
                            View details
                          </button>
                          <button className="keyword-watch" onClick={() => handleWatchlist(keyword)}>
                            Add to watchlist
                          </button>
                          <button className="keyword-optimize" onClick={() => void handleOptimize(keyword)}>
                            Optimize tags
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!results.length && !loading ? (
                    <tr>
                      <td colSpan={6} className="keywords-empty">
                        <h3>No keyword insights yet</h3>
                        <p>Run a search to populate the opportunity table.</p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <div className="keywords-panel">
            <section>
              <h3>Helpful highlights</h3>
              <p className="keyword-summary">
                {insights?.summary ?? "Run a search to see helpful keyword tips."}
              </p>
              <div className="keyword-insight-meta">
                <span>
                  Last updated: {insights?.generatedAt ? new Date(insights.generatedAt).toLocaleString() : "Not available yet"}
                </span>
              </div>
              <KeywordSparkline points={sparklinePoints} />
            </section>

            <section>
              <h3>Data lineage</h3>
              <p>{complianceNotes}</p>
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
                  <dt>Records</dt>
                  <dd>{dataLineage.recordCount}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h3>Momentum playbook</h3>
              <ul>
                <li>Export top movers and sync them to the Market Twin for visibility simulations.</li>
                <li>Use the Add to watchlist action to feed alerts without leaving the table.</li>
                <li>Tag filters help you track thematic focus areas for merchandising.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>

      {detailOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal keyword-detail-modal">
            <header>
              <h2>Keyword provenance</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Close keyword detail"
                onClick={closeDetailModal}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              {detailKeyword ? (
                <p className="modal-subtitle">
                  <strong>{detailKeyword.term}</strong>
                  {detailMarketLabel ? ` (${detailMarketLabel})` : ""}
                  {detailSourceLabel ? ` · ${detailSourceLabel}` : ""}
                  {detailProvenanceLabel ? ` • ${detailProvenanceLabel}` : ""}
                </p>
              ) : null}
              {detailError ? <p className="modal-error">{detailError}</p> : null}
              {detailLoading ? <p>Loading SERP samples…</p> : null}
              {!detailLoading && !detailError && detailData ? (
                <div className="keyword-detail-content">
                  <div className="keyword-detail-summary">
                    <p>
                      Captured {detailData.samples.length} listing{detailData.samples.length === 1 ? "" : "s"}
                      {detailCaptureTimestamp ? ` on ${detailCaptureTimestamp}` : ""}.
                    </p>
                    {detailTotalResults != null ? (
                      <p>Total Etsy results at capture: {detailTotalResults.toLocaleString()}</p>
                    ) : null}
                  </div>
                  {detailData.summary?.tags?.length ? (
                    <div className="keyword-detail-tags">
                      <h3>Observed tags</h3>
                      <ul>
                        {detailData.summary.tags.map((tag) => (
                          <li key={tag}>{tag}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <ul className="keyword-detail-samples">
                    {detailData.samples.map((sample) => (
                      <li key={sample.id}>
                        <div className="keyword-detail-sample-header">
                          <span className="keyword-detail-rank">#{sample.position ?? "—"}</span>
                          <span className="keyword-detail-title">{sample.title ?? "Untitled listing"}</span>
                        </div>
                        <div className="keyword-detail-meta">
                          {sample.url ? (
                            <a href={sample.url} target="_blank" rel="noreferrer">
                              View listing
                            </a>
                          ) : (
                            <span>No direct listing link</span>
                          )}
                          {sample.tags.length ? (
                            <ul className="keyword-detail-taglist">
                              {sample.tags.map((tag) => (
                                <li key={tag}>{tag}</li>
                              ))}
                            </ul>
                          ) : null}
                          {formatTimestamp(sample.capturedAt) ? (
                            <span className="keyword-detail-captured">Captured {formatTimestamp(sample.capturedAt)}</span>
                          ) : null}
                          {sample.derivedMetrics && Object.keys(sample.derivedMetrics).length ? (
                            <dl className="keyword-detail-metrics">
                              {Object.entries(sample.derivedMetrics).map(([metric, value]) => {
                                let renderedValue: string;
                                if (typeof value === "number") {
                                  renderedValue = value.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                  });
                                } else if (typeof value === "string") {
                                  renderedValue = value;
                                } else if (value == null) {
                                  renderedValue = "—";
                                } else {
                                  renderedValue = JSON.stringify(value);
                                }
                                return (
                                  <div key={metric}>
                                    <dt>{formatSourceLabel(metric)}</dt>
                                    <dd>{renderedValue}</dd>
                                  </div>
                                );
                              })}
                            </dl>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!detailLoading && !detailError && !detailData ? <p>No SERP samples available yet.</p> : null}
            </div>
            <footer className="modal-footer">
              <button type="button" className="keyword-watch" onClick={closeDetailModal}>
                Close
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {optimizerOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <header>
              <h2>Tag Optimizer</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Close optimizer"
                onClick={() => setOptimizerOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              {optimizerKeyword ? (
                <p className="modal-subtitle">
                  Keyword context: <strong>{optimizerKeyword.term}</strong> ({optimizerKeyword.market})
                </p>
              ) : null}
              {optimizerLoading ? <p>Generating AI suggestions…</p> : null}
              {optimizerError ? <p className="modal-error">{optimizerError}</p> : null}
              {optimizerResult ? (
                <div className="optimizer-result">
                  <h3>
                    Suggested Tags <span>({optimizerResult.model})</span>
                  </h3>
                  <ul>
                    {optimizerResult.tags.map((tag) => (
                      <li key={tag}>
                        <code>{tag}</code>
                      </li>
                    ))}
                  </ul>
                  <p className="optimizer-reasoning">{optimizerResult.reasoning}</p>
                  <p className="optimizer-confidence">
                    Confidence: {(optimizerResult.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              ) : null}
            </div>
            <footer className="modal-footer">
              <button type="button" className="keyword-watch" onClick={() => setOptimizerOpen(false)}>
                Close
              </button>
            </footer>
          </div>
        </div>
      ) : null}
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

          <KeywordInsightsPanel
            insights={insights}
            complianceNotes={complianceNotes}
            dataLineage={dataLineage}
            sparklinePoints={sparklinePoints}
            tagTokens={tagTokens}
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
