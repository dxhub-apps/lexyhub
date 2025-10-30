import { NextResponse } from "next/server";

import { getOrCreateEmbedding } from "@/lib/ai/embeddings";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service credentials are not configured." },
      { status: 500 },
    );
  }

  const { data: keywords, error } = await supabase
    .from("keywords")
    .select("id, term, market, source")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: `Failed to load keywords: ${error.message}` },
      { status: 500 },
    );
  }

  const processed: Array<{ term: string; created: boolean }> = [];

  for (const keyword of keywords ?? []) {
    const embedding = await getOrCreateEmbedding(keyword.term, { supabase });
    processed.push({ term: keyword.term, created: embedding.created });
  }

  return NextResponse.json({ processed, count: processed.length });
}

export const runtime = "nodejs";
