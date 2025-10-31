"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

const MAX_MOMENTUM = 1.5;
const RING_VALUES = [0.3, 0.6, 0.9, 1.2, MAX_MOMENTUM];

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

  return (
    <Card>
      <CardHeader
        title="Trend Radar"
        subheader="Visualize cross-network velocity and growth projections."
        action={
          <Chip
            label={loading ? "Refreshing" : data?.source ?? "unknown"}
            color="primary"
            variant="outlined"
            size="small"
          />
        }
      />
      <CardContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Grid container spacing={3} alignItems="stretch">
          <Grid item xs={12} lg={7}>
            <Box
              ref={chartRef}
              sx={{
                position: "relative",
                minHeight: 320,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: (theme) =>
                  theme.palette.mode === "light" ? "rgba(30, 64, 175, 0.04)" : "rgba(148, 163, 184, 0.08)",
                borderRadius: 3,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                p: 3,
              }}
            >
              <svg
                viewBox={`-${viewBoxSize / 2} -${viewBoxSize / 2} ${viewBoxSize} ${viewBoxSize}`}
                role="img"
                aria-label="Trend radar visualization"
                preserveAspectRatio="xMidYMid meet"
                style={{ width: "100%", height: "100%" }}
              >
                {RING_VALUES.map((step) => (
                  <circle
                    key={step}
                    cx={0}
                    cy={0}
                    r={(radius / MAX_MOMENTUM) * step}
                    stroke="currentColor"
                    strokeWidth={0.4}
                    fill="none"
                    opacity={0.18}
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
                      strokeWidth={0.6}
                      opacity={0.25}
                    />
                    <text
                      x={axis.x * 1.08}
                      y={axis.y * 1.08}
                      textAnchor="middle"
                      style={{ fontSize: 10, fill: "currentColor", opacity: 0.72 }}
                    >
                      {axis.term}
                    </text>
                  </g>
                ))}
                {polygonPoints ? (
                  <polygon
                    points={polygonPoints}
                    fill="rgba(59,130,246,0.22)"
                    stroke="rgba(59,130,246,0.9)"
                    strokeWidth={1.6}
                  />
                ) : null}
              </svg>
            </Box>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Stack spacing={2} sx={{ height: "100%" }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Last updated
                </Typography>
                <Typography variant="body1">
                  {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "—"}
                </Typography>
              </Box>
              <Stack spacing={1.5} sx={{ flexGrow: 1, overflowY: "auto", pr: 1 }}>
                {entries.map((entry) => (
                  <Box
                    key={entry.term}
                    sx={{
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      borderRadius: 2,
                      p: 2,
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {entry.term}
                    </Typography>
                    <Grid container spacing={1} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Momentum
                        </Typography>
                        <Typography variant="body2">{entry.momentum.toFixed(2)}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Expected 30d
                        </Typography>
                        <Typography variant="body2">{entry.expectedGrowth30d.toFixed(2)}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">
                          Sources
                        </Typography>
                        <Typography variant="body2">{formatSources(entry.sources)}</Typography>
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default TrendRadar;
