"use client";

import { useEffect, useId, useMemo, useState } from "react";

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
    <div className="intent-graph">
      <header className="intent-graph__header">
        <div>
          <h2>Intent Graph</h2>
          <p className="insights-muted">
            Classification pairs intents, personas, and funnel stages. Force layout reveals adjacency between similar behaviors
            across marketplaces.
          </p>
        </div>
        <div className="intent-graph__meta">
          <span className="intent-graph__badge">{data?.source ?? "unknown"}</span>
          {data?.generatedAt ? <span>{new Date(data.generatedAt).toLocaleTimeString()}</span> : null}
          <div className="intent-graph__controls">
            <label htmlFor={zoomControlId}>Zoom</label>
            <input
              id={zoomControlId}
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={zoom}
              onChange={(event) => setZoom(Number(event.currentTarget.value))}
            />
            <span>{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </header>
      {error ? <div className="intent-graph__error">{error}</div> : null}
      <div className="intent-graph__canvas">
        <div className="intent-graph__viewer">
          <svg
            viewBox={viewBox}
            role="img"
            aria-label="Intent graph visualization"
            className="intent-graph__svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <rect
              x={layout.centerX - layout.width / 2}
              y={layout.centerY - layout.height / 2}
              width={layout.width}
              height={layout.height}
              rx={18}
              className="intent-graph__surface"
            />
            {layout.edges.map((edge) => (
              <line key={`${edge.source}-${edge.target}`} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} className="intent-graph__edge" />
            ))}
            {layout.nodes.map((node) => (
              <g key={node.id} transform={`translate(${node.px}, ${node.py})`}>
                <circle r={12 + node.score * 6} fill={node.color} className="intent-graph__node" />
                <text className="intent-graph__node-label" x={0} y={-16} textAnchor="middle">
                  {node.term}
                </text>
                <text className="intent-graph__node-sub" x={0} y={6} textAnchor="middle">
                  {node.intent} · {node.purchaseStage}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <aside className="intent-graph__legend">
          <h3>Legend</h3>
          <ul>
            {legend.map((entry) => (
              <li key={entry.intent}>
                <span style={{ backgroundColor: entry.color }} />
                <span>{entry.intent}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

export default IntentGraph;
