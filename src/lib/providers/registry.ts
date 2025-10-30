import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type KeywordSourceProvider,
  type ProviderContext,
  type ProviderRefreshOptions,
  type ProviderRefreshResult,
  defaultProviderLogger,
  resolveProviderSupabase,
} from "./base";

type RegistryEntry = {
  provider: KeywordSourceProvider;
  lastRun?: ProviderRefreshResult;
  running: boolean;
};

async function recordJobRun(
  supabase: SupabaseClient | null,
  result: ProviderRefreshResult,
): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    const durationMs = result.finishedAt.getTime() - result.startedAt.getTime();
    await supabase.from("job_runs").insert({
      job_name: `provider:${result.providerId}`,
      status: result.status,
      started_at: result.startedAt.toISOString(),
      finished_at: result.finishedAt.toISOString(),
      records_processed: result.keywordsProcessed,
      tokens_consumed: result.tokensConsumed,
      metadata: {
        suggestionsEvaluated: result.suggestionsEvaluated,
        durationMs,
        ...result.metadata,
      },
    });
  } catch (error) {
    console.warn("Failed to record provider job run", error);
  }
}

export class ProviderRegistry {
  private readonly entries = new Map<string, RegistryEntry>();

  register(provider: KeywordSourceProvider): void {
    if (this.entries.has(provider.id)) {
      throw new Error(`Provider with id "${provider.id}" already registered`);
    }
    this.entries.set(provider.id, { provider, running: false });
  }

  get(id: string): KeywordSourceProvider | undefined {
    return this.entries.get(id)?.provider;
  }

  list(): KeywordSourceProvider[] {
    return Array.from(this.entries.values()).map((entry) => entry.provider);
  }

  async refreshProvider(
    id: string,
    context?: ProviderContext,
    options?: ProviderRefreshOptions,
  ): Promise<ProviderRefreshResult> {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Unknown provider: ${id}`);
    }

    if (entry.running) {
      return {
        providerId: id,
        keywordsProcessed: 0,
        keywordsUpserted: 0,
        suggestionsEvaluated: 0,
        tokensConsumed: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        status: "skipped",
        error: "Provider refresh already running",
      };
    }

    entry.running = true;
    const logger = context?.logger ?? defaultProviderLogger;
    const startedAt = new Date();

    try {
      logger.log({ providerId: id, event: "refresh", occurredAt: startedAt });
      const result = await entry.provider.refresh(context, options);
      entry.lastRun = result;
      await recordJobRun(resolveProviderSupabase(context), result);
      return result;
    } catch (error) {
      const finishedAt = new Date();
      const failure: ProviderRefreshResult = {
        providerId: id,
        keywordsProcessed: 0,
        keywordsUpserted: 0,
        suggestionsEvaluated: 0,
        tokensConsumed: 0,
        startedAt,
        finishedAt,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
      await recordJobRun(resolveProviderSupabase(context), failure);
      if (logger.error) {
        logger.error({
          providerId: id,
          event: "error",
          error: error instanceof Error ? error : String(error),
          occurredAt: finishedAt,
        });
      }
      throw error;
    } finally {
      entry.running = false;
    }
  }

  async refreshAll(
    context?: ProviderContext,
    options?: ProviderRefreshOptions,
  ): Promise<ProviderRefreshResult[]> {
    const results: ProviderRefreshResult[] = [];
    for (const provider of this.list()) {
      const result = await this.refreshProvider(provider.id, context, options);
      results.push(result);
    }
    return results;
  }
}

export function createProviderRegistry(providers: KeywordSourceProvider[] = []): ProviderRegistry {
  const registry = new ProviderRegistry();
  for (const provider of providers) {
    registry.register(provider);
  }
  return registry;
}
