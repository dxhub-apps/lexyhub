/**
 * LexyBrain Client Hooks
 *
 * React hooks for interacting with LexyBrain API endpoints from the client.
 */

import { useState } from "react";
import type { LexyBrainOutputType } from "@/lib/lexybrain-schemas";

// =====================================================
// Types
// =====================================================

export interface GenerateInsightRequest {
  type: LexyBrainOutputType;
  market: string;
  niche_terms?: string[];
  budget_cents?: number;
}

export interface GenerateInsightResponse {
  success: boolean;
  data?: any;
  error?: string;
  cached?: boolean;
  metadata?: {
    responseId?: string | null;
    requestId?: string | null;
    latencyMs?: number;
    modelVersion?: string;
  };
}

export interface GraphRequest {
  term: string;
  market: string;
  depth?: number;
  maxNodes?: number;
  minSimilarity?: number;
}

export interface GraphNode {
  id: string;
  term: string;
  demand_index: number | null;
  competition_score: number | null;
  trend_momentum: number | null;
  ai_opportunity_score: number | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  similarity: number;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerTerm: string;
  market: string;
}

// =====================================================
// Generate Insight Hook
// =====================================================

export function useLexyBrainGenerate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [metadata, setMetadata] = useState<GenerateInsightResponse["metadata"]>(undefined);

  const generate = async (request: GenerateInsightRequest): Promise<GenerateInsightResponse> => {
    setLoading(true);
    setError(null);
    setData(null);
    setMetadata(undefined);

    try {
      const response = await fetch("/api/lexybrain/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error === "quota_exceeded"
          ? `Quota exceeded. ${result.message || "Upgrade your plan for more insights."}`
          : result.error === "lexybrain_disabled"
          ? "LexyBrain is not currently enabled."
          : result.message || "Failed to generate insight";

        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // Extract metadata if present (for training data tracking)
      const responseMetadata = result._metadata || result.metadata;
      setMetadata(responseMetadata);

      // Remove metadata from result before setting data (keep it separate)
      const { _metadata, metadata: _, ...dataOnly } = result;
      setData(dataOnly);

      return {
        success: true,
        data: dataOnly,
        metadata: responseMetadata,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Network error";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setData(null);
    setMetadata(undefined);
  };

  return { generate, loading, error, data, metadata, reset };
}

// =====================================================
// Generate Graph Hook
// =====================================================

export function useLexyBrainGraph() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GraphResponse | null>(null);

  const generateGraph = async (request: GraphRequest): Promise<{ success: boolean; data?: GraphResponse; error?: string }> => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch("/api/lexybrain/graph", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.message || "Failed to generate graph";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      setData(result);
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Network error";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setData(null);
  };

  return { generateGraph, loading, error, data, reset };
}

// =====================================================
// Quota Info Hook
// =====================================================

export interface QuotaInfo {
  ai_calls: { used: number; limit: number; percentage: number };
  ai_brief: { used: number; limit: number; percentage: number };
  ai_sim: { used: number; limit: number; percentage: number };
}

export function useLexyBrainQuota() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  const fetchQuota = async (): Promise<{ success: boolean; data?: QuotaInfo; error?: string }> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/lexybrain/quota");

      if (!response.ok) {
        const errorMessage = "Failed to fetch quota information";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      const result = await response.json();
      setQuota(result);
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Network error";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return { fetchQuota, loading, error, quota };
}
