"use client";

import { useEffect, useMemo, useState } from "react";

type TrendRadarEntry = {
  term: string;
  momentum: number;
  expectedGrowth30d: number;
  sources: string[];
  series?: Array<{ recordedOn: string; trendScore: number; velocity: number; expectedGrowth30d: number; source: string }>;
};

type TrendRadarResponse = {
  summary: TrendRadarEntry[];
  generatedAt: string;
  source: string;
};

function polarToCartesian(angle: number, radius: number): { x: number; y: number } {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function buildPolygonPoints(entries: TrendRadarEntry[], radius: number): string {
  if (!entries.length) {
    return "";
  }
  const step = (Math.PI * 2) / entries.length;
  return entries
    .map((entry, index) => {
      const momentum = Math.min(1.5, Math.max(0, entry.momentum));
      const value = (momentum / 1.5) * radius;
      const { x, y } = polarToCartesian(step * index - Math.PI / 2, value);
      return `${x},${y}`;
    })
    .join(" ");
}

function formatSources(sources: string[]): string {
  return sources.map((source) => source.replace("_", " ")).join(", ");
}

export function TrendRadar(): JSX.Element {
  const [data, setData] = useState<TrendRadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch("/api/insights/trends")
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error ?? "")
              : "";
          throw new Error(message || `Trend radar request failed (${response.status})`);
        }
        return response.json();
      })
      .then((payload: TrendRadarResponse) => {
        if (mounted) {
          setData(payload);
        }
      })
      .catch((cause) => {
        console.warn("Trend radar fetch failed", cause);
        if (mounted) {
          setError(cause instanceof Error ? cause.message : "Unable to load trend radar");
          setData(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const entries = useMemo(() => data?.summary ?? [], [data]);
  const polygonPoints = useMemo(() => buildPolygonPoints(entries, 120), [entries]);
  const axes = useMemo(() => {
    const step = entries.length ? (Math.PI * 2) / entries.length : 0;
    return entries.map((entry, index) => {
      const { x, y } = polarToCartesian(step * index - Math.PI / 2, 120);
      return { ...entry, x, y };
    });
  }, [entries]);

  return (
    <div className="trend-radar">
      <header className="trend-radar__header">
        <div>
          <h2>Trend Radar</h2>
          <p className="insights-muted">
            Visualize cross-network velocity. Momentum is normalized across Google, Pinterest, and Reddit signals with expected
            growth projections.
          </p>
        </div>
        <div className="trend-radar__meta">
          <span className="trend-radar__badge">{loading ? "Refreshing" : data?.source ?? "unknown"}</span>
          {data?.generatedAt ? <span>{new Date(data.generatedAt).toLocaleTimeString()}</span> : null}
        </div>
      </header>

      {error ? <div className="trend-radar__error">{error}</div> : null}

      <div className="trend-radar__chart">
        <svg viewBox="-150 -150 300 300" role="img" aria-label="Trend radar visualization">
          {[0.3, 0.6, 0.9, 1.2].map((radius) => (
            <circle key={radius} cx={0} cy={0} r={radius * 100} className="trend-radar__grid" />
          ))}
          {axes.map((axis) => (
            <g key={axis.term}>
              <line x1={0} y1={0} x2={axis.x} y2={axis.y} className="trend-radar__axis" />
              <text x={axis.x * 1.08} y={axis.y * 1.08} className="trend-radar__label">
                {axis.term}
              </text>
            </g>
          ))}
          {polygonPoints ? <polygon points={polygonPoints} className="trend-radar__polygon" /> : null}
        </svg>
        <aside className="trend-radar__details">
          {entries.map((entry) => (
            <article key={entry.term}>
              <h3>{entry.term}</h3>
              <dl>
                <div>
                  <dt>Momentum</dt>
                  <dd>{entry.momentum.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Expected 30d</dt>
                  <dd>{entry.expectedGrowth30d.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Sources</dt>
                  <dd>{formatSources(entry.sources)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </aside>
      </div>
    </div>
  );
}

export default TrendRadar;
