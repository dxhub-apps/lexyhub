"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { WheelEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Plus, Loader2, Network as NetworkIcon } from "lucide-react";

/**
 * LexyBrain Neural Map Component
 *
 * Interactive keyword similarity graph visualization.
 * Shows semantic relationships between keywords using vector embeddings.
 */

// =====================================================
// Types
// =====================================================

interface GraphNode {
  id: string;
  term: string;
  demand_index: number | null;
  competition_score: number | null;
  trend_momentum: number | null;
  ai_opportunity_score: number | null;
  x?: number;
  y?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  similarity: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerTerm: string;
  market: string;
}

interface NeuralMapProps {
  term: string;
  market: string;
  onAddToWatchlist?: (term: string) => void;
  onAnalyzeCluster?: (terms: string[]) => void;
}

// =====================================================
// Component
// =====================================================

export function NeuralMap({
  term,
  market,
  onAddToWatchlist,
  onAnalyzeCluster,
}: NeuralMapProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const svgId = useId();

  // Fetch graph data
  useEffect(() => {
    async function fetchGraph() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/lexybrain/graph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term,
            market,
            depth: 2,
            maxNodes: 50,
            minSimilarity: 0.5,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data: GraphData = await response.json();
        setGraphData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    }

    fetchGraph();
  }, [term, market]);

  // Position nodes using force-directed layout
  const positionedNodes = useMemo(() => {
    if (!graphData) return [];

    // Simple circular layout for now (can be enhanced with d3-force later)
    const nodes = graphData.nodes.map((node, index) => {
      if (index === 0) {
        // Center node
        return { ...node, x: 400, y: 300 };
      }

      const angle = (index / (graphData.nodes.length - 1)) * 2 * Math.PI;
      const radius = 200;
      return {
        ...node,
        x: 400 + radius * Math.cos(angle),
        y: 300 + radius * Math.sin(angle),
      };
    });

    return nodes;
  }, [graphData]);

  // Get node color based on opportunity score
  const getNodeColor = (node: GraphNode) => {
    const score = node.ai_opportunity_score ?? 0.5;
    if (score >= 0.7) return "#10b981"; // green
    if (score >= 0.4) return "#f59e0b"; // yellow
    return "#ef4444"; // red
  };

  // Get node size based on demand
  const getNodeSize = (node: GraphNode) => {
    const demand = node.demand_index ?? 0.5;
    return 8 + demand * 12; // 8-20px radius
  };

  // Handle zoom
  const handleWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.1, Math.min(5, prev * delta)));
  }, []);

  // Handle pan
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 0 && !(e.target as SVGElement).closest("circle")) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle node click
  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(selectedNode?.id === node.id ? null : node);
  };

  // Get connected nodes for cluster analysis
  const getConnectedNodes = (nodeId: string): string[] => {
    if (!graphData) return [];

    const connected = new Set<string>([nodeId]);
    graphData.edges.forEach((edge) => {
      if (edge.source === nodeId) connected.add(edge.target);
      if (edge.target === nodeId) connected.add(edge.source);
    });

    return Array.from(connected)
      .map((id) => graphData.nodes.find((n) => n.id === id)?.term)
      .filter(Boolean) as string[];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Building neural map...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-2">Failed to load graph</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!graphData || positionedNodes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-sm text-muted-foreground">
            No related keywords found for &quot;{term}&quot; in {market}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Graph Canvas */}
      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <NetworkIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Neural Map: <span className="text-purple-600 dark:text-purple-400">{graphData.centerTerm}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {positionedNodes.length} keywords • {graphData.edges.length} connections • AI-powered similarity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Zoom: {Math.round(zoom * 100)}%
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative border-2 border-purple-100 dark:border-purple-900 rounded-lg overflow-hidden bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-purple-950 dark:to-blue-950">
            <svg
              id={svgId}
              width="100%"
              height="600"
              viewBox="0 0 800 600"
              className="cursor-move"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Edges with gradient */}
                <defs>
                  <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                {graphData.edges.map((edge, index) => {
                  const sourceNode = positionedNodes.find((n) => n.id === edge.source);
                  const targetNode = positionedNodes.find((n) => n.id === edge.target);

                  if (!sourceNode || !targetNode) return null;

                  return (
                    <line
                      key={index}
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke="url(#edge-gradient)"
                      strokeWidth={1 + edge.similarity * 3}
                      strokeOpacity={0.2 + edge.similarity * 0.6}
                    />
                  );
                })}

                {/* Nodes with glow effects */}
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                {positionedNodes.map((node, index) => {
                  const isCenter = index === 0;
                  const isSelected = selectedNode?.id === node.id;
                  const size = getNodeSize(node);
                  const color = getNodeColor(node);

                  return (
                    <g key={node.id} className="cursor-pointer">
                      {/* Outer glow for center node */}
                      {isCenter && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={size + 8}
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="2"
                          strokeOpacity="0.3"
                          className="animate-pulse"
                        />
                      )}

                      {/* Node circle with gradient */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={size}
                        fill={color}
                        stroke={isCenter ? "#7c3aed" : isSelected ? "#3b82f6" : "#fff"}
                        strokeWidth={isCenter ? 4 : isSelected ? 3 : 2}
                        className="transition-all hover:opacity-80"
                        onClick={() => handleNodeClick(node)}
                        filter={isCenter || isSelected ? "url(#glow)" : undefined}
                      />

                      {/* Node label */}
                      <text
                        x={node.x}
                        y={node.y + size + 15}
                        textAnchor="middle"
                        fontSize={isCenter ? 14 : 12}
                        fontWeight={isCenter ? "bold" : "normal"}
                        fill={isCenter ? "#7c3aed" : isSelected ? "#3b82f6" : "#475569"}
                        className="pointer-events-none dark:fill-slate-300"
                      >
                        {node.term.length > 20 ? `${node.term.substring(0, 20)}...` : node.term}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-background/80 backdrop-blur-sm p-2 rounded-lg border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom((prev) => Math.min(5, prev * 1.2))}
              >
                +
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom((prev) => Math.max(0.1, prev * 0.8))}
              >
                −
              </Button>
            </div>

            {/* Legend with gradient background */}
            <div className="absolute top-4 left-4 bg-gradient-to-br from-white/95 to-purple-50/95 dark:from-slate-900/95 dark:to-purple-950/95 backdrop-blur-sm p-3 rounded-lg border-2 border-purple-200 dark:border-purple-800 space-y-2 text-xs shadow-lg">
              <div className="font-bold mb-2 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Legend
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm" />
                  <span className="text-green-700 dark:text-green-300 font-medium">High Opportunity 70%+</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm" />
                  <span className="text-yellow-700 dark:text-yellow-300 font-medium">Medium 40-70%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                  <span className="text-red-700 dark:text-red-300 font-medium">Low &lt;40%</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
                <div className="font-semibold mb-1 text-purple-700 dark:text-purple-300">Node Size</div>
                <span className="text-muted-foreground">Shows demand level</span>
              </div>
              <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                <div className="font-semibold mb-1 text-purple-700 dark:text-purple-300">Line Thickness</div>
                <span className="text-muted-foreground">Shows similarity strength</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Node Details Panel */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <CardTitle>Keyword Details: {selectedNode.term}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium mb-2">Metrics</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Demand Index:</span>
                    <Badge variant="secondary">
                      {selectedNode.demand_index !== null
                        ? Math.round(selectedNode.demand_index * 100)
                        : "N/A"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Competition:</span>
                    <Badge variant="secondary">
                      {selectedNode.competition_score !== null
                        ? Math.round(selectedNode.competition_score * 100)
                        : "N/A"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trend Momentum:</span>
                    <Badge variant="secondary">
                      {selectedNode.trend_momentum !== null
                        ? Math.round(selectedNode.trend_momentum * 100)
                        : "N/A"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AI Opportunity:</span>
                    <Badge
                      variant={
                        (selectedNode.ai_opportunity_score ?? 0) >= 0.7
                          ? "default"
                          : (selectedNode.ai_opportunity_score ?? 0) >= 0.4
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {selectedNode.ai_opportunity_score !== null
                        ? Math.round(selectedNode.ai_opportunity_score * 100)
                        : "N/A"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Actions</div>
                <div className="space-y-2">
                  {onAddToWatchlist && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => onAddToWatchlist(selectedNode.term)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Watchlist
                    </Button>
                  )}
                  {onAnalyzeCluster && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => onAnalyzeCluster(getConnectedNodes(selectedNode.id))}
                    >
                      <NetworkIcon className="h-4 w-4 mr-2" />
                      Analyze Cluster ({getConnectedNodes(selectedNode.id).length} keywords)
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <strong>How to use:</strong> Click a node to see details • Scroll to zoom • Drag to
              pan
            </p>
            <p>
              Node size represents demand, color shows opportunity (🟢 high, 🟡 medium, 🔴 low)
            </p>
            <p>
              Line thickness shows semantic similarity between keywords based on AI embeddings
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
