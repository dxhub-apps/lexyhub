import { createHash } from "crypto";
import { NextResponse } from "next/server";

import { buildConceptClusters, fetchKeywordVectors } from "@/lib/clustering/concept-clusters";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function deterministicId(members: string[]): string {
  const hash = createHash("sha256").update(members.slice().sort().join("|"), "utf8").digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export async function POST(): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service credentials are not configured." },
      { status: 500 },
    );
  }

  const { data: jobStart, error: jobStartError } = await supabase
    .from("job_runs")
    .insert({ job_name: "rebuild-concept-clusters", status: "running" })
    .select("id")
    .maybeSingle();

  if (jobStartError) {
    console.warn("Failed to create job run for cluster rebuild", jobStartError);
  }

  const jobRunId = jobStart?.id ?? null;
  const finalize = async (
    status: "succeeded" | "failed",
    metadata: Record<string, unknown>,
  ): Promise<void> => {
    if (!jobRunId) {
      return;
    }
    const { error } = await supabase
      .from("job_runs")
      .update({ status, finished_at: new Date().toISOString(), metadata })
      .eq("id", jobRunId);
    if (error) {
      console.warn("Failed to finalize cluster job", error);
    }
  };

  try {
    const vectors = await fetchKeywordVectors(80);
    if (!vectors.length) {
      await finalize("succeeded", { message: "No embeddings available" });
      return NextResponse.json({ processed: 0, message: "No embeddings available" });
    }

    const clusterCount = Math.max(2, Math.min(8, Math.round(vectors.length / 10)));
    const clusters = await buildConceptClusters(vectors, clusterCount);

    const payloads = clusters.map((cluster) => {
      const memberTerms = cluster.members.map((member) => member.term);
      const avgMomentum =
        cluster.members.reduce((sum, member) => sum + Number(member.trendMomentum ?? 0), 0) /
        Math.max(cluster.members.length, 1);
      const intents = Array.from(
        cluster.members.reduce((set, member) => {
          if (member.intent) {
            set.add(member.intent);
          }
          return set;
        }, new Set<string>()),
      );

      return {
        id: deterministicId(memberTerms),
        centroid_vector: cluster.centroid,
        label: cluster.label.label,
        description: cluster.label.description,
        members: memberTerms,
        extras: {
          confidence: cluster.label.confidence,
          stats: {
            memberCount: cluster.members.length,
            averageMomentum: Number(avgMomentum.toFixed(4)),
            intents,
          },
          audit: {
            templateId: cluster.label.trace.templateId,
            templateVersion: cluster.label.trace.templateVersion,
            system: cluster.label.trace.system,
            user: cluster.label.trace.user,
            generatedAt: new Date().toISOString(),
            model: cluster.label.model,
          },
        },
      };
    });

    if (!payloads.length) {
      await finalize("succeeded", { message: "No clusters generated" });
      return NextResponse.json({ processed: 0, message: "No clusters generated" });
    }

    const { error: upsertError } = await supabase
      .from("concept_clusters")
      .upsert(payloads, { onConflict: "id" });

    if (upsertError) {
      throw new Error(`Failed to upsert concept clusters: ${upsertError.message}`);
    }

    await finalize("succeeded", { clusters: payloads.length, members: vectors.length });

    return NextResponse.json({ clusters: payloads.length, members: vectors.length });
  } catch (error) {
    console.error("Rebuild clusters job failed", error);
    await finalize("failed", { error: error instanceof Error ? error.message : "unknown" });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rebuild clusters" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
