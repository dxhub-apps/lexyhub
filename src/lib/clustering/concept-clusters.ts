import { buildChatMessages, buildPromptTrace, CLUSTER_LABEL_PROMPT, type ClusterLabelInput } from "@/lib/ai/prompts";
import type { PromptTrace } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { orchestrate } from "@/lib/lexybrain/orchestrator";

export type KeywordVector = {
  id: string;
  term: string;
  embedding: number[];
  market?: string;
  source?: string;
  trendMomentum?: number | null;
  intent?: string;
};

export type ClusterLabel = {
  label: string;
  description: string;
  confidence: number;
  model: string;
  trace: PromptTrace<ClusterLabelInput>;
  raw?: unknown;
};

export type ConceptCluster = {
  centroid: number[];
  members: KeywordVector[];
  label: ClusterLabel;
};

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function addVectors(a: number[], b: number[]): number[] {
  const length = Math.min(a.length, b.length);
  const result: number[] = new Array(length).fill(0);
  for (let i = 0; i < length; i += 1) {
    result[i] = (a[i] ?? 0) + (b[i] ?? 0);
  }
  return result;
}

function divideVector(vector: number[], divisor: number): number[] {
  if (!divisor) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / divisor);
}

function initializeCentroids(records: KeywordVector[], k: number): number[][] {
  const centroids: number[][] = [];
  const step = Math.max(1, Math.floor(records.length / k));
  for (let i = 0; i < k; i += 1) {
    centroids.push([...records[Math.min(i * step, records.length - 1)].embedding]);
  }
  return centroids;
}

function assignClusters(records: KeywordVector[], centroids: number[][]): number[] {
  return records.map((record) => {
    let bestIndex = 0;
    let bestScore = -Infinity;
    centroids.forEach((centroid, index) => {
      const score = cosineSimilarity(record.embedding, centroid);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  });
}

function updateCentroids(records: KeywordVector[], assignments: number[], k: number): number[][] {
  const dimension = records[0].embedding.length;
  const sums = Array.from({ length: k }, () => new Array(dimension).fill(0));
  const counts = Array.from({ length: k }, () => 0);

  assignments.forEach((clusterIndex, idx) => {
    sums[clusterIndex] = addVectors(sums[clusterIndex], records[idx].embedding);
    counts[clusterIndex] += 1;
  });

  return sums.map((sum, index) => divideVector(sum, counts[index] || 1));
}

export function kMeans(records: KeywordVector[], k: number, iterations = 8): number[] {
  if (!records.length) {
    return [];
  }
  const clusterCount = Math.min(k, records.length);
  const centroids = initializeCentroids(records, clusterCount);
  let assignments = assignClusters(records, centroids);

  for (let i = 0; i < iterations; i += 1) {
    const updatedCentroids = updateCentroids(records, assignments, clusterCount);
    assignments = assignClusters(records, updatedCentroids);
    for (let j = 0; j < clusterCount; j += 1) {
      centroids[j] = updatedCentroids[j];
    }
  }

  return assignments;
}

function fallbackLabel(members: KeywordVector[]): ClusterLabel {
  const keywords = members.map((member) => member.term);
  const summary = keywords.slice(0, 4).join(", ");
  return {
    label: `${keywords[0] ?? "Cluster"} & Co.`,
    description: `Heuristic label derived from members: ${summary}.`,
    confidence: 0.32,
    model: "deterministic-fallback",
    trace: buildPromptTrace(CLUSTER_LABEL_PROMPT, { keywords }),
  };
}

async function labelCluster(members: KeywordVector[]): Promise<ClusterLabel> {
  const signals: ClusterLabelInput["signals"] = [];
  const averageMomentum =
    members.reduce((sum, member) => sum + Number(member.trendMomentum ?? 0), 0) /
    Math.max(members.length, 1);

  if (Number.isFinite(averageMomentum)) {
    signals.push({ name: "momentum", value: averageMomentum });
  }

  const intents = members
    .map((member) => member.intent)
    .filter((intent): intent is string => Boolean(intent));
  const primaryIntent = intents.length
    ? intents.reduce((acc, intent) => {
        acc[intent] = (acc[intent] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : null;

  const dominantIntent =
    primaryIntent
      ? Object.entries(primaryIntent).sort((a, b) => b[1] - a[1])[0]?.[0]
      : undefined;

  const payload: ClusterLabelInput = {
    keywords: members.map((member) => member.term),
    primaryIntent: dominantIntent,
    signals,
  };

  try {
    // Use LexyBrain orchestrator for cluster labeling
    const result = await orchestrate({
      capability: "cluster_labeling",
      userId: "system",
      scope: "global",
      metadata: {
        keywords: payload.keywords,
        primaryIntent: payload.primaryIntent,
        signals: payload.signals,
      },
    });

    const insightData = result.insight as any;

    return {
      label: insightData.label ?? members[0]?.term ?? "Cluster",
      description: insightData.description ?? "Model did not supply a description.",
      confidence: typeof insightData.confidence === "number" ? insightData.confidence : 0.62,
      model: result.llama.modelVersion,
      trace: {
        templateId: result.capability,
        templateVersion: result.outputType,
        system: "LexyBrain Orchestrator",
        user: JSON.stringify(payload),
      } as PromptTrace<ClusterLabelInput>,
      raw: insightData,
    };
  } catch (error) {
    console.error("Cluster label call failed", error);
    return fallbackLabel(members);
  }
}

export async function fetchKeywordVectors(limit = 60): Promise<KeywordVector[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return [];
  }

  const { data: embeddings, error: embeddingError } = await supabase
    .from("embeddings")
    .select("term, embedding")
    .limit(limit * 2);

  if (embeddingError) {
    console.warn("Failed to load embeddings", embeddingError);
    return [];
  }

  const terms = (embeddings ?? []).map((row) => row.term);

  const { data: keywords, error: keywordError } = await supabase
    .from("keywords")
    .select("id, term, market, source, trend_momentum, extras")
    .in("term", terms)
    .limit(limit * 2);

  if (keywordError) {
    console.warn("Failed to load keywords for clustering", keywordError);
    return [];
  }

  const intentByTerm = new Map<string, string>();
  for (const keyword of keywords ?? []) {
    const extras = keyword.extras && typeof keyword.extras === "object" ? keyword.extras : {};
    const classification = (extras as { classification?: Record<string, unknown> }).classification;
    if (classification && typeof classification === "object" && typeof classification.intent === "string") {
      intentByTerm.set(keyword.term, classification.intent);
    }
  }

  const vectors: KeywordVector[] = [];
  const seen = new Set<string>();

  for (const row of embeddings ?? []) {
    if (!Array.isArray(row.embedding) || seen.has(row.term)) {
      continue;
    }

    const keyword = (keywords ?? []).find((entry) => entry.term === row.term);
    if (!keyword) {
      continue;
    }

    vectors.push({
      id: keyword.id,
      term: keyword.term,
      embedding: row.embedding as number[],
      market: keyword.market ?? undefined,
      source: keyword.source ?? undefined,
      trendMomentum: keyword.trend_momentum ?? null,
      intent: intentByTerm.get(keyword.term),
    });
    seen.add(row.term);
  }

  return vectors.slice(0, limit);
}

export async function buildConceptClusters(records: KeywordVector[], clusterCount: number): Promise<ConceptCluster[]> {
  if (!records.length) {
    return [];
  }

  const assignments = kMeans(records, clusterCount);
  const grouped = new Map<number, KeywordVector[]>();

  assignments.forEach((clusterIndex, idx) => {
    if (!grouped.has(clusterIndex)) {
      grouped.set(clusterIndex, []);
    }
    grouped.get(clusterIndex)!.push(records[idx]);
  });

  const clusters: ConceptCluster[] = [];

  for (const [, members] of grouped.entries()) {
    if (!members.length) {
      continue;
    }

    const dimension = members[0].embedding.length;
    const sum = members.reduce(
      (accumulator, member) => addVectors(accumulator, member.embedding),
      new Array(dimension).fill(0),
    );
    const centroid = divideVector(sum, members.length);
    const label = await labelCluster(members);
    clusters.push({ centroid, members, label });
  }

  return clusters;
}
