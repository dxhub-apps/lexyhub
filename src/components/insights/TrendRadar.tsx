"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

const MAX_MOMENTUM = 1.5;
const RING_VALUES = [0.3, 0.6, 0.9, 1.2, MAX_MOMENTUM];

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
      const momentum = Math.min(MAX_MOMENTUM, Math.max(0, entry.momentum));
      const value = (momentum / MAX_MOMENTUM) * radius;
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
  const [radius, setRadius] = useState(110);
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch("/api/insights/trends")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Trend radar request failed (${response.status})`);
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

  useEffect(() => {
    const element = chartRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry?.contentRect?.width ?? 0;
      if (!width) {
        return;
      }

      const nextRadius = Math.max(72, Math.min(120, width / 2 - 24));
      setRadius((previous) => {
        if (Math.abs(previous - nextRadius) < 1) {
          return previous;
        }
        return nextRadius;
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const entries = useMemo(() => data?.summary ?? [], [data]);
  const polygonPoints = useMemo(() => buildPolygonPoints(entries, radius), [entries, radius]);
  const axes = useMemo(() => {
    const step = entries.length ? (Math.PI * 2) / entries.length : 0;
    return entries.map((entry, index) => {
      const { x, y } = polarToCartesian(step * index - Math.PI / 2, radius);
      return { ...entry, x, y };
    });
  }, [entries, radius]);

  const viewBoxSize = radius * 2 + 60;

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

      <div className="trend-radar__chart" ref={chartRef}>
        <svg
          viewBox={`-${viewBoxSize / 2} -${viewBoxSize / 2} ${viewBoxSize} ${viewBoxSize}`}
          role="img"
          aria-label="Trend radar visualization"
          preserveAspectRatio="xMidYMid meet"
        >
          {RING_VALUES.map((step) => (
            <circle key={step} cx={0} cy={0} r={(radius / MAX_MOMENTUM) * step} className="trend-radar__grid" />
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
