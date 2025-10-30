"use client";

import { useEffect, useMemo, useState } from "react";

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

function scale(value: number): number {
  return (value + 1) * 150;
}

export function IntentGraph(): JSX.Element {
  const [data, setData] = useState<IntentGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/insights/intent-graph")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Intent graph request failed (${response.status})`);
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
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const nodes = useMemo(() => data?.nodes ?? [], [data]);
  const edges = useMemo(() => data?.edges ?? [], [data]);
  const legend = useMemo(() => data?.legend ?? [], [data]);

  const nodeLookup = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

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
        </div>
      </header>
      {error ? <div className="intent-graph__error">{error}</div> : null}
      <div className="intent-graph__canvas">
        <svg viewBox="0 0 300 300" role="img" aria-label="Intent graph visualization">
          <rect x={0} y={0} width={300} height={300} rx={12} className="intent-graph__surface" />
          {edges.map((edge) => {
            const source = nodeLookup.get(edge.source);
            const target = nodeLookup.get(edge.target);
            if (!source || !target) {
              return null;
            }
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={scale(source.x)}
                y1={scale(source.y)}
                x2={scale(target.x)}
                y2={scale(target.y)}
                className="intent-graph__edge"
              />
            );
          })}
          {nodes.map((node) => (
            <g key={node.id} transform={`translate(${scale(node.x)}, ${scale(node.y)})`}>
              <circle r={10 + node.score * 6} fill={node.color} className="intent-graph__node" />
              <text className="intent-graph__node-label" x={0} y={-14} textAnchor="middle">
                {node.term}
              </text>
              <text className="intent-graph__node-sub" x={0} y={4} textAnchor="middle">
                {node.intent} · {node.purchaseStage}
              </text>
            </g>
          ))}
        </svg>
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
