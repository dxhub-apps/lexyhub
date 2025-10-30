"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
};

type SearchResponse = {
  query: string;
  market: string;
  source: string;
  results: KeywordResult[];
  insights?: {
    summary: string;
    generatedAt: string;
    model: string;
  };
};

export default function KeywordsPage(): JSX.Element {
  const [query, setQuery] = useState("handmade jewelry");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [insights, setInsights] = useState<SearchResponse["insights"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [bootstrapped, setBootstrapped] = useState(false);

  const performSearch = useCallback(
    async (term: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/keywords/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: term, market: "us", limit: 25 }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Keyword search failed (${response.status})`);
        }

        const payload = (await response.json()) as SearchResponse;
        setResults(payload.results ?? []);
        setInsights(payload.insights ?? null);
        setLastQuery(payload.query ?? term);
      } catch (err) {
        console.error("Failed to execute keyword search", err);
        setError(err instanceof Error ? err.message : "Unexpected error occurred");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (bootstrapped) {
      return;
    }
    setBootstrapped(true);
    void performSearch(query);
  }, [bootstrapped, performSearch, query]);

  const complianceNotes = useMemo(() => {
    if (!results.length) {
      return "Results refresh automatically every import cycle. Synthetic provenance is enforced for all records.";
    }

    const uniqueSources = Array.from(new Set(results.map((item) => item.source))).join(", ");
    const freshest = results[0]?.freshness_ts
      ? new Date(results[0]?.freshness_ts).toLocaleString()
      : "Not yet synced";

    return `Source(s): ${uniqueSources || "synthetic"}. Freshness: ${freshest}. Method: synthetic-ai.`;
  }, [results]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void performSearch(query);
    },
    [performSearch, query],
  );

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
          <button type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
      </div>

      {error ? (
        <div className="keyword-error">{error}</div>
      ) : (
        <div className="keywords-grid">
          <div className="keywords-table">
            <header>
              <div>
                <h2>Results</h2>
                <span className="keyword-meta">Query: {lastQuery || query}</span>
              </div>
              <div className="keyword-meta">{results.length} matches</div>
            </header>
            <table>
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Source</th>
                  <th>Similarity</th>
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
                    <td>{keyword.source}</td>
                    <td>{(keyword.similarity * 100).toFixed(1)}%</td>
                    <td>{keyword.ai_opportunity_score?.toFixed(2) ?? "—"}</td>
                    <td>{keyword.trend_momentum?.toFixed(2) ?? "—"}</td>
                    <td>
                      {keyword.freshness_ts
                        ? new Date(keyword.freshness_ts).toLocaleDateString()
                        : "Pending"}
                    </td>
                    <td>
                      <button className="keyword-watch">Add to Watchlist</button>
                    </td>
                  </tr>
                ))}
                {!results.length && !loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                      No keywords yet. Import synthetic data to populate the graph.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <aside className="keywords-panel">
            <section>
              <h3>AI Insights</h3>
              <p className="keyword-summary">
                {insights?.summary ??
                  "Embeddings pipeline ready. Trigger a search to generate AI-backed keyword guidance."}
              </p>
              <div className="keyword-insight-meta">
                <span>Model: {insights?.model ?? "deterministic-fallback"}</span>
                <span>
                  Generated: {insights?.generatedAt ? new Date(insights.generatedAt).toLocaleString() : "—"}
                </span>
              </div>
              <div className="sparkline-placeholder" aria-hidden>
                <span>trend_series sparkline</span>
              </div>
            </section>

            <section>
              <h3>Compliance & Provenance</h3>
              <p>{complianceNotes}</p>
            </section>

            <section>
              <h3>Workflow Shortcuts</h3>
              <ul>
                <li>Review embeddings freshness in the hourly cron report.</li>
                <li>Use the importer CLI to load new taxonomy seeds.</li>
                <li>Promote high-similarity terms to watchlists for monitoring.</li>
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
