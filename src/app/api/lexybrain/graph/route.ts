/**
 * LexyBrain Graph (Neural Map) API Endpoint
 *
 * Generates keyword similarity graphs using vector embeddings.
 * Returns nodes and edges for visualization with Cytoscape.js or similar.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isLexyBrainGraphEnabled } from "@/lib/lexybrain-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// Request/Response Types
// =====================================================

const GraphRequestSchema = z.object({
  term: z.string().min(1),
  market: z.string().min(1),
  depth: z.number().int().min(1).max(3).optional().default(1),
  maxNodes: z.number().int().min(5).max(100).optional().default(50),
  minSimilarity: z.number().min(0).max(1).optional().default(0.5),
});

type GraphRequest = z.infer<typeof GraphRequestSchema>;

interface GraphNode {
  id: string;
  term: string;
  demand_index: number | null;
  competition_score: number | null;
  trend_momentum: number | null;
  ai_opportunity_score: number | null;
}

interface GraphEdge {
  source: string;
  target: string;
  similarity: number;
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerTerm: string;
  market: string;
}

// =====================================================
// Main Endpoint
// =====================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let userId: string | null = null;

  try {
    // 1. Feature Flag Check
    if (!isLexyBrainGraphEnabled()) {
      logger.warn({ type: "lexybrain_graph_disabled" }, "LexyBrain graph request rejected: feature disabled");
      return NextResponse.json(
        { error: "graph_disabled", message: "LexyBrain graph feature is not currently enabled" },
        { status: 503 }
      );
    }

    // 2. Authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn({ type: "lexybrain_graph_unauthorized" }, "LexyBrain graph request without authentication");
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    userId = user.id;

    // 3. Parse and Validate Request
    const body = await request.json().catch(() => null);
    const parsed = GraphRequestSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn(
        { type: "lexybrain_graph_invalid_request", errors: parsed.error.errors },
        "Invalid LexyBrain graph request"
      );
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.errors },
        { status: 422 }
      );
    }

    const { term, market, depth, maxNodes, minSimilarity } = parsed.data;

    logger.debug(
      {
        type: "lexybrain_graph_request",
        user_id: userId,
        term,
        market,
        depth,
        max_nodes: maxNodes,
      },
      "Processing LexyBrain graph request"
    );

    // 4. Find the center keyword
    const centerKeyword = await findKeyword(term, market);

    if (!centerKeyword) {
      return NextResponse.json(
        { error: "keyword_not_found", message: `Keyword "${term}" not found in market "${market}"` },
        { status: 404 }
      );
    }

    // 5. Build graph using vector similarity
    const graph = await buildKeywordGraph(
      centerKeyword.id,
      market,
      depth,
      maxNodes,
      minSimilarity
    );

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        type: "lexybrain_graph_success",
        user_id: userId,
        term,
        market,
        nodes_count: graph.nodes.length,
        edges_count: graph.edges.length,
        latency_ms: latencyMs,
      },
      "LexyBrain graph generation successful"
    );

    // 6. Return graph data
    return NextResponse.json({
      nodes: graph.nodes,
      edges: graph.edges,
      centerTerm: term,
      market,
    } as GraphResponse);
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        type: "lexybrain_graph_error",
        user_id: userId,
        latency_ms: latencyMs,
        error: error instanceof Error ? error.message : String(error),
      },
      "LexyBrain graph generation failed"
    );

    Sentry.captureException(error, {
      tags: {
        feature: "lexybrain",
        component: "graph-endpoint",
      },
      extra: {
        user_id: userId,
        latency_ms: latencyMs,
      },
    });

    return NextResponse.json(
      {
        error: "graph_generation_failed",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Find keyword by term and market
 */
async function findKeyword(
  term: string,
  market: string
): Promise<{ id: string; term: string } | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { data, error } = await supabase
    .from("keywords")
    .select("id, term")
    .eq("market", market)
    .ilike("term", term)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Build keyword graph using vector similarity
 */
async function buildKeywordGraph(
  centerKeywordId: string,
  market: string,
  depth: number,
  maxNodes: number,
  minSimilarity: number
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const visited = new Set<string>();

  // Fetch center keyword details
  const { data: centerData } = await supabase
    .from("keywords")
    .select("id, term, demand_index, competition_score, trend_momentum, ai_opportunity_score")
    .eq("id", centerKeywordId)
    .single();

  if (!centerData) {
    throw new Error("Center keyword not found");
  }

  // Add center node
  nodes.set(centerKeywordId, {
    id: centerKeywordId,
    term: centerData.term,
    demand_index: centerData.demand_index,
    competition_score: centerData.competition_score,
    trend_momentum: centerData.trend_momentum,
    ai_opportunity_score: centerData.ai_opportunity_score,
  });
  visited.add(centerKeywordId);

  // BFS to build graph
  const queue: Array<{ keywordId: string; currentDepth: number }> = [
    { keywordId: centerKeywordId, currentDepth: 0 },
  ];

  while (queue.length > 0 && nodes.size < maxNodes) {
    const { keywordId, currentDepth } = queue.shift()!;

    // Stop if we've reached max depth
    if (currentDepth >= depth) {
      continue;
    }

    // Find similar keywords using RPC
    const { data: similarKeywords, error } = await supabase.rpc("similar_keywords", {
      p_keyword_id: keywordId,
      p_k: 20, // Fetch top 20 similar
    });

    if (error || !similarKeywords) {
      logger.warn(
        { type: "similar_keywords_rpc_error", keyword_id: keywordId, error: error?.message },
        "Failed to fetch similar keywords"
      );
      continue;
    }

    for (const similar of similarKeywords) {
      // Skip if similarity is below threshold
      if (similar.similarity < minSimilarity) {
        continue;
      }

      // Skip if already visited
      if (visited.has(similar.keyword_id)) {
        // Add edge if both nodes exist
        if (nodes.has(similar.keyword_id)) {
          edges.push({
            source: keywordId,
            target: similar.keyword_id,
            similarity: similar.similarity,
          });
        }
        continue;
      }

      // Stop if we've reached max nodes
      if (nodes.size >= maxNodes) {
        break;
      }

      // Add node
      nodes.set(similar.keyword_id, {
        id: similar.keyword_id,
        term: similar.term,
        demand_index: similar.demand_index,
        competition_score: similar.competition_score,
        trend_momentum: similar.trend_momentum,
        ai_opportunity_score: null, // Not returned by RPC
      });

      // Add edge
      edges.push({
        source: keywordId,
        target: similar.keyword_id,
        similarity: similar.similarity,
      });

      // Mark as visited
      visited.add(similar.keyword_id);

      // Add to queue for next depth level
      if (currentDepth + 1 < depth) {
        queue.push({
          keywordId: similar.keyword_id,
          currentDepth: currentDepth + 1,
        });
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
}
