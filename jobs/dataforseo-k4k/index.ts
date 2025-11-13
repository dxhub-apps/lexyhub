#!/usr/bin/env node
/**
 * DataForSEO Keywords For Keywords (Standard) Ingestion Job
 *
 * Expands keyword seeds using DataForSEO Google Ads Keywords For Keywords API
 * and upserts normalized results into LexyHub database.
 *
 * Usage:
 *   tsx jobs/dataforseo-k4k/index.ts
 *
 * Environment variables - see config.ts for full list
 */

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { logger, logJobExecution } from "@/lib/logger";
import { loadConfig, validateConfig } from "./config";
import { DataForSEOClient, ConcurrencyLimiter } from "./client";
import { DirectTaskPoller } from "./poller-direct";
import { normalizeDataForSEOBatch } from "./normalize";
import {
  fetchKeywordSeeds,
  updateSeedsLastRun,
  insertRawSource,
  upsertKeywordsBatch,
  taskAlreadyProcessed,
  getKeywordSeedsCount,
} from "./supabase";
import type {
  KeywordSeed,
  LocaleGroup,
  TaskChunk,
  DataForSEOTaskRequest,
  TaskState,
  RunSummary,
  RawSourcePayload,
} from "./types";

const INGEST_BATCH_ID = crypto.randomUUID();
const SOURCE_NAME = "dataforseo_google_ads_k4k_standard";
// IMPORTANT: This is only for INITIAL estimation. Actual costs from DataForSEO API
// (which can vary, e.g., $0.05 for Google Ads K4K) are accumulated and reported
// in the final summary. Do not rely on this constant for accurate cost tracking.
const COST_PER_TASK_USD = 0.0012; // Initial estimate only - actual costs vary by API endpoint

/**
 * Group seeds by locale (language_code + location_code)
 */
function groupSeedsByLocale(
  seeds: KeywordSeed[],
  defaultLanguage: string,
  defaultLocation: string
): LocaleGroup[] {
  const groups = new Map<string, LocaleGroup>();

  for (const seed of seeds) {
    const languageCode = seed.language_code || defaultLanguage;
    const locationCode = seed.location_code || defaultLocation;
    const key = `${languageCode}:${locationCode}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        languageCode,
        locationCode,
        seeds: [],
      };
      groups.set(key, group);
    }

    group.seeds.push(seed);
  }

  return Array.from(groups.values());
}

/**
 * Chunk locale group into task batches
 */
function chunkLocaleGroup(
  group: LocaleGroup,
  maxTermsPerTask: number
): TaskChunk[] {
  const chunks: TaskChunk[] = [];
  const keywords = group.seeds.map((s) => s.term);

  for (let i = 0; i < keywords.length; i += maxTermsPerTask) {
    const chunkKeywords = keywords.slice(i, i + maxTermsPerTask);
    chunks.push({
      localeGroup: group,
      keywords: chunkKeywords,
      languageCode: group.languageCode,
      locationCode: group.locationCode,
    });
  }

  return chunks;
}

/**
 * Build DataForSEO task request from chunk
 * NOTE: K4K endpoint does NOT support device/search_partners.
 * Those are kept only in our own metadata, not sent to DataForSEO.
 */
function buildTaskRequest(
  chunk: TaskChunk,
  config: ReturnType<typeof loadConfig>
): DataForSEOTaskRequest {
  return {
    language_code: chunk.languageCode,
    location_code: chunk.locationCode,
    keywords: chunk.keywords,
    include_adult_keywords: config.k4kIncludeAdult,
  };
}

/**
 * Main job execution
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  // Load and validate configuration
  const config = loadConfig();
  validateConfig(config);

  // Set log level
  process.env.LOG_LEVEL = config.logLevel;

  logJobExecution("dataforseo-k4k", "started", undefined, {
    ingestBatchId: INGEST_BATCH_ID,
    dryRun: config.dryRun,
    batchMaxSeeds: config.batchMaxSeeds,
  });

  // Initialize clients
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Failed to initialize Supabase client");
  }

  const dataForSeoClient = new DataForSEOClient(
    config.dataforSeoLogin,
    config.dataforSeoPassword
  );

  // Fetch keyword seeds
  logger.info({}, `Fetching up to ${config.batchMaxSeeds} enabled keyword seeds`);
  const seeds = await fetchKeywordSeeds(supabase, config.batchMaxSeeds);

  if (seeds.length === 0) {
    logger.warn({}, "No enabled keyword seeds found, exiting");
    const summary: RunSummary = {
      ingestBatchId: INGEST_BATCH_ID,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      seedsRead: 0,
      localeGroups: 0,
      tasksPosted: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      rowsRawSaved: 0,
      rowsInserted: 0,
      rowsUpdated: 0,
      rowsSkippedInvalid: 0,
      estimatedCostUsd: 0,
    };
    logger.info(summary, "RUN_SUMMARY");
    return;
  }

  logger.info({}, `Fetched ${seeds.length} keyword seeds`);

  // Group by locale
  const localeGroups = groupSeedsByLocale(
    seeds,
    config.defaultLanguageCode,
    config.defaultLocationCode
  );
  logger.info({}, `Grouped into ${localeGroups.length} locale groups`);

  // Create task chunks
  const taskChunks: TaskChunk[] = [];
  for (const group of localeGroups) {
    const chunks = chunkLocaleGroup(group, config.k4kMaxTermsPerTask);
    taskChunks.push(...chunks);
  }

  logger.info(
    {},
    `Created ${taskChunks.length} task chunks (max ${config.k4kMaxTermsPerTask} terms per task)`
  );

  // Estimate cost
  const estimatedCostUsd = taskChunks.length * COST_PER_TASK_USD;
  logger.info(
    {
      taskCount: taskChunks.length,
      costPerTask: COST_PER_TASK_USD,
    },
    `Estimated cost: $${estimatedCostUsd.toFixed(4)} USD`
  );

  // DRY RUN check
  if (config.dryRun) {
    logger.warn({}, "DRY_RUN mode enabled, not posting tasks or writing to database");
    const summary: RunSummary = {
      ingestBatchId: INGEST_BATCH_ID,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      seedsRead: seeds.length,
      localeGroups: localeGroups.length,
      tasksPosted: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      rowsRawSaved: 0,
      rowsInserted: 0,
      rowsUpdated: 0,
      rowsSkippedInvalid: 0,
      estimatedCostUsd,
    };
    logger.info(summary, "RUN_SUMMARY (DRY_RUN)");
    return;
  }

  // Post tasks with concurrency limit
  logger.info({}, `Posting ${taskChunks.length} tasks to DataForSEO`);
  const postLimiter = new ConcurrencyLimiter<TaskChunk, TaskState>(
    config.concurrencyTaskPost
  );

  const taskStates: TaskState[] = [];

  const postResults = await postLimiter.executeAll(
    async (chunk) => {
      const request = buildTaskRequest(chunk, config);
      const response = await dataForSeoClient.postTasks([request]);

      if (!response.tasks || response.tasks.length === 0) {
        throw new Error("No tasks returned from DataForSEO");
      }

      const task = response.tasks[0];
      // DataForSEO success codes are in range 20000-20999
      // 20000 = "Ok.", 20100 = "Task Created."
      if (task.status_code < 20000 || task.status_code >= 21000) {
        throw new Error(
          `Task post failed: ${task.status_message} (${task.status_code})`
        );
      }

      const taskState: TaskState = {
        taskId: task.id,
        status: "pending",
        chunk,
        postedAt: Date.now(),
      };

      logger.info(
        {
          taskId: task.id,
          locale: `${chunk.languageCode}:${chunk.locationCode}`,
          keywords_count: chunk.keywords.length,
          cost: task.cost,
        },
        "POSTED_TASK"
      );

      return taskState;
    },
    taskChunks
  );

  // Separate successful and failed posts
  for (const result of postResults) {
    if (result instanceof Error) {
      logger.error({ error: result }, `Task post failed: ${result.message}`);
    } else {
      taskStates.push(result);
    }
  }

  const tasksPosted = taskStates.length;
  logger.info({}, `Successfully posted ${tasksPosted}/${taskChunks.length} tasks`);

  if (tasksPosted === 0) {
    throw new Error("Failed to post any tasks to DataForSEO");
  }

  // Poll until tasks are ready using direct task_get polling
  // This is more reliable than the generic tasks_ready endpoint for Google Ads K4K
  const poller = new DirectTaskPoller(dataForSeoClient, {
    intervalMs: config.pollIntervalMs,
    timeoutMs: config.pollTimeoutMs,
  });

  poller.registerTasks(taskStates);
  const pollResult = await poller.pollUntilComplete();

  logger.info(
    {
      completed: pollResult.completed.length,
      failed: pollResult.failed.length,
      timedOut: pollResult.timedOut.length,
    },
    "Poll result"
  );

  // Fetch and persist results
  const getLimiter = new ConcurrencyLimiter<TaskState, void>(
    config.concurrencyTaskGet
  );

  let rowsRawSaved = 0;
  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsSkippedInvalid = 0;
  let actualCostUsd = 0; // Track actual API costs

  await getLimiter.executeAll(
    async (taskState) => {
      try {
        // Check if already processed
        const alreadyProcessed = await taskAlreadyProcessed(
          supabase,
          taskState.taskId
        );
        if (alreadyProcessed) {
          logger.debug({}, `Task ${taskState.taskId} already processed, skipping`);
          return;
        }

        // Fetch result
        const response = await dataForSeoClient.getTaskResult(taskState.taskId);

        // Log full response for debugging
        logger.info(
          {
            taskId: taskState.taskId,
            full_response: JSON.stringify(response, null, 2),
          },
          "FULL_TASK_GET_RESPONSE"
        );

        if (!response.tasks || response.tasks.length === 0) {
          logger.error(
            {
              taskId: taskState.taskId,
              full_response: JSON.stringify(response, null, 2),
            },
            "No tasks array in response"
          );
          throw new Error("No task result returned");
        }

        const taskResult = response.tasks[0];

        // Log parsed task result
        logger.info(
          {
            taskId: taskState.taskId,
            status_code: taskResult.status_code,
            status_message: taskResult.status_message,
            result_count: taskResult.result_count,
            result_length: taskResult.result?.length || 0,
            cost: taskResult.cost,
            path: taskResult.path,
          },
          "PARSED_TASK_RESULT"
        );

        // CRITICAL: Validate status_code == 20000 for successful tasks
        if (taskResult.status_code !== 20000) {
          logger.error(
            {
              taskId: taskState.taskId,
              status_code: taskResult.status_code,
              status_message: taskResult.status_message,
              full_task_result: JSON.stringify(taskResult, null, 2),
            },
            `Task failed with status_code ${taskResult.status_code}: ${taskResult.status_message}`
          );
          throw new Error(
            `Task status_code ${taskResult.status_code}: ${taskResult.status_message}`
          );
        }

        const items = taskResult.result || [];

        // Accumulate actual cost from API
        if (taskResult.cost) {
          actualCostUsd += taskResult.cost;
        }

        logger.info(
          {
            taskId: taskState.taskId,
            status_code: taskResult.status_code,
            items_count: items.length,
            cost: taskResult.cost,
            accumulated_cost: actualCostUsd,
            sample_items: items.slice(0, 2).map((item) => ({
              keyword: item.keyword,
              search_volume: item.search_volume,
              cpc: item.cpc,
            })),
          },
          "FETCH_RESULT"
        );

        // Log full response if zero results
        if (items.length === 0) {
          logger.warn(
            {
              taskId: taskState.taskId,
              full_response: JSON.stringify(taskResult, null, 2),
            },
            "Task returned zero results - logging full API response for debugging"
          );
        }

        // Save raw source
        const rawPayload: RawSourcePayload = {
          provider: "dataforseo",
          source_type: "google_ads_keywords_for_keywords_standard",
          source_key: taskState.taskId,
          status: "completed",
          payload: taskResult,
          metadata: {
            language_code: taskState.chunk.languageCode,
            location_code: taskState.chunk.locationCode,
            device: config.k4kDevice,
            search_partners: config.k4kSearchPartners,
            include_adult: config.k4kIncludeAdult,
            posted_keywords_count: taskState.chunk.keywords.length,
            received_items_count: items.length,
            provider_run_ts: taskResult.time,
            ingest_batch_id: INGEST_BATCH_ID,
          },
        };

        logger.info(
          {
            taskId: taskState.taskId,
            raw_payload_preview: {
              provider: rawPayload.provider,
              source_type: rawPayload.source_type,
              source_key: rawPayload.source_key,
              status: rawPayload.status,
              items_count: items.length,
              metadata: rawPayload.metadata,
            },
          },
          "INSERTING_RAW_SOURCE"
        );

        const rawSourceId = await insertRawSource(supabase, rawPayload);
        if (rawSourceId) {
          rowsRawSaved++;
          logger.info(
            { taskId: taskState.taskId, rawSourceId },
            "RAW_SOURCE_INSERTED"
          );
        } else {
          logger.warn(
            { taskId: taskState.taskId },
            "RAW_SOURCE_DUPLICATE_SKIPPED"
          );
        }

        // Normalize keywords
        logger.info(
          {
            taskId: taskState.taskId,
            items_to_normalize: items.length,
            market: config.lexyHubMarket,
            source: SOURCE_NAME,
            batch_id: INGEST_BATCH_ID,
          },
          "STARTING_NORMALIZATION"
        );

        const { valid, skipped } = normalizeDataForSEOBatch(
          items,
          config.lexyHubMarket,
          SOURCE_NAME,
          INGEST_BATCH_ID
        );

        rowsSkippedInvalid += skipped;

        logger.info(
          {
            taskId: taskState.taskId,
            valid_count: valid.length,
            skipped_count: skipped,
            sample_valid: valid.slice(0, 2).map((k) => ({
              term: k.termNorm,
              source: k.source,
              batch_id: k.ingestBatchId,
              search_volume: k.searchVolume,
            })),
          },
          "NORMALIZATION_COMPLETE"
        );

        if (valid.length === 0) {
          logger.warn(
            { taskId: taskState.taskId, skipped },
            `No valid keywords in task ${taskState.taskId}`
          );
          return;
        }

        // Upsert keywords
        logger.info(
          {
            taskId: taskState.taskId,
            keywords_to_upsert: valid.length,
            rawSourceId,
          },
          "STARTING_KEYWORD_UPSERT"
        );

        const upsertResult = await upsertKeywordsBatch(
          supabase,
          valid,
          rawSourceId
        );

        rowsInserted += upsertResult.inserted;
        rowsUpdated += upsertResult.updated;

        logger.info(
          {
            taskId: taskState.taskId,
            inserted: upsertResult.inserted,
            updated: upsertResult.updated,
            failed: upsertResult.failed,
            skipped: skipped,
          },
          "UPSERT_SUMMARY"
        );
      } catch (error: any) {
        logger.error(
          {
            taskId: taskState.taskId,
            error,
          },
          `Failed to process task ${taskState.taskId}: ${error.message}`
        );

        // Save failed raw source
        const rawPayload: RawSourcePayload = {
          provider: "dataforseo",
          source_type: "google_ads_keywords_for_keywords_standard",
          source_key: taskState.taskId,
          status: "failed",
          payload: {},
          metadata: {
            language_code: taskState.chunk.languageCode,
            location_code: taskState.chunk.locationCode,
            device: config.k4kDevice,
            search_partners: config.k4kSearchPartners,
            include_adult: config.k4kIncludeAdult,
            posted_keywords_count: taskState.chunk.keywords.length,
            received_items_count: 0,
            provider_run_ts: new Date().toISOString(),
            ingest_batch_id: INGEST_BATCH_ID,
          },
          error: error.message,
        };

        await insertRawSource(supabase, rawPayload).catch((err) => {
          logger.warn({}, `Failed to save error raw source: ${err.message}`);
        });
      }
    },
    pollResult.completed
  );

  // Update seed timestamps
  const seedIds = seeds.map((s) => s.id);
  await updateSeedsLastRun(supabase, seedIds);

  // Enrich metrics for newly upserted keywords
  logger.info({}, "Starting DataForSEO K4K metrics enrichment");
  const enrichmentStartTime = Date.now();

  try {
    const { data: enrichmentResult, error: enrichmentError } = await supabase.rpc(
      "enrich_dataforseo_k4k_metrics",
      {
        p_where_clause: `freshness_ts >= '${startedAt}'::timestamptz`,
        p_limit: null,
        p_dry_run: false,
      }
    );

    if (enrichmentError) {
      logger.error(
        { error: enrichmentError },
        `Enrichment failed: ${enrichmentError.message}`
      );
      // Non-fatal: continue with summary
    } else if (enrichmentResult) {
      const enrichmentDurationMs = Date.now() - enrichmentStartTime;
      logger.info(
        {
          processedCount: enrichmentResult.processed_count,
          updatedCount: enrichmentResult.updated_count,
          durationMs: enrichmentDurationMs,
          normalizers: {
            p99_avg: enrichmentResult.p99_avg,
            max_abs_slope_raw: enrichmentResult.max_abs_slope_raw,
            max_abs_slope_des: enrichmentResult.max_abs_slope_des,
          },
        },
        "ENRICHMENT_COMPLETE"
      );
    }
  } catch (error: any) {
    logger.error({ error }, `Enrichment exception: ${error.message}`);
    // Non-fatal: continue with summary
  }

  // Final summary
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  const summary: RunSummary = {
    ingestBatchId: INGEST_BATCH_ID,
    startedAt,
    completedAt,
    durationMs,
    seedsRead: seeds.length,
    localeGroups: localeGroups.length,
    tasksPosted,
    tasksCompleted: pollResult.completed.length,
    tasksFailed: pollResult.failed.length + pollResult.timedOut.length,
    rowsRawSaved,
    rowsInserted,
    rowsUpdated,
    rowsSkippedInvalid,
    estimatedCostUsd: actualCostUsd > 0 ? actualCostUsd : estimatedCostUsd, // Use actual cost if available
  };

  logger.info(
    {
      ...summary,
      initialEstimate: estimatedCostUsd,
      actualCost: actualCostUsd,
      costDifference:
        actualCostUsd > 0 ? actualCostUsd - estimatedCostUsd : 0,
    },
    "RUN_SUMMARY"
  );

  logJobExecution(
    "dataforseo-k4k",
    "completed",
    durationMs,
    summary as unknown as Record<string, unknown>
  );

  // Determine exit code
  if (pollResult.failed.length > 0 || pollResult.timedOut.length > 0) {
    logger.warn(
      {},
      `Job completed with ${pollResult.failed.length} failed and ${pollResult.timedOut.length} timed out tasks`
    );
    process.exit(2); // Partial success
  }
}

// Execute main
main().catch((error) => {
  logger.error({ error }, "DataForSEO K4K ingestion job failed");
  logJobExecution("dataforseo-k4k", "failed", undefined, {
    error: error.message,
  });
  process.exit(1);
});
