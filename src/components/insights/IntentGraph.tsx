"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Slider,
  Stack,
  Typography,
} from "@mui/material";

type IntentGraphNode = {
  id: string;
  term: string;
  intent: string;
  persona: string;
  purchaseStage: string;
  score: number;
  x: number;
  y: number;
  color: string;
};

type IntentGraphEdge = {
  source: string;
  target: string;
  reason: string;
  weight?: number;
};

type IntentGraphLegend = {
  intent: string;
  color: string;
};

type IntentGraphResponse = {
  nodes: IntentGraphNode[];
  edges: IntentGraphEdge[];
  legend: IntentGraphLegend[];
  generatedAt: string;
  source: string;
};

export function IntentGraph(): JSX.Element {
  const [data, setData] = useState<IntentGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const zoomControlId = useId();

  useEffect(() => {
    let mounted = true;
    fetch("/api/insights/intent-graph")
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error ?? "")
              : "";
          throw new Error(message || `Intent graph request failed (${response.status})`);
        }
        return response.json();
      })
      .then((payload: IntentGraphResponse) => {
        if (mounted) {
          setData(payload);
        }
      })
      .catch((cause) => {
        console.warn("Intent graph fetch failed", cause);
        if (mounted) {
          setError(cause instanceof Error ? cause.message : "Unable to load intent graph");
          setData(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const nodes = useMemo(() => data?.nodes ?? [], [data]);
  const edges = useMemo(() => data?.edges ?? [], [data]);
  const legend = useMemo(() => data?.legend ?? [], [data]);

  useEffect(() => {
    setZoom(1);
  }, [data?.generatedAt, data?.source]);

  const layout = useMemo(() => {
    if (!nodes.length) {
      return {
        width: 600,
        height: 600,
        centerX: 300,
        centerY: 300,
        nodes: [] as Array<IntentGraphNode & { px: number; py: number }>,
        edges: [] as Array<IntentGraphEdge & { x1: number; y1: number; x2: number; y2: number }>,
      };
    }

    const minX = Math.min(...nodes.map((node) => node.x));
    const maxX = Math.max(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxY = Math.max(...nodes.map((node) => node.y));

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const padding = 80;
    const baseScale = 420;

    const innerWidthBase = Math.max(rangeX * baseScale, 320);
    const innerHeightBase = Math.max(rangeY * baseScale, 320);
    const width = innerWidthBase + padding * 2;
    const height = innerHeightBase + padding * 2;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    const projectX = (value: number) => ((value - minX) / rangeX) * innerWidth + padding;
    const projectY = (value: number) => ((value - minY) / rangeY) * innerHeight + padding;

    const layoutNodes = nodes.map((node) => ({
      ...node,
      px: projectX(node.x),
      py: projectY(node.y),
    }));

    const layoutNodeLookup = new Map(layoutNodes.map((node) => [node.id, node]));

    const layoutEdges = edges
      .map((edge) => {
        const source = layoutNodeLookup.get(edge.source);
        const target = layoutNodeLookup.get(edge.target);
        if (!source || !target) {
          return null;
        }
        return {
          ...edge,
          x1: source.px,
          y1: source.py,
          x2: target.px,
          y2: target.py,
        };
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

    return {
      width,
      height,
      centerX: width / 2,
      centerY: height / 2,
      nodes: layoutNodes,
      edges: layoutEdges,
    };
  }, [nodes, edges]);

  const viewBox = useMemo(() => {
    const viewWidth = layout.width / zoom;
    const viewHeight = layout.height / zoom;
    const x = layout.centerX - viewWidth / 2;
    const y = layout.centerY - viewHeight / 2;
    return `${x} ${y} ${viewWidth} ${viewHeight}`;
  }, [layout.centerX, layout.centerY, layout.height, layout.width, zoom]);

  return (
    <Card>
      <CardHeader
        title="Intent Graph"
        subheader="Classification pairs intents, personas, and funnel stages."
        action={<Chip label={data?.source ?? "unknown"} variant="outlined" size="small" />}
      />
      <CardContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Grid container spacing={3} alignItems="stretch">
          <Grid item xs={12} lg={8}>
            <Stack spacing={2} sx={{ height: "100%" }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Zoom
                </Typography>
                <Slider
                  id={zoomControlId}
                  min={50}
                  max={250}
                  step={10}
                  value={Math.round(zoom * 100)}
                  valueLabelDisplay="auto"
                  onChange={(_, value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    setZoom(Number(next) / 100);
                  }}
                  sx={{ flexGrow: 1 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {Math.round(zoom * 100)}%
                </Typography>
              </Stack>
              <Box
                sx={{
                  flexGrow: 1,
                  minHeight: 360,
                  borderRadius: 3,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  bgcolor: (theme) =>
                    theme.palette.mode === "light" ? "rgba(59,130,246,0.05)" : "rgba(30,64,175,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 2,
                }}
              >
                <svg
                  viewBox={viewBox}
                  role="img"
                  aria-label="Intent graph visualization"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ width: "100%", height: "100%" }}
                >
                  <rect
                    x={layout.centerX - layout.width / 2}
                    y={layout.centerY - layout.height / 2}
                    width={layout.width}
                    height={layout.height}
                    rx={18}
                    fill="rgba(15,23,42,0.04)"
                  />
                  {layout.edges.map((edge) => (
                    <line
                      key={`${edge.source}-${edge.target}`}
                      x1={edge.x1}
                      y1={edge.y1}
                      x2={edge.x2}
                      y2={edge.y2}
                      stroke="rgba(148, 163, 184, 0.35)"
                      strokeWidth={Math.max(1, (edge.weight ?? 0.7) * 1.2)}
                    />
                  ))}
                  {layout.nodes.map((node) => (
                    <g key={node.id} transform={`translate(${node.px}, ${node.py})`}>
                      <circle r={12 + node.score * 6} fill={node.color} opacity={0.82} />
                      <text x={0} y={-18} textAnchor="middle" style={{ fontSize: 11, fontWeight: 600 }}>
                        {node.term}
                      </text>
                      <text x={0} y={6} textAnchor="middle" style={{ fontSize: 10, opacity: 0.8 }}>
                        {node.intent} · {node.purchaseStage}
                      </text>
                    </g>
                  ))}
                </svg>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} lg={4}>
            <Stack spacing={2} sx={{ height: "100%" }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Last updated
                </Typography>
                <Typography variant="body1">
                  {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "—"}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Legend
                </Typography>
                <Stack spacing={1.2}>
                  {legend.map((entry) => (
                    <Stack key={entry.intent} direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          bgcolor: entry.color,
                          border: "1px solid rgba(15, 23, 42, 0.08)",
                        }}
                      />
                      <Typography variant="body2">{entry.intent}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default IntentGraph;
