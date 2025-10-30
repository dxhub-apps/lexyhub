import { promises as fs } from "node:fs";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { ensureKeywordEmbeddings } from "../ai/embeddings";
import { createProvenanceId, normalizeKeywordTerm } from "../keywords/utils";
import { getSupabaseServerClient } from "../supabase-server";

const RawStringSchema = z.string().min(1);
const RawObjectSchema = z.object({
  term: z.string(),
  category: z.string().optional(),
  market: z.string().optional(),
  priority: z.number().int().min(0).optional(),
});

const RawDatasetSchema = z.array(z.union([RawStringSchema, RawObjectSchema]));

type RawRecord = z.infer<typeof RawObjectSchema> | string;

type NormalizedRecord = {
  term: string;
  market: string;
  category?: string;
  priority: number;
};

export type ImportOptions = {
  datasetPath: string;
  defaultMarket?: string;
  defaultPriority?: number;
  source?: string;
  method?: string;
  embed?: boolean;
  supabase?: SupabaseClient | null;
};

export type ImportSummary = {
  processed: number;
  insertedSeeds: number;
  insertedKeywords: number;
  embedded: number;
  skipped: number;
};

export async function loadSyntheticDataset(datasetPath: string): Promise<RawRecord[]> {
  const absolutePath = path.isAbsolute(datasetPath)
    ? datasetPath
    : path.resolve(process.cwd(), datasetPath);
  const contents = await fs.readFile(absolutePath, "utf-8");

  if (datasetPath.endsWith(".json")) {
    const parsed = JSON.parse(contents);
    return RawDatasetSchema.parse(parsed);
  }

  if (datasetPath.endsWith(".csv")) {
    const lines = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const [header, ...rows] = lines;
    const headers = header.split(",").map((value) => value.trim().toLowerCase());

    const records: RawRecord[] = rows.map((row) => {
      const values = row.split(",").map((value) => value.trim());
      const record: Record<string, string> = {};
      headers.forEach((column, index) => {
        record[column] = values[index] ?? "";
      });
      return {
        term: record.term,
        category: record.category || undefined,
        market: record.market || undefined,
        priority: record.priority ? Number(record.priority) : undefined,
      } satisfies z.infer<typeof RawObjectSchema>;
    });

    return RawDatasetSchema.parse(records);
  }

  // Fallback to newline-delimited plain text.
  return RawDatasetSchema.parse(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );
}

function normalizeRecords(
  records: RawRecord[],
  {
    defaultMarket,
    defaultPriority,
  }: { defaultMarket: string; defaultPriority: number },
): NormalizedRecord[] {
  const normalized = new Map<string, NormalizedRecord>();

  for (const entry of records) {
    const base: z.infer<typeof RawObjectSchema> =
      typeof entry === "string"
        ? { term: entry, market: undefined, category: undefined, priority: undefined }
        : entry;

    const term = normalizeKeywordTerm(base.term);
    if (!term) {
      continue;
    }

    const market = normalizeKeywordTerm(base.market ?? defaultMarket) || defaultMarket;
    const key = `${market}::${term}`;

    const priority = base.priority ?? defaultPriority;
    const existing = normalized.get(key);

    if (!existing) {
      normalized.set(key, {
        term,
        market,
        category: base.category?.trim(),
        priority,
      });
      continue;
    }

    if (priority > existing.priority) {
      normalized.set(key, {
        ...existing,
        priority,
        category: base.category?.trim() ?? existing.category,
      });
    }
  }

  return Array.from(normalized.values());
}

async function upsertKeywordSeeds(
  supabase: SupabaseClient,
  records: NormalizedRecord[],
): Promise<Array<{ id: string; term: string; market: string }>> {
  const payload = records.map((record) => ({
    term: record.term,
    market: record.market,
    priority: record.priority,
    status: "ready",
  }));

  let response = await supabase
    .from("keyword_seeds")
    .upsert(payload, { onConflict: "term,market" })
    .select("id, term, market");

  if (response.error) {
    response = await supabase.from("keyword_seeds").insert(payload).select("id, term, market");
  }

  if (response.error) {
    throw new Error(`Failed to upsert keyword_seeds: ${response.error.message}`);
  }

  return response.data ?? [];
}

async function upsertKeywords(
  supabase: SupabaseClient,
  records: NormalizedRecord[],
  seeds: Array<{ id: string; term: string; market: string }>,
  source: string,
  method: string,
): Promise<number> {
  const seedMap = new Map<string, string>();
  for (const seed of seeds) {
    seedMap.set(`${seed.market}::${seed.term}`, seed.id);
  }

  const payload = records.map((record) => ({
    term: record.term,
    market: record.market,
    source,
    tier: "free",
    is_seed: true,
    parent_seed_id: seedMap.get(`${record.market}::${record.term}`) ?? null,
    method,
    source_reason: record.category
      ? `Synthetic taxonomy seed (${record.category})`
      : "Synthetic taxonomy seed import",
    provenance_id: createProvenanceId(source, record.market, record.term),
    freshness_ts: new Date().toISOString(),
    extras: {
      category: record.category ?? null,
      provenance: "synthetic",
    },
  }));

  const { error, data } = await supabase
    .from("keywords")
    .upsert(payload, { onConflict: "term,source,market" })
    .select("id");

  if (error) {
    throw new Error(`Failed to upsert keywords: ${error.message}`);
  }

  return data?.length ?? payload.length;
}

export async function importSyntheticKeywords(options: ImportOptions): Promise<ImportSummary> {
  const {
    datasetPath,
    defaultMarket = "us",
    defaultPriority = 0,
    source = "synthetic",
    method = "synthetic-ai",
    embed = true,
    supabase: supabaseOverride,
  } = options;

  const records = await loadSyntheticDataset(datasetPath);
  const normalized = normalizeRecords(records, {
    defaultMarket,
    defaultPriority,
  });

  if (normalized.length === 0) {
    return {
      processed: 0,
      insertedSeeds: 0,
      insertedKeywords: 0,
      embedded: 0,
      skipped: 0,
    };
  }

  const supabase = supabaseOverride ?? getSupabaseServerClient();

  if (!supabase) {
    if (embed) {
      await ensureKeywordEmbeddings(normalized.map((record) => ({ term: record.term })), {
        supabase: null,
      });
    }

    return {
      processed: normalized.length,
      insertedSeeds: 0,
      insertedKeywords: 0,
      embedded: embed ? normalized.length : 0,
      skipped: normalized.length,
    };
  }

  const seeds = await upsertKeywordSeeds(supabase, normalized);
  const insertedKeywords = await upsertKeywords(supabase, normalized, seeds, source, method);

  let embedded = 0;
  if (embed) {
    const embeddings = await ensureKeywordEmbeddings(
      normalized.map((record) => ({ term: record.term })),
      { supabase },
    );
    embedded = embeddings.length;
  }

  return {
    processed: normalized.length,
    insertedSeeds: seeds.length,
    insertedKeywords,
    embedded,
    skipped: 0,
  };
}

async function runFromCli(): Promise<void> {
  const datasetPath = process.argv[2] ?? "data/synthetic/keywords.json";
  try {
    const summary = await importSyntheticKeywords({ datasetPath });
    console.log("Synthetic dataset import complete", summary);
  } catch (error) {
    console.error("Synthetic dataset import failed", error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void runFromCli();
}
