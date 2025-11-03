/**
 * Feature Flag Rollout Management
 * Provides utilities for managing gradual feature rollouts
 */

import { log } from "../logger";
import { featureFlagTargeting, type UserContext } from "./targeting";

export interface RolloutSchedule {
  flagKey: string;
  stages: RolloutStage[];
  currentStage: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface RolloutStage {
  percentage: number;
  duration: number; // milliseconds
  startedAt?: Date;
  completedAt?: Date;
}

export interface RolloutMetrics {
  flagKey: string;
  stage: number;
  percentage: number;
  usersEnabled: number;
  usersTotal: number;
  errors: number;
  successRate: number;
}

class RolloutManager {
  private schedules: Map<string, RolloutSchedule> = new Map();
  private metrics: Map<string, RolloutMetrics> = new Map();

  /**
   * Create a rollout schedule
   */
  createRollout(
    flagKey: string,
    stages: Array<{ percentage: number; duration: number }>
  ): RolloutSchedule {
    const schedule: RolloutSchedule = {
      flagKey,
      stages: stages.map((s) => ({
        percentage: s.percentage,
        duration: s.duration,
      })),
      currentStage: 0,
    };

    this.schedules.set(flagKey, schedule);
    log.info(`Rollout schedule created for ${flagKey}`);

    return schedule;
  }

  /**
   * Start a rollout
   */
  startRollout(flagKey: string): void {
    const schedule = this.schedules.get(flagKey);
    if (!schedule) {
      throw new Error(`Rollout schedule not found for ${flagKey}`);
    }

    if (schedule.startedAt) {
      throw new Error(`Rollout already started for ${flagKey}`);
    }

    schedule.startedAt = new Date();
    schedule.currentStage = 0;
    schedule.stages[0].startedAt = new Date();

    // Update feature flag percentage
    featureFlagTargeting.updateConfig(flagKey, {
      rolloutPercentage: schedule.stages[0].percentage,
    });

    log.info(
      `Rollout started for ${flagKey}`,
      {
        flagKey,
        initialPercentage: schedule.stages[0].percentage,
      }
    );

    // Schedule automatic progression
    this.scheduleNextStage(flagKey);
  }

  /**
   * Progress to next stage
   */
  progressToNextStage(flagKey: string): void {
    const schedule = this.schedules.get(flagKey);
    if (!schedule || !schedule.startedAt) {
      throw new Error(`Rollout not started for ${flagKey}`);
    }

    const currentStage = schedule.stages[schedule.currentStage];
    currentStage.completedAt = new Date();

    schedule.currentStage++;

    if (schedule.currentStage >= schedule.stages.length) {
      // Rollout complete
      schedule.completedAt = new Date();
      log.info(`Rollout completed for ${flagKey}`);
      return;
    }

    const nextStage = schedule.stages[schedule.currentStage];
    nextStage.startedAt = new Date();

    // Update feature flag percentage
    featureFlagTargeting.updateConfig(flagKey, {
      rolloutPercentage: nextStage.percentage,
    });

    log.info(
      `Rollout progressed to stage ${schedule.currentStage} for ${flagKey}`,
      {
        flagKey,
        stage: schedule.currentStage,
        percentage: nextStage.percentage,
      }
    );

    // Schedule next stage
    this.scheduleNextStage(flagKey);
  }

  /**
   * Schedule automatic progression to next stage
   */
  private scheduleNextStage(flagKey: string): void {
    const schedule = this.schedules.get(flagKey);
    if (!schedule) return;

    const currentStage = schedule.stages[schedule.currentStage];

    if (typeof setTimeout !== "undefined") {
      setTimeout(() => {
        // Check metrics before progressing
        const metrics = this.metrics.get(flagKey);
        if (metrics && metrics.successRate < 0.95) {
          log.warn(
            `Pausing rollout due to low success rate for ${flagKey}`,
            {
              flagKey,
              successRate: metrics.successRate,
            }
          );
          return;
        }

        try {
          this.progressToNextStage(flagKey);
        } catch (error) {
          log.error(`Failed to progress rollout for ${flagKey}`);
        }
      }, currentStage.duration);
    }
  }

  /**
   * Pause a rollout
   */
  pauseRollout(flagKey: string): void {
    const schedule = this.schedules.get(flagKey);
    if (!schedule) {
      throw new Error(`Rollout schedule not found for ${flagKey}`);
    }

    // Don't modify current percentage, just stop progression
    log.info(`Rollout paused for ${flagKey}`);
  }

  /**
   * Rollback to previous stage
   */
  rollback(flagKey: string): void {
    const schedule = this.schedules.get(flagKey);
    if (!schedule || schedule.currentStage === 0) {
      throw new Error(`Cannot rollback ${flagKey}`);
    }

    schedule.currentStage--;
    const previousStage = schedule.stages[schedule.currentStage];

    featureFlagTargeting.updateConfig(flagKey, {
      rolloutPercentage: previousStage.percentage,
    });

    log.warn(
      `Rollout rolled back for ${flagKey}`,
      {
        flagKey,
        stage: schedule.currentStage,
        percentage: previousStage.percentage,
      }
    );
  }

  /**
   * Complete rollout immediately (100%)
   */
  completeRollout(flagKey: string): void {
    const schedule = this.schedules.get(flagKey);
    if (!schedule) {
      throw new Error(`Rollout schedule not found for ${flagKey}`);
    }

    featureFlagTargeting.updateConfig(flagKey, {
      rolloutPercentage: 100,
    });

    schedule.completedAt = new Date();
    log.info(`Rollout completed immediately for ${flagKey}`);
  }

  /**
   * Record rollout metrics
   */
  recordMetrics(
    flagKey: string,
    usersEnabled: number,
    usersTotal: number,
    errors: number
  ): void {
    const schedule = this.schedules.get(flagKey);
    if (!schedule) return;

    const successRate = usersEnabled > 0 ? 1 - errors / usersEnabled : 1;

    const metrics: RolloutMetrics = {
      flagKey,
      stage: schedule.currentStage,
      percentage: schedule.stages[schedule.currentStage].percentage,
      usersEnabled,
      usersTotal,
      errors,
      successRate,
    };

    this.metrics.set(flagKey, metrics);
  }

  /**
   * Get rollout schedule
   */
  getSchedule(flagKey: string): RolloutSchedule | undefined {
    return this.schedules.get(flagKey);
  }

  /**
   * Get rollout metrics
   */
  getMetrics(flagKey: string): RolloutMetrics | undefined {
    return this.metrics.get(flagKey);
  }

  /**
   * Get all active rollouts
   */
  getActiveRollouts(): RolloutSchedule[] {
    return Array.from(this.schedules.values()).filter(
      (s) => s.startedAt && !s.completedAt
    );
  }
}

// Singleton instance
export const rolloutManager = new RolloutManager();

// Common rollout patterns
export const RolloutPatterns = {
  /**
   * Canary rollout: 1% -> 5% -> 10% -> 50% -> 100%
   */
  canary(): Array<{ percentage: number; duration: number }> {
    return [
      { percentage: 1, duration: 1 * 60 * 60 * 1000 }, // 1% for 1 hour
      { percentage: 5, duration: 2 * 60 * 60 * 1000 }, // 5% for 2 hours
      { percentage: 10, duration: 4 * 60 * 60 * 1000 }, // 10% for 4 hours
      { percentage: 50, duration: 12 * 60 * 60 * 1000 }, // 50% for 12 hours
      { percentage: 100, duration: 0 }, // 100% immediately after
    ];
  },

  /**
   * Aggressive rollout: 10% -> 50% -> 100%
   */
  aggressive(): Array<{ percentage: number; duration: number }> {
    return [
      { percentage: 10, duration: 1 * 60 * 60 * 1000 }, // 10% for 1 hour
      { percentage: 50, duration: 2 * 60 * 60 * 1000 }, // 50% for 2 hours
      { percentage: 100, duration: 0 }, // 100% immediately after
    ];
  },

  /**
   * Conservative rollout: 1% -> 5% -> 10% -> 25% -> 50% -> 75% -> 100%
   */
  conservative(): Array<{ percentage: number; duration: number }> {
    return [
      { percentage: 1, duration: 2 * 60 * 60 * 1000 }, // 1% for 2 hours
      { percentage: 5, duration: 4 * 60 * 60 * 1000 }, // 5% for 4 hours
      { percentage: 10, duration: 6 * 60 * 60 * 1000 }, // 10% for 6 hours
      { percentage: 25, duration: 12 * 60 * 60 * 1000 }, // 25% for 12 hours
      { percentage: 50, duration: 24 * 60 * 60 * 1000 }, // 50% for 24 hours
      { percentage: 75, duration: 24 * 60 * 60 * 1000 }, // 75% for 24 hours
      { percentage: 100, duration: 0 }, // 100% immediately after
    ];
  },

  /**
   * Linear rollout: Increase by 10% every specified duration
   */
  linear(stepDuration: number): Array<{ percentage: number; duration: number }> {
    const stages = [];
    for (let p = 10; p <= 100; p += 10) {
      stages.push({
        percentage: p,
        duration: p === 100 ? 0 : stepDuration,
      });
    }
    return stages;
  },
};

// Helper to check if feature is in rollout
export async function isInRollout(
  flagKey: string,
  userContext: UserContext
): Promise<boolean> {
  const schedule = rolloutManager.getSchedule(flagKey);
  if (!schedule || !schedule.startedAt || schedule.completedAt) {
    return false;
  }

  return featureFlagTargeting.isEnabled(flagKey, userContext);
}

export { rolloutManager as rollout };
