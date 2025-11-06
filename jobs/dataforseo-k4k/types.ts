/**
 * TypeScript type definitions for DataForSEO Keywords For Keywords ingestion
 */

export interface IngestConfig {
  // DataForSEO credentials
  dataforSeoLogin: string;
  dataforSeoPassword: string;

  // Database connection
  pgHost?: string;
  pgPort?: number;
  pgDatabase?: string;
  pgUser?: string;
  pgPassword?: string;
  pgSsl: boolean;

  // Supabase (alternative to direct PG)
  supabaseUrl?: string;
  supabaseServiceKey?: string;

  // Business logic config
  lexyHubMarket: string;
  defaultLanguageCode: string;
  defaultLocationCode: string;
  k4kMaxTermsPerTask: number;
  k4kDevice: 'desktop' | 'mobile' | 'tablet';
  k4kSearchPartners: boolean;
  k4kIncludeAdult: boolean;

  // Batch & concurrency limits
  batchMaxSeeds: number;
  concurrencyTaskPost: number;
  concurrencyTaskGet: number;

  // Polling config
  pollIntervalMs: number;
  pollTimeoutMs: number;

  // Execution modes
  dryRun: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface KeywordSeed {
  id: string;
  term: string;
  language_code: string | null;
  location_code: string | null;
  market: string;
  enabled: boolean;
}

export interface LocaleGroup {
  languageCode: string;
  locationCode: string;
  seeds: KeywordSeed[];
}

export interface TaskChunk {
  localeGroup: LocaleGroup;
  keywords: string[];
  languageCode: string;
  locationCode: string;
}

export interface DataForSEOTaskRequest {
  language_code: string;
  location_code: string;
  keywords: string[];
  device?: string;
  search_partners?: boolean;
  include_adult_keywords?: boolean;
}

export interface DataForSEOTaskPostResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: {
      api: string;
      function: string;
      se: string;
      language_code: string;
      location_code: number;
      keywords: string[];
      device?: string;
      search_partners?: boolean;
      include_adult_keywords?: boolean;
    };
    result: null;
  }>;
}

export interface DataForSEOTasksReadyResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    se: string;
    se_type: string;
    date_posted: string;
    tag: string;
    endpoint_regular: string;
    endpoint_advanced: string;
    endpoint_html: string;
  }>;
}

export interface DataForSEOKeywordItem {
  keyword: string;
  location_code: number;
  language_code: string;
  search_partners: boolean;
  competition: number;
  competition_level: string;
  cpc: number;
  search_volume: number;
  categories: number[];
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number;
  }> | null;
}

export interface DataForSEOTaskGetResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: {
      api: string;
      function: string;
      se: string;
      language_code: string;
      location_code: number;
      keywords: string[];
    };
    result: Array<{
      keyword: string;
      location_code: number;
      language_code: string;
      search_partners: boolean;
      competition: number;
      competition_level: string;
      cpc: number;
      search_volume: number;
      categories: number[];
      monthly_searches: Array<{
        year: number;
        month: number;
        search_volume: number;
      }> | null;
    }> | null;
  }>;
}

export interface NormalizedKeyword {
  termNorm: string;
  termOriginal: string;
  locale: string;
  market: string;
  source: string;
  ingestBatchId: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  monthlyTrend: Array<{
    year: number;
    month: number;
    searches: number;
  }> | null;
}

export interface RawSourcePayload {
  provider: string;
  source_type: string;
  source_key: string;
  status: 'queued' | 'completed' | 'failed';
  payload: Record<string, any>;
  metadata: {
    language_code: string;
    location_code: string;
    device: string;
    search_partners: boolean;
    include_adult: boolean;
    posted_keywords_count: number;
    received_items_count: number;
    provider_run_ts: string;
    ingest_batch_id: string;
  };
  error?: string;
}

export interface TaskState {
  taskId: string;
  status: 'pending' | 'completed' | 'failed';
  chunk: TaskChunk;
  postedAt: number;
  completedAt?: number;
  error?: string;
}

export interface RunSummary {
  ingestBatchId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  seedsRead: number;
  localeGroups: number;
  tasksPosted: number;
  tasksCompleted: number;
  tasksFailed: number;
  rowsRawSaved: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkippedInvalid: number;
  estimatedCostUsd: number;
}
