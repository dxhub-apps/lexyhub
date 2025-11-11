import type { DataForSEOClient } from "./client";
import type { TaskState } from "./types";
import { logger } from "@/lib/logger";

export interface PollerConfig {
  intervalMs: number;
  timeoutMs: number;
}

export interface PollResult {
  completed: TaskState[];
  failed: TaskState[];
  timedOut: TaskState[];
}

/**
 * Poll DataForSEO task_get endpoint directly for each task until completion or timeout
 *
 * This is more reliable than tasks_ready for Google Ads K4K tasks
 */
export class DirectTaskPoller {
  private client: DataForSEOClient;
  private config: PollerConfig;
  private tasks: Map<string, TaskState>;
  private startTime: number;

  constructor(client: DataForSEOClient, config: PollerConfig) {
    this.client = client;
    this.config = config;
    this.tasks = new Map();
    this.startTime = Date.now();
  }

  /**
   * Register tasks to track
   */
  registerTasks(tasks: TaskState[]): void {
    for (const task of tasks) {
      this.tasks.set(task.taskId, task);
    }
    logger.info(
      { taskIds: tasks.map((t) => t.taskId) },
      `[DirectTaskPoller] Registered ${tasks.length} tasks for polling`
    );
  }

  /**
   * Check if polling should timeout
   */
  private shouldTimeout(): boolean {
    const elapsed = Date.now() - this.startTime;
    return elapsed >= this.config.timeoutMs;
  }

  /**
   * Get count of pending tasks
   */
  private getPendingCount(): number {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.status === "pending") {
        count++;
      }
    }
    return count;
  }

  /**
   * Sleep for interval
   */
  private async sleep(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.config.intervalMs));
  }

  /**
   * Check status of a single task by calling task_get
   */
  private async checkTaskStatus(taskId: string): Promise<void> {
    try {
      const response = await this.client.getTaskResult(taskId);

      if (!response.tasks || response.tasks.length === 0) {
        logger.warn({ taskId }, `[DirectTaskPoller] No tasks in response for ${taskId}`);
        return;
      }

      const taskResult = response.tasks[0];
      const taskState = this.tasks.get(taskId);

      if (!taskState) {
        logger.warn({ taskId }, `[DirectTaskPoller] Task ${taskId} not found in registry`);
        return;
      }

      // Only update if still pending
      if (taskState.status !== "pending") {
        return;
      }

      /**
       * DataForSEO status codes:
       * - 20000: Ok (successful, result ready)
       * - 20100: Task created (still processing)
       * - 40602: Task In Queue (not ready yet, keep polling)
       * - 40404: No results yet / Still processing (keep polling)
       * - 40xxx: Client errors (auth, validation, quota)
       * - 50xxx: Server errors
       */
      if (taskResult.status_code === 20000) {
        // Task completed successfully
        taskState.status = "completed";
        taskState.completedAt = Date.now();
        logger.info({
          taskId,
          durationMs: taskState.completedAt - taskState.postedAt,
          resultCount: taskResult.result_count,
          cost: taskResult.cost,
        }, `[DirectTaskPoller] Task completed: ${taskId}`);
      } else if (taskResult.status_code === 20100) {
        // Task still processing - keep polling
        logger.debug({ taskId, status_code: taskResult.status_code }, `[DirectTaskPoller] Task ${taskId} still processing (20100)`);
      } else if (taskResult.status_code === 40602 || taskResult.status_code === 40404) {
        // Task in queue or no results yet - NOT a failure, keep polling
        logger.debug({
          taskId,
          status_code: taskResult.status_code,
          status_message: taskResult.status_message
        }, `[DirectTaskPoller] Task ${taskId} still pending (${taskResult.status_code}: ${taskResult.status_message})`);
      } else if (taskResult.status_code >= 40000) {
        // Task failed (client or server error)
        taskState.status = "failed";
        taskState.error = `${taskResult.status_message} (${taskResult.status_code})`;
        taskState.completedAt = Date.now();

        // Special logging for 50301 errors (invalid argument)
        if (taskResult.status_code === 50301) {
          logger.error({
            taskId,
            status_code: taskResult.status_code,
            status_message: taskResult.status_message,
            error: taskState.error,
            full_task_result: taskResult,
            task_data: taskResult.data,
            task_path: taskResult.path,
          }, `[DirectTaskPoller] Task failed with 50301 (Invalid Argument) - possible endpoint mismatch: ${taskId}`);
        } else {
          logger.error({
            taskId,
            status_code: taskResult.status_code,
            status_message: taskResult.status_message,
            error: taskState.error,
          }, `[DirectTaskPoller] Task failed: ${taskId}`);
        }
      } else {
        // Unknown status code - log and keep polling
        logger.warn({
          taskId,
          status_code: taskResult.status_code,
          status_message: taskResult.status_message,
        }, `[DirectTaskPoller] Unknown status code ${taskResult.status_code} for task ${taskId}`);
      }
    } catch (error: any) {
      logger.warn({ taskId, error }, `[DirectTaskPoller] Failed to check task ${taskId}: ${error.message}`);
      // Don't mark as failed - might be transient network error
    }
  }

  /**
   * Poll all pending tasks once
   */
  private async pollOnce(): Promise<void> {
    const pendingTasks = Array.from(this.tasks.values()).filter(
      (t) => t.status === "pending"
    );

    // Check all pending tasks in parallel (with reasonable concurrency)
    const BATCH_SIZE = 10;
    for (let i = 0; i < pendingTasks.length; i += BATCH_SIZE) {
      const batch = pendingTasks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((task) => this.checkTaskStatus(task.taskId))
      );
    }
  }

  /**
   * Poll until all tasks complete or timeout
   */
  async pollUntilComplete(): Promise<PollResult> {
    logger.info(
      {
        totalTasks: this.tasks.size,
      },
      `[DirectTaskPoller] Starting poll loop (interval=${this.config.intervalMs}ms, timeout=${this.config.timeoutMs}ms)`
    );

    while (this.getPendingCount() > 0) {
      // Check timeout
      if (this.shouldTimeout()) {
        const pending = this.getPendingCount();
        logger.error(
          {
            timeoutMs: this.config.timeoutMs,
            pendingCount: pending,
          },
          `[DirectTaskPoller] Timeout exceeded with ${pending} tasks still pending`
        );
        break;
      }

      // Poll all pending tasks
      await this.pollOnce();

      // Log progress
      const pendingCount = this.getPendingCount();
      if (pendingCount > 0) {
        const elapsed = Date.now() - this.startTime;
        const completed = this.tasks.size - pendingCount;
        logger.debug(
          { pendingCount, completed, elapsedMs: elapsed },
          `[DirectTaskPoller] Progress: ${completed}/${this.tasks.size} completed, ${pendingCount} pending (elapsed ${Math.round(elapsed / 1000)}s)`
        );
      }

      // Sleep before next poll (if still pending)
      if (this.getPendingCount() > 0) {
        await this.sleep();
      }
    }

    // Categorize results
    const completed: TaskState[] = [];
    const failed: TaskState[] = [];
    const timedOut: TaskState[] = [];

    for (const task of this.tasks.values()) {
      if (task.status === "completed") {
        completed.push(task);
      } else if (task.status === "failed") {
        failed.push(task);
      } else if (task.status === "pending") {
        timedOut.push(task);
      }
    }

    logger.info({
      total: this.tasks.size,
      completed: completed.length,
      failed: failed.length,
      timedOut: timedOut.length,
      durationMs: Date.now() - this.startTime,
    }, "[DirectTaskPoller] Poll complete");

    return { completed, failed, timedOut };
  }

  /**
   * Mark a task as failed
   */
  markTaskFailed(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "failed";
      task.error = error;
      task.completedAt = Date.now();
      logger.warn({
        taskId,
        error,
      }, `[DirectTaskPoller] Task failed: ${taskId}`);
    }
  }
}
