"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

type TrendRadarTimeframeOption = {
  value: string;
  label: string;
};

type TrendRadarProps = {
  title?: string;
  description?: string;
  timeframe?: string;
  timeframeOptions?: TrendRadarTimeframeOption[];
  onTimeframeChange?: (value: string) => void;
  titleId?: string;
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

export function TrendRadar({
  title = "Trend Radar",
  description = "Visualize cross-network velocity. Momentum is normalized across Google, Pinterest, and Reddit signals with expected growth projections.",
  timeframe,
  timeframeOptions,
  onTimeframeChange,
  titleId,
}: TrendRadarProps): JSX.Element {
  const [data, setData] = useState<TrendRadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(110);
  const chartRef = useRef<HTMLDivElement | null>(null);

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

  const hasTimeframeControls =
    Array.isArray(timeframeOptions) && timeframeOptions.length > 0 && typeof onTimeframeChange === "function";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasTimeframeControls && (
            <div className="flex gap-1 rounded-md border p-1">
              {timeframeOptions!.map((option) => {
                const isActive = option.value === timeframe;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onTimeframeChange!(option.value)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
          )}
          <Badge variant="secondary">{loading ? "Refreshing" : data?.source ?? "unknown"}</Badge>
          {data?.generatedAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div ref={chartRef} className="flex items-center justify-center rounded-md border bg-card p-6">
          <svg
            viewBox={`-${viewBoxSize / 2} -${viewBoxSize / 2} ${viewBoxSize} ${viewBoxSize}`}
            role="img"
            aria-label="Trend radar visualization"
            preserveAspectRatio="xMidYMid meet"
            className="w-full max-w-md"
          >
            {RING_VALUES.map((step) => (
              <circle
                key={step}
                cx={0}
                cy={0}
                r={(radius / MAX_MOMENTUM) * step}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted-foreground/30"
              />
            ))}
            {axes.map((axis) => (
              <g key={axis.term}>
                <line
                  x1={0}
                  y1={0}
                  x2={axis.x}
                  y2={axis.y}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-muted-foreground/50"
                />
                <text
                  x={axis.x * 1.15}
                  y={axis.y * 1.15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-xs font-medium"
                >
                  {axis.term}
                </text>
              </g>
            ))}
            {polygonPoints && (
              <polygon
                points={polygonPoints}
                fill="currentColor"
                fillOpacity="0.2"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary"
              />
            )}
          </svg>
        </div>

        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.term} className="rounded-md border p-3 space-y-2">
              <h3 className="font-semibold">{entry.term}</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Momentum</div>
                  <div className="font-medium">{entry.momentum.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Expected 30d</div>
                  <div className="font-medium">{entry.expectedGrowth30d.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Sources</div>
                  <div className="font-medium text-xs">{formatSources(entry.sources)}</div>
                </div>
              </div>
            </div>
          ))}
          {!loading && entries.length === 0 && (
            <div className="rounded-md border p-8 text-center">
              <p className="text-sm text-muted-foreground">No trend data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrendRadar;
