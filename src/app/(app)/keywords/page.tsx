"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import KeywordSparkline from "@/components/keywords/KeywordSparkline";
import { useToast } from "@/components/ui/ToastProvider";
import { useAnalytics } from "@/lib/analytics/use-analytics";

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

export default function KeywordsPage(): JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [insights, setInsights] = useState<SearchResponse["insights"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [planTier, setPlanTier] = useState<PlanTier>("growth");
  const [responsePlan, setResponsePlan] = useState<PlanTier>("growth");
  const [sourceFilters, setSourceFilters] = useState<string[]>(["synthetic", "amazon"]);
  const [responseSources, setResponseSources] = useState<string[]>(["synthetic", "amazon"]);

  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<TagOptimizerResult | null>(null);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordResult | null>(null);

  const { push } = useToast();
  const analytics = useAnalytics();

  const availableSources = useMemo(() => {
    if (planTier === "free") {
      return ["synthetic"];
    }
    return ["synthetic", "amazon"];
  }, [planTier]);
  const availableSources = useMemo(() => ["synthetic", "amazon"], []);

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
            plan: planTier,
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
        setLastQuery(payload.query ?? term);
        setResponsePlan(payload.plan ?? planTier);
        setLastQuery(payload.query ?? normalizedTerm);
        setResponseSources(payload.sources ?? sourceFilters);
        analytics.capture("keywords.search.completed", {
          term,
          responsePlan: payload.plan ?? planTier,
          resultCount: payload.results?.length ?? 0,
          sources: payload.sources ?? sourceFilters,
        });
      } catch (err) {
        console.error("Failed to execute keyword search", err);
        setError(err instanceof Error ? err.message : "Unexpected error occurred");
        analytics.capture("keywords.search.failed", {
          term,
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLoading(false);
      }
    },
    [analytics, planTier, sourceFilters],
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
        analytics.capture("watchlists.item.added", {
          keywordId: keyword.id,
          keywordTerm: keyword.term,
          market: keyword.market,
        });
      } catch (err) {
        console.error("Failed to add keyword to watchlist", err);
        push({
          title: "Watchlist error",
          description: err instanceof Error ? err.message : "Unexpected error",
          tone: "error",
        });
        analytics.capture("watchlists.item.add.failed", {
          keywordId: keyword.id,
          keywordTerm: keyword.term,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [analytics, push],
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
        analytics.capture("keywords.optimizer.completed", {
          keywordId: keyword.id,
          keywordTerm: keyword.term,
          confidence: payload.confidence,
          model: payload.model,
        });
      } catch (err) {
        console.error("Failed to optimize tags", err);
        setOptimizerError(err instanceof Error ? err.message : "Unexpected error");
        analytics.capture("keywords.optimizer.failed", {
          keywordId: keyword.id,
          keywordTerm: keyword.term,
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setOptimizerLoading(false);
      }
    },
    [analytics],
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

  return (
    <div className="keywords-page">
      <div className="keywords-header">
        <div>
          <h1>Keyword Intelligence</h1>
          <p>
            Explore synthetic demand signals and surface high-propensity commerce keywords. Results are
            ranked via embeddings with deterministic fallbacks when AI is offline.
          </p>
        </div>
      </div>

      <div className="keywords-filters">
        <form className="keywords-search" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="keyword-query">
            Search keywords
          </label>
          <input
            id="keyword-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. boho nursery decor"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !query.trim()}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
      </div>

      <div className="keywords-filters">
        <div>
          <label htmlFor="plan-tier">Plan tier</label>
          <select
            id="plan-tier"
            value={planTier}
            onChange={(event) => setPlanTier(event.target.value as PlanTier)}
            disabled={loading}
          >
            <option value="free">Free</option>
            <option value="growth">Growth</option>
            <option value="scale">Scale</option>
          </select>
        </div>
        <div className="keywords-source-toggles">
          <span>Sources</span>
          {availableSources.map((source) => {
            const active = sourceFilters.includes(source);
            return (
              <button
                key={source}
                type="button"
                className={active ? "source-toggle active" : "source-toggle"}
                onClick={() => toggleSource(source)}
                disabled={loading || (active && sourceFilters.length === 1)}
              >
                {source}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="keywords-refresh"
          onClick={() => void performSearch(query.trim() || lastSuccessfulQuery)}
          disabled={loading || (!query.trim() && !canRefresh)}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="keyword-error">{error}</div>
      ) : (
        <div className="keywords-grid">
          <div className="keywords-table">
            <header>
              <div>
                <h2>Results</h2>
                <span className="keyword-meta">Query: {lastSuccessfulQuery || "—"}</span>
              </div>
              <div className="keyword-meta">{results.length} matches</div>
            </header>
            <table>
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Source</th>
                  <th>Similarity</th>
                  <th>Composite</th>
                  <th>AI Opportunity</th>
                  <th>Trend Momentum</th>
                  <th>Freshness</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((keyword) => (
                  <tr key={`${keyword.term}-${keyword.market}`}>
                    <td>
                      <strong>{keyword.term}</strong>
                      {keyword.extras && keyword.extras["category"] ? (
                        <span className="keyword-pill">{String(keyword.extras["category"])} </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`keyword-source-badge source-${keyword.source}`}>
                        {keyword.source}
                      </span>
                    </td>
                    <td>{(keyword.similarity * 100).toFixed(1)}%</td>
                    <td>
                      {typeof keyword.compositeScore === "number"
                        ? `${(keyword.compositeScore * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td>{keyword.ai_opportunity_score?.toFixed(2) ?? "—"}</td>
                    <td>{keyword.trend_momentum?.toFixed(2) ?? "—"}</td>
                    <td>
                      {keyword.freshness_ts
                        ? new Date(keyword.freshness_ts).toLocaleDateString()
                        : "Pending"}
                    </td>
                    <td className="keyword-actions">
                      <button className="keyword-watch" onClick={() => handleWatchlist(keyword)}>
                        Add to Watchlist
                      </button>
                      <button className="keyword-optimize" onClick={() => void handleOptimize(keyword)}>
                        Optimize Tags
                      </button>
                    </td>
                  </tr>
                ))}
                {!results.length && !loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                      No keywords yet. Run a search to populate this table.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <aside className="keywords-panel">
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