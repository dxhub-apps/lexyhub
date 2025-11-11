import type {
  DataForSEOTaskPostResponse,
  DataForSEOTasksReadyResponse,
  DataForSEOTaskGetResponse,
  DataForSEOTaskRequest,
} from "./types";

const BASE_URL = "https://api.dataforseo.com";
const USER_AGENT = "LexyHub-K4K-Standard/1.0";
const RESPONSE_TIMEOUT_MS = 60000;

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterMs: 500,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions
): number {
  const exponentialDelay = Math.min(
    options.baseDelayMs * Math.pow(2, attempt),
    options.maxDelayMs
  );
  const jitter = Math.random() * options.jitterMs;
  return exponentialDelay + jitter;
}

/**
 * Check if error is retryable
 */
function isRetryableError(
  statusCode: number | undefined,
  error: any
): boolean {
  // Retry on 429 (rate limit) and 5xx (server errors)
  if (statusCode === 429 || (statusCode && statusCode >= 500)) {
    return true;
  }

  // Retry on common network errors
  if (error && typeof error === "object") {
    const code = (error as any).code;
    const retryableNetworkErrors = [
      "ECONNRESET",
      "ENOTFOUND",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "EAI_AGAIN",
    ];
    if (retryableNetworkErrors.includes(code)) {
      return true;
    }
  }

  return false;
}

/**
 * DataForSEO API client with retry logic
 */
export class DataForSEOClient {
  private authHeader: string;

  constructor(login: string, password: string) {
    this.authHeader = `Basic ${Buffer.from(
      `${login}:${password}`
    ).toString("base64")}`;
  }

  /**
   * Execute HTTP request with retries
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    retryOptions: RetryOptions = DEFAULT_RETRY_OPTIONS
  ): Promise<T> {
    let lastError: any = null;
    let lastStatusCode: number | undefined;

    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          RESPONSE_TIMEOUT_MS
        );

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            ...(options.headers || {}),
            Authorization: this.authHeader,
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
          },
        });

        clearTimeout(timeoutId);
        lastStatusCode = response.status;

        // Success
        if (response.ok) {
          return (await response.json()) as T;
        }

        const errorText = await response.text();

        // Non-retryable client error (4xx except 429)
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          throw new Error(
            `DataForSEO API error ${response.status}: ${errorText}`
          );
        }

        // Retryable error
        lastError = new Error(
          `DataForSEO API error ${response.status}: ${errorText}`
        );

        if (attempt === retryOptions.maxRetries) {
          throw lastError;
        }

        if (isRetryableError(response.status, null)) {
          const delay = calculateBackoffDelay(attempt, retryOptions);
          console.warn(
            `[DataForSEO] Request failed with ${
              response.status
            }, retrying in ${Math.round(
              delay
            )}ms (attempt ${attempt + 1}/${retryOptions.maxRetries})`
          );
          await sleep(delay);
          continue;
        }

        throw lastError;
      } catch (error: any) {
        lastError = error;

        if (attempt === retryOptions.maxRetries) {
          throw error;
        }

        if (isRetryableError(lastStatusCode, error)) {
          const delay = calculateBackoffDelay(attempt, retryOptions);
          console.warn(
            `[DataForSEO] Request failed with ${
              error.message || error
            }, retrying in ${Math.round(
              delay
            )}ms (attempt ${attempt + 1}/${retryOptions.maxRetries})`
          );
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error("Request failed after all retries");
  }

  /**
   * Post tasks to DataForSEO Keywords For Keywords Standard queue
   */
  async postTasks(
    tasks: DataForSEOTaskRequest[]
  ): Promise<DataForSEOTaskPostResponse> {
    const url = `${BASE_URL}/v3/keywords_data/google_ads/keywords_for_keywords/task_post`;
    return this.fetchWithRetry<DataForSEOTaskPostResponse>(url, {
      method: "POST",
      body: JSON.stringify(tasks),
    });
  }

  /**
   * Get list of ready tasks for the K4K queue
   */
  async getTasksReady(): Promise<DataForSEOTasksReadyResponse> {
    const url = `${BASE_URL}/v3/keywords_data/google_ads/keywords_for_keywords/tasks_ready`;
    return this.fetchWithRetry<DataForSEOTasksReadyResponse>(url, {
      method: "GET",
    });
  }

  /**
   * Get results for a specific task (standard endpoint)
   */
  async getTaskResult(taskId: string): Promise<DataForSEOTaskGetResponse> {
    const url = `${BASE_URL}/v3/keywords_data/google_ads/keywords_for_keywords/task_get/${taskId}`;
    console.log(`[DataForSEO] GET ${url}`);

    try {
      const response =
        await this.fetchWithRetry<DataForSEOTaskGetResponse>(url, {
          method: "GET",
        });

      if (response.status_code !== 20000) {
        console.error(
          `[DataForSEO] task_get failed for ${taskId}:`,
          JSON.stringify(
            {
              url,
              status_code: response.status_code,
              status_message: response.status_message,
              cost: response.cost,
              tasks_count: response.tasks_count,
              tasks_error: response.tasks_error,
              tasks: response.tasks?.map((t) => ({
                id: t.id,
                status_code: t.status_code,
                status_message: t.status_message,
                path: t.path,
              })),
            },
            null,
            2
          )
        );
      }

      return response;
    } catch (error: any) {
      console.error(`[DataForSEO] task_get exception for ${taskId}:`, {
        url,
        error: error.message || String(error),
        stack: error.stack,
      });
      throw error;
    }
  }
}

/**
 * Concurrency limiter for parallel operations
 */
export class ConcurrencyLimiter<T> {
  private maxConcurrent: number;
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Execute function with concurrency limit
   */
  async execute<R>(
    fn: (item: T) => Promise<R>,
    item: T
  ): Promise<R> {
    while (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.running++;

    try {
      return await fn(item);
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  /**
   * Execute all items with concurrency limit
   */
  async executeAll<R>(
    fn: (item: T) => Promise<R>,
    items: T[]
  ): Promise<(R | Error)[]> {
    return Promise.all(
      items.map((item) =>
        this.execute(fn, item).catch((error: any) => error as Error)
      )
    );
  }
}
