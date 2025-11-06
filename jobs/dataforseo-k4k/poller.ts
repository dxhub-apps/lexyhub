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
 * Poll DataForSEO tasks_ready endpoint until all tasks are completed or timeout
 */
export class TaskPoller {
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
      `[TaskPoller] Registered ${tasks.length} tasks for polling`
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
   * Poll once and update task states
   */
  private async pollOnce(): Promise<void> {
    try {
      const response = await this.client.getTasksReady();

      if (!response.tasks || response.tasks.length === 0) {
        return;
      }

      // Update status for ready tasks
      for (const readyTask of response.tasks) {
        const taskState = this.tasks.get(readyTask.id);
        if (taskState && taskState.status === "pending") {
          taskState.status = "completed";
          taskState.completedAt = Date.now();
          logger.info({
            taskId: readyTask.id,
            durationMs: taskState.completedAt - taskState.postedAt,
          }, `[TaskPoller] Task ready: ${readyTask.id}`);
        }
      }
    } catch (error: any) {
      logger.warn({ error }, `[TaskPoller] Poll failed: ${error.message}`);
      // Don't throw - continue polling
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
      `[TaskPoller] Starting poll loop (interval=${this.config.intervalMs}ms, timeout=${this.config.timeoutMs}ms)`
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
          `[TaskPoller] Timeout exceeded with ${pending} tasks still pending`
        );
        break;
      }

      // Poll
      await this.pollOnce();

      // Log progress
      const pendingCount = this.getPendingCount();
      if (pendingCount > 0) {
        const elapsed = Date.now() - this.startTime;
        logger.debug(
          { pendingCount, elapsedMs: elapsed },
          `[TaskPoller] ${pendingCount} tasks pending (elapsed ${Math.round(elapsed / 1000)}s)`
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
    }, "[TaskPoller] Poll complete");

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
      }, `[TaskPoller] Task failed: ${taskId}`);
    }
  }
}
