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

export default function KeywordsPage(): JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [insights, setInsights] = useState<SearchResponse["insights"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [sourceFilters, setSourceFilters] = useState<string[]>(["synthetic", "amazon"]);
  const [responseSources, setResponseSources] = useState<string[]>(["synthetic", "amazon"]);

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
            market: "us",
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
    [sourceFilters],
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
          description: `\"${keyword.term}\" is now monitored.`,
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
      return "We refresh your results whenever new data arrives and keep track of where each idea began.";
    }

    const uniqueSources = (responseSources.length ? responseSources : Array.from(new Set(results.map((item) => item.source)))).join(", ");
    const freshest = results[0]?.freshness_ts
      ? new Date(results[0]?.freshness_ts).toLocaleString()
      : "Not yet synced";

    return `Source(s): ${uniqueSources || "synthetic"}. Freshness: ${freshest}. Retrieval method adjusts per provider to maintain accuracy.`;
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
      <section className="keywords-hero" aria-labelledby="keywords-title">
        <p className="keywords-hero__eyebrow">Search intelligence</p>
        <div className="keywords-hero__content">
          <div>
            <h1 id="keywords-title">Keyword Intelligence</h1>
            <p>
              Explore synthetic demand signals and surface high-propensity commerce keywords. Results are ranked via
              embeddings with deterministic fallbacks when AI is offline.
            </p>
          </div>
          <dl className="keywords-hero__meta">
            <div>
              <dt>Active data sources</dt>
              <dd>{sourceLineageLabel}</dd>
            </div>
            <div>
              <dt>Ideas in view</dt>
              <dd aria-live="polite">{results.length}</dd>
            </div>
            <div>
              <dt>Latest sync</dt>
              <dd>{dataLineage.freshest}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="keywords-controls" aria-label="Keyword search controls">
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

        <fieldset className="keywords-sources" disabled={loading}>
          <legend>Data sources</legend>
          <p className="keywords-sources__hint">
            Blend synthetic exploration with marketplace signals. Disable a source to focus insights on a single channel.
          </p>
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
        </fieldset>
      </section>

      {error ? (
        <div className="keyword-error">{error}</div>
      ) : (
        <div className="keywords-layout">
          <section className="keywords-results" aria-live="polite">
            <header className="keywords-results__header">
              <div>
                <h2>Results overview</h2>
                <p className="keyword-meta">Query: {lastSuccessfulQuery || "—"}</p>
              </div>
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
            </header>
            <div className="keywords-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Term &amp; context</th>
                    <th scope="col">Relevance</th>
                    <th scope="col">Opportunity signals</th>
                    <th scope="col">Freshness</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((keyword) => {
                    const category = keyword.extras?.["category"];
                    const opportunityScore =
                      typeof keyword.ai_opportunity_score === "number"
                        ? keyword.ai_opportunity_score.toFixed(2)
                        : "—";
                    const trendMomentum =
                      typeof keyword.trend_momentum === "number"
                        ? keyword.trend_momentum.toFixed(2)
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
                              <dt>Composite</dt>
                              <dd>
                                {typeof keyword.compositeScore === "number"
                                  ? `${(keyword.compositeScore * 100).toFixed(1)}%`
                                  : "—"}
                              </dd>
                            </div>
                          </dl>
                        </td>
                        <td>
                          <dl className="keyword-score-list">
                            <div>
                              <dt>AI opportunity</dt>
                              <dd>{opportunityScore}</dd>
                            </div>
                            <div>
                              <dt>Trend momentum</dt>
                              <dd>{trendMomentum}</dd>
                            </div>
                          </dl>
                        </td>
                        <td>
                          <span className="keyword-freshness">
                            {keyword.freshness_ts
                              ? new Date(keyword.freshness_ts).toLocaleString()
                              : "Pending sync"}
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
                      <td colSpan={5} className="keywords-empty">
                        <h3>No keyword insights yet</h3>
                        <p>Start by running a search above to populate the opportunity map.</p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="keywords-panel" aria-label="Keyword insights and guidance">
            <section>
              <h3>Helpful Highlights</h3>
              <p className="keyword-summary">
                {insights?.summary ?? "Run a search to see helpful keyword tips."}
              </p>
              <div className="keyword-insight-meta">
                <span>
                  Last updated:
                  {" "}
                  {insights?.generatedAt
                    ? new Date(insights.generatedAt).toLocaleString()
                    : "Not available yet"}
                </span>
              </div>
              <KeywordSparkline points={sparklinePoints} />
            </section>

            <section>
              <h3>Update Notes</h3>
              <p>{complianceNotes}</p>
            </section>

            <section>
              <h3>Data Info</h3>
              <dl className="keyword-data-info">
                <div>
                  <dt>Sources</dt>
                  <dd>{dataLineage.sources.join(", ")}</dd>
                </div>
                <div>
                  <dt>Freshest Sync</dt>
                  <dd>{dataLineage.freshest}</dd>
                </div>
                <div>
                  <dt>Records</dt>
                  <dd>{dataLineage.recordCount}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h3>Quick Tips</h3>
              <ul>
                <li>Check your keyword list often so it stays up to date.</li>
                <li>Refresh your sources regularly to keep marketplace news fresh.</li>
                <li>Add important terms to your watchlist to keep an eye on them.</li>
              </ul>
            </section>
          </aside>
        </div>
      )}

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
            <footer>
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
