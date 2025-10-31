export type TagCatalogEntry = {
  tag: string;
  searchVolume: number;
  trend: "rising" | "stable" | "falling";
  competition: "low" | "medium" | "high";
  related?: string[];
};

export type TagHealthDiagnostic = {
  tag: string;
  score: number;
  status: "excellent" | "good" | "caution" | "risky";
  message: string;
  suggestion?: string;
  searchVolume?: number;
  trend?: TagCatalogEntry["trend"];
  competition?: TagCatalogEntry["competition"];
};

export type TagOptimizerResult = {
  healthScore: number;
  duplicates: string[];
  lowVolumeTags: string[];
  diagnostics: TagHealthDiagnostic[];
  recommendations: {
    add: string[];
    replace: Array<{ from: string; to: string; reason: string }>;
  };
};

export type TagOptimizerInput = {
  tags: string[];
  catalog: TagCatalogEntry[];
};

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function categorizeScore(score: number): TagHealthDiagnostic["status"] {
  if (score >= 0.85) return "excellent";
  if (score >= 0.65) return "good";
  if (score >= 0.45) return "caution";
  return "risky";
}

function buildCatalogIndex(catalog: TagCatalogEntry[]): Map<string, TagCatalogEntry> {
  const index = new Map<string, TagCatalogEntry>();
  for (const entry of catalog) {
    index.set(normalizeTag(entry.tag), entry);
  }
  return index;
}

function detectDuplicates(tags: string[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (seen.has(normalized) && !duplicates.includes(normalized)) {
      duplicates.push(normalized);
    }
    seen.add(normalized);
  }
  return duplicates;
}

function scoreTag(tag: string, entry: TagCatalogEntry | undefined): TagHealthDiagnostic {
  if (!entry) {
    return {
      tag,
      score: 0.35,
      status: "caution",
      message: "No search intelligence found for this tag. Double-check demand before keeping it.",
    };
  }
  const volumeScore = Math.min(1, entry.searchVolume / 100);
  const trendScore = entry.trend === "rising" ? 1 : entry.trend === "stable" ? 0.7 : 0.4;
  const competitionScore = entry.competition === "low" ? 1 : entry.competition === "medium" ? 0.7 : 0.45;
  const score = volumeScore * 0.5 + trendScore * 0.25 + competitionScore * 0.25;
  const status = categorizeScore(score);
  let message = "Strong performer with healthy demand.";
  if (status === "good") {
    message = "Solid tag. Pair it with a rising trend to strengthen the mix.";
  } else if (status === "caution") {
    message = "Limited demand or heavy competition detected. Consider alternatives.";
  } else if (status === "risky") {
    message = "Tag is unlikely to drive traffic. Swap it for a higher-intent phrase.";
  }
  let suggestion: string | undefined;
  if (entry.related?.length) {
    suggestion = entry.related[0];
  }
  return {
    tag,
    score,
    status,
    message,
    suggestion,
    searchVolume: entry.searchVolume,
    trend: entry.trend,
    competition: entry.competition,
  };
}

function findReplacementCandidates(
  diagnostics: TagHealthDiagnostic[],
  catalogIndex: Map<string, TagCatalogEntry>,
): Array<{ from: string; to: string; reason: string }> {
  const replacements: Array<{ from: string; to: string; reason: string }> = [];
  for (const diagnostic of diagnostics) {
    if (diagnostic.status === "excellent" || diagnostic.status === "good") {
      continue;
    }
    const entry = catalogIndex.get(normalizeTag(diagnostic.tag));
    const candidates = entry?.related ?? [];
    for (const candidate of candidates) {
      const candidateEntry = catalogIndex.get(normalizeTag(candidate));
      if (!candidateEntry) {
        continue;
      }
      const candidateScore = scoreTag(candidate, candidateEntry).score;
      if (candidateScore > diagnostic.score + 0.15) {
        replacements.push({
          from: diagnostic.tag,
          to: candidate,
          reason: `Improves health score from ${(diagnostic.score * 100).toFixed(0)} to ${(candidateScore * 100).toFixed(0)}.`,
        });
        break;
      }
    }
  }
  return replacements;
}

function recommendAdditions(
  tags: string[],
  catalogIndex: Map<string, TagCatalogEntry>,
  duplicates: string[],
): string[] {
  const normalized = new Set(tags.map(normalizeTag));
  const additions: string[] = [];
  for (const entry of catalogIndex.values()) {
    if (normalized.has(normalizeTag(entry.tag))) {
      continue;
    }
    const score = scoreTag(entry.tag, entry).score;
    if (score > 0.75 && additions.length < 8) {
      additions.push(entry.tag);
    }
  }
  if (duplicates.length) {
    additions.push(...duplicates.map((tag) => `Replace duplicate: ${tag}`));
  }
  return additions;
}

export function evaluateTagHealth({ tags, catalog }: TagOptimizerInput): TagOptimizerResult {
  const cleanedTags = tags.map(normalizeTag).filter(Boolean);
  const catalogIndex = buildCatalogIndex(catalog);
  const duplicates = detectDuplicates(cleanedTags);
  const diagnostics = cleanedTags.map((tag) => scoreTag(tag, catalogIndex.get(tag)));
  const lowVolumeTags = diagnostics
    .filter((diagnostic) => (diagnostic.searchVolume ?? 0) < 40)
    .map((diagnostic) => diagnostic.tag);
  const recommendations = {
    add: recommendAdditions(cleanedTags, catalogIndex, duplicates),
    replace: findReplacementCandidates(diagnostics, catalogIndex),
  };
  const averageScore = diagnostics.reduce((sum, diagnostic) => sum + diagnostic.score, 0) / (diagnostics.length || 1);
  const penalty = duplicates.length * 0.03 + lowVolumeTags.length * 0.02;
  const healthScore = Math.max(0, Math.min(1, averageScore - penalty));
  return {
    healthScore,
    duplicates,
    lowVolumeTags,
    diagnostics,
    recommendations,
  };
}
