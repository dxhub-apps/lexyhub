"use client";

import { useMemo } from "react";
import { Box, Grid, Typography, useTheme } from "@mui/material";

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
  const theme = useTheme();

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
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No keyword momentum yet. Run a search to populate the trend sparkline.
        </Typography>
      </Box>
    );
  }

  const primary = theme.palette.primary.main;
  const areaFill = theme.palette.mode === "light" ? `${primary}26` : `${primary}33`;
  const lineColor = theme.palette.mode === "light" ? theme.palette.primary.dark : theme.palette.primary.light;
  const pointColor = theme.palette.mode === "light" ? theme.palette.primary.main : theme.palette.primary.light;

  return (
    <Box>
      <Box
        component="svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        sx={{ width: "100%", height: 160 }}
        role="img"
        aria-label="Keyword composite momentum over recent imports"
      >
        <defs>
          <linearGradient id="keyword-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={areaFill} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {svgContent.area ? <path d={svgContent.area} fill="url(#keyword-sparkline-fill)" /> : null}
        {svgContent.path ? <path d={svgContent.path} fill="none" stroke={lineColor} strokeWidth={2} /> : null}
        {svgContent.coordinates.map((coord) => (
          <circle key={`${coord.x}-${coord.y}`} cx={coord.x} cy={coord.y} r={2.8} fill={pointColor} />
        ))}
      </Box>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={6} md={3}>
          <Typography variant="caption" color="text.secondary">
            Latest
          </Typography>
          <Typography variant="subtitle2">
            {toPercentage(metrics.latest.value)}
          </Typography>
          {formatTimestamp(metrics.latest.timestamp) ? (
            <Typography variant="caption" color="text.secondary">
              {formatTimestamp(metrics.latest.timestamp)}
            </Typography>
          ) : null}
        </Grid>
        <Grid item xs={6} md={3}>
          <Typography variant="caption" color="text.secondary">
            Peak
          </Typography>
          <Typography variant="subtitle2">{toPercentage(metrics.max)}</Typography>
          {formatTimestamp(metrics.peak?.timestamp) ? (
            <Typography variant="caption" color="text.secondary">
              {formatTimestamp(metrics.peak?.timestamp)}
            </Typography>
          ) : null}
        </Grid>
        <Grid item xs={6} md={3}>
          <Typography variant="caption" color="text.secondary">
            Average
          </Typography>
          <Typography variant="subtitle2">{toPercentage(metrics.avg)}</Typography>
        </Grid>
        <Grid item xs={6} md={3}>
          <Typography variant="caption" color="text.secondary">
            Lowest
          </Typography>
          <Typography variant="subtitle2">{toPercentage(metrics.min)}</Typography>
          {formatTimestamp(metrics.trough?.timestamp) ? (
            <Typography variant="caption" color="text.secondary">
              {formatTimestamp(metrics.trough?.timestamp)}
            </Typography>
          ) : null}
        </Grid>
      </Grid>
    </Box>
  );
}

export default KeywordSparkline;
