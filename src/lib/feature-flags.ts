import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "./supabase-server";

const DEFAULT_FLAGS = {
  require_official_etsy_api: false,
  allow_search_sampling: false,
  allow_user_telemetry: false,
} as const;

export type FeatureFlagKey = keyof typeof DEFAULT_FLAGS;
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

const FEATURE_FLAG_KEYS = Object.keys(DEFAULT_FLAGS) as FeatureFlagKey[];

type CacheEntry = {
  expiresAt: number;
  value: FeatureFlags;
};

const CACHE_TTL_MS = 60_000;

let cache: CacheEntry | null = null;
let pending: Promise<FeatureFlags> | null = null;

type LoadOptions = {
  supabase?: SupabaseClient | null;
  forceRefresh?: boolean;
};

function createDefaultFlags(): FeatureFlags {
  return { ...DEFAULT_FLAGS };
}

function asFeatureFlags(rows: Array<{ key: string; is_enabled: boolean | null }>): FeatureFlags {
  const values: FeatureFlags = createDefaultFlags();
  for (const row of rows) {
    if (FEATURE_FLAG_KEYS.includes(row.key as FeatureFlagKey)) {
      const key = row.key as FeatureFlagKey;
      values[key] = Boolean(row.is_enabled);
    }
  }
  return values;
}

async function fetchFeatureFlags(supabase?: SupabaseClient | null): Promise<FeatureFlags> {
  const client = supabase ?? getSupabaseServerClient();
  if (!client) {
    return createDefaultFlags();
  }

  const { data, error } = await client
    .from("feature_flags")
    .select("key,is_enabled")
    .in("key", FEATURE_FLAG_KEYS);

  if (error) {
    console.warn("Failed to load feature flags", error);
    return createDefaultFlags();
  }

  return asFeatureFlags(data ?? []);
}

export function invalidateFeatureFlagCache(): void {
  cache = null;
  pending = null;
}

export async function getFeatureFlags(options: LoadOptions = {}): Promise<FeatureFlags> {
  const { supabase = undefined, forceRefresh = false } = options;
  const now = Date.now();

  if (!forceRefresh && cache && cache.expiresAt > now) {
    return cache.value;
  }

  if (!forceRefresh && pending) {
    return pending;
  }

  const loader = fetchFeatureFlags(supabase).then((flags) => {
    cache = { value: flags, expiresAt: Date.now() + CACHE_TTL_MS };
    pending = null;
    return flags;
  });

  if (!forceRefresh) {
    pending = loader;
  }

  return loader;
}

export async function isFeatureFlagEnabled(
  key: FeatureFlagKey,
  options: LoadOptions = {},
): Promise<boolean> {
  const flags = await getFeatureFlags(options);
  return flags[key];
}

export async function requireOfficialEtsyApiEnabled(options: LoadOptions = {}): Promise<boolean> {
  return isFeatureFlagEnabled("require_official_etsy_api", options);
}

export async function allowSearchSamplingEnabled(options: LoadOptions = {}): Promise<boolean> {
  return isFeatureFlagEnabled("allow_search_sampling", options);
}

export async function allowUserTelemetryEnabled(options: LoadOptions = {}): Promise<boolean> {
  return isFeatureFlagEnabled("allow_user_telemetry", options);
}
