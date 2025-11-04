"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { WheelEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

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
};

type IntentGraphLegend = {
  intent: string;
  color: string;
};

type IntentGraphResponse = {
  nodes: IntentGraphNode[];
  edges: Array<IntentGraphEdge & { weight: number }>;
  legend: IntentGraphLegend[];
  generatedAt: string;
  source: string;
};

type IntentGraphTimeframeOption = {
  value: string;
  label: string;
};

type IntentGraphProps = {
  title?: string;
  description?: string;
  timeframe?: string;
  timeframeOptions?: IntentGraphTimeframeOption[];
  onTimeframeChange?: (value: string) => void;
  titleId?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function IntentGraph({
  title = "Intent Graph",
  description = "Classification pairs intents, personas, and funnel stages. Force layout reveals adjacency between similar behaviors across marketplaces.",
  timeframe,
  timeframeOptions,
  onTimeframeChange,
  titleId,
}: IntentGraphProps): JSX.Element {
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

  const hasTimeframeControls =
    Array.isArray(timeframeOptions) && timeframeOptions.length > 0 && typeof onTimeframeChange === "function";

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

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY;
    if (!Number.isFinite(delta)) {
      return;
    }
    setZoom((previous) => {
      const nextZoom = clamp(previous - delta * 0.0015, 0.5, 2.5);
      if (Math.abs(nextZoom - previous) < 0.001) {
        return previous;
      }
      return nextZoom;
    });
  }, []);

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
          <Badge variant="secondary">{data?.source ?? "unknown"}</Badge>
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

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <div className="rounded-md border bg-card p-4">
            <div className="mb-4 flex items-center gap-4">
              <Label htmlFor={zoomControlId} className="text-sm">Zoom</Label>
              <Slider
                id={zoomControlId}
                min={0.5}
                max={2.5}
                step={0.1}
                value={[zoom]}
                onValueChange={(value) => setZoom(value[0])}
                className="flex-1 max-w-xs"
              />
              <span className="text-sm font-medium w-12 text-right">{Math.round(zoom * 100)}%</span>
            </div>
            <div
              className="overflow-hidden rounded border"
              onWheel={handleWheel}
              role="presentation"
              tabIndex={0}
              style={{ height: '500px' }}
            >
              <svg
                viewBox={viewBox}
                role="img"
                aria-label="Intent graph visualization"
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-full"
              >
                <rect
                  x={layout.centerX - layout.width / 2}
                  y={layout.centerY - layout.height / 2}
                  width={layout.width}
                  height={layout.height}
                  rx={18}
                  fill="currentColor"
                  className="text-muted/10"
                />
                {layout.edges.map((edge) => (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-muted-foreground/30"
                  />
                ))}
                {layout.nodes.map((node) => (
                  <g key={node.id} transform={`translate(${node.px}, ${node.py})`}>
                    <circle
                      r={12 + node.score * 6}
                      fill={node.color}
                      className="opacity-80"
                    />
                    <text
                      className="fill-foreground text-xs font-medium"
                      x={0}
                      y={-16}
                      textAnchor="middle"
                    >
                      {node.term}
                    </text>
                    <text
                      className="fill-muted-foreground text-[10px]"
                      x={0}
                      y={6}
                      textAnchor="middle"
                    >
                      {node.intent} · {node.purchaseStage}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-md border p-4 space-y-3">
            <h3 className="font-semibold">Legend</h3>
            <div className="space-y-2">
              {legend.map((entry) => (
                <div key={entry.intent} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm">{entry.intent}</span>
                </div>
              ))}
            </div>
            {legend.length === 0 && (
              <p className="text-sm text-muted-foreground">No legend data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntentGraph;
