"use client";

import { useMemo } from "react";

type KeywordSparklinePoint = {
  value: number;
  label?: string;
  timestamp?: string | null;
};

type KeywordSparklineProps = {
  points: KeywordSparklinePoint[];
  width?: number;
  height?: number;
};

function toPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTimestamp(timestamp?: string | null): string | null {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

export function KeywordSparkline({ points, width = 240, height = 80 }: KeywordSparklineProps): JSX.Element {
  const metrics = useMemo(() => {
    if (!points.length) {
      return null;
    }

    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const latest = points[points.length - 1];
    const peakIndex = values.indexOf(max);
    const troughIndex = values.indexOf(min);

    return {
      min,
      max,
      avg,
      latest,
      peak: points[peakIndex],
      trough: points[troughIndex],
    } as const;
  }, [points]);

  const svgContent = useMemo(() => {
    if (!points.length) {
      return { path: "", area: "", coordinates: [] as Array<{ x: number; y: number }> };
    }

    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = 6;
    const range = Math.max(max - min, 0.0001);
    const step = points.length > 1 ? width / (points.length - 1) : 0;

    const coordinates = points.map((point, index) => {
      const x = points.length > 1 ? step * index : width / 2;
      const normalized = (point.value - min) / range;
      const y = height - padding - normalized * (height - padding * 2);
      return { x, y };
    });

    const path = coordinates
      .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`)
      .join(" ");

    const area = coordinates.length
      ? [
          `M${coordinates[0].x.toFixed(2)},${height - padding}`,
          ...coordinates.map((coord) => `L${coord.x.toFixed(2)},${coord.y.toFixed(2)}`),
          `L${coordinates[coordinates.length - 1].x.toFixed(2)},${height - padding}`,
          "Z",
        ].join(" ")
      : "";

    return { path, area, coordinates };
  }, [points, height, width]);

  if (!metrics) {
    return (
      <div className="keyword-sparkline keyword-sparkline--empty">
        <p>No keyword momentum yet. Run a search to populate the trend sparkline.</p>
      </div>
    );
  }

  return (
    <div className="keyword-sparkline" role="figure" aria-label="Keyword composite momentum over recent imports">
      <svg
        className="keyword-sparkline__svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="keyword-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.02)" />
          </linearGradient>
        </defs>
        {svgContent.area ? <path d={svgContent.area} fill="url(#keyword-sparkline-fill)" /> : null}
        {svgContent.path ? <path d={svgContent.path} fill="none" stroke="rgba(96,165,250,0.9)" strokeWidth={2} /> : null}
        {svgContent.coordinates.map((coord, index) => (
          <circle key={`${coord.x}-${coord.y}`} cx={coord.x} cy={coord.y} r={2.5} fill="rgba(191,219,254,0.95)" />
        ))}
      </svg>

      <dl className="keyword-sparkline__stats">
        <div>
          <dt>Latest</dt>
          <dd>
            {toPercentage(metrics.latest.value)}
            {formatTimestamp(metrics.latest.timestamp) ? (
              <span>{formatTimestamp(metrics.latest.timestamp)}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Peak</dt>
          <dd>
            {toPercentage(metrics.max)}
            {formatTimestamp(metrics.peak?.timestamp) ? <span>{formatTimestamp(metrics.peak?.timestamp)}</span> : null}
          </dd>
        </div>
        <div>
          <dt>Average</dt>
          <dd>{toPercentage(metrics.avg)}</dd>
        </div>
        <div>
          <dt>Lowest</dt>
          <dd>
            {toPercentage(metrics.min)}
            {formatTimestamp(metrics.trough?.timestamp) ? (
              <span>{formatTimestamp(metrics.trough?.timestamp)}</span>
            ) : null}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default KeywordSparkline;
