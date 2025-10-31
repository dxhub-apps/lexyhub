"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

export default function KeywordsPage(): JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [insights, setInsights] = useState<SearchResponse["insights"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [sourceFilters, setSourceFilters] = useState<string[]>(["synthetic", "amazon"]);
  const [responseSources, setResponseSources] = useState<string[]>(["synthetic", "amazon"]);
  const [marketFilter, setMarketFilter] = useState<string>("us");
  const [tierFilter, setTierFilter] = useState<PlanTier>("growth");
  const [tagFilter, setTagFilter] = useState<string>("");

  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<TagOptimizerResult | null>(null);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordResult | null>(null);

  const { push } = useToast();

  const availableSources = useMemo(() => Object.keys(SOURCE_DETAILS), []);

  const toggleSource = useCallback(
    (source: string) => {
      setSourceFilters((current) => {
        const normalized = source.toLowerCase();
        if (current.includes(normalized)) {
          if (current.length === 1) {
            return current;
          }
          return current.filter((item) => item !== normalized);
        }
        return Array.from(new Set([...current, normalized]));
      });
    },
    [],
  );

  const clearAllFilters = useCallback(() => {
    setSourceFilters(availableSources);
    setMarketFilter("us");
    setTierFilter("growth");
    setTagFilter("");
  }, [availableSources]);

  useEffect(() => {
    setSourceFilters((current) => {
      const normalized = current.filter((item) => availableSources.includes(item));
      if (normalized.length === 0) {
        return availableSources;
      }
      return normalized;
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
            market: marketFilter,
            limit: 25,
            plan: "growth",
            sources: sourceFilters,
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
        setResponseSources(payload.sources ?? sourceFilters);
      } catch (err) {
        console.error("Failed to execute keyword search", err);
        setError(err instanceof Error ? err.message : "Unexpected error occurred");
      } finally {
        setLoading(false);
      }
    },
    [marketFilter, sourceFilters],
  );

  const handleWatchlist = useCallback(
    async (keyword: KeywordResult) => {
      try {
        const response = await fetch("/api/watchlists/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    [push],
  );

  const handleOptimize = useCallback(
    async (keyword: KeywordResult) => {
      setSelectedKeyword(keyword);
      setOptimizerOpen(true);
      setOptimizerLoading(true);
      setOptimizerResult(null);
      setOptimizerError(null);
      try {
        const response = await fetch("/api/ai/tag-optimizer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    [],
  );

  const complianceNotes = useMemo(() => {
    if (!results.length) {
      return "Connect an approved source and run a search to unlock lineage details.";
    }

    const uniqueSources = (responseSources.length ? responseSources : Array.from(new Set(results.map((item) => item.source)))).join(", ");
    const freshest = results[0]?.freshness_ts
      ? new Date(results[0]?.freshness_ts).toLocaleString()
      : "Not yet synced";

    return `Sources: ${uniqueSources || "synthetic"}. Freshness: ${freshest}. Tier focus: ${tierFilter.toUpperCase()}.`;
  }, [responseSources, results, tierFilter]);

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

    return results
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
  }, [results]);

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
    if (!responseSources.length) {
      return "synthetic";
    }
    const mapped = responseSources
      .map((source) => SOURCE_DETAILS[source]?.title ?? source)
      .join(", ");
    return mapped || "synthetic";
  }, [responseSources]);

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
            <dd>{tierFilter === "growth" ? "Growth Scale Plan" : tierFilter}</dd>
          </div>
          <div>
            <dt>Market focus</dt>
            <dd>{MARKET_OPTIONS.find((option) => option.value === marketFilter)?.label ?? "United States"}</dd>
          </div>
          <div>
            <dt>Active sources</dt>
            <dd>{sourceLineageLabel}</dd>
          </div>
        </dl>
      </section>

      <div className="keywords-layout">
        <aside className="keywords-filters">
          <div className="filter-card" aria-labelledby="filter-sources">
            <header>
              <h2 id="filter-sources">Sources</h2>
              <button type="button" onClick={clearAllFilters} disabled={loading}>
                Clear all
              </button>
            </header>
            <p>Select the marketplaces and synthetic feeds that fuel opportunity scoring.</p>
            <div className="keywords-sources__options">
              {availableSources.map((source) => {
                const active = sourceFilters.includes(source);
                const detail = SOURCE_DETAILS[source];
                return (
                  <label key={source} className={active ? "source-option is-active" : "source-option"}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleSource(source)}
                      disabled={loading || (active && sourceFilters.length === 1)}
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
            <select
              value={marketFilter}
              onChange={(event) => setMarketFilter(event.target.value)}
              disabled={loading}
            >
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
              value={tierFilter}
              onChange={(event) => setTierFilter(event.target.value as PlanTier)}
              disabled={loading}
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
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="e.g. boho, nursery, eco"
              disabled={loading}
            />
          </div>
        </aside>

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
                    return (
                      <tr key={`${keyword.term}-${keyword.market}`}>
                        <td>
                          <div className="keyword-term">
                            <strong>{keyword.term}</strong>
                            <ul className="keyword-term__meta">
                              <li>{keyword.market.toUpperCase()}</li>
                              <li>{SOURCE_DETAILS[keyword.source]?.title ?? keyword.source}</li>
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
                            {SOURCE_DETAILS[keyword.source]?.title ?? keyword.source}
                          </span>
                        </td>
                        <td className="keyword-actions">
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
              {selectedKeyword ? (
                <p className="modal-subtitle">
                  Keyword context: <strong>{selectedKeyword.term}</strong> ({selectedKeyword.market})
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
    </div>
  );
}
