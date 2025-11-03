/**
 * Data Quality Monitoring
 * Continuously monitors data quality and alerts on issues
 */

import { log } from "../logger";
import type { DataQualityCheck, ValidationResult } from "./validators";
import { runDataQualityChecks } from "./validators";

export interface DataQualityAlert {
  id: string;
  checkName: string;
  severity: "error" | "warning";
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
}

export interface MonitoringSchedule {
  checks: DataQualityCheck[];
  interval: number; // milliseconds
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

class DataQualityMonitor {
  private schedules: Map<string, MonitoringSchedule> = new Map();
  private alerts: DataQualityAlert[] = [];
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly maxAlerts = 1000;

  /**
   * Register a monitoring schedule
   */
  register(
    name: string,
    checks: DataQualityCheck[],
    interval: number
  ): void {
    const schedule: MonitoringSchedule = {
      checks,
      interval,
      enabled: true,
    };

    this.schedules.set(name, schedule);
    log.info(
      `Data quality monitoring schedule registered: ${name}`,
      { scheduleName: name, checks: checks.length, intervalMs: interval }
    );
  }

  /**
   * Start monitoring
   */
  start(scheduleName: string): void {
    const schedule = this.schedules.get(scheduleName);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleName}`);
    }

    if (!schedule.enabled) {
      schedule.enabled = true;
    }

    // Clear existing timer if any
    this.stop(scheduleName);

    // Run immediately
    this.runChecks(scheduleName);

    // Schedule recurring runs
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => {
        this.runChecks(scheduleName);
      }, schedule.interval);

      this.timers.set(scheduleName, timer);
    }

    log.info(`Data quality monitoring started: ${scheduleName}`, { scheduleName });
  }

  /**
   * Stop monitoring
   */
  stop(scheduleName: string): void {
    const timer = this.timers.get(scheduleName);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(scheduleName);
    }

    const schedule = this.schedules.get(scheduleName);
    if (schedule) {
      schedule.enabled = false;
    }

    log.info(`Data quality monitoring stopped: ${scheduleName}`, { scheduleName });
  }

  /**
   * Run data quality checks
   */
  private async runChecks(scheduleName: string): Promise<void> {
    const schedule = this.schedules.get(scheduleName);
    if (!schedule || !schedule.enabled) {
      return;
    }

    schedule.lastRun = new Date();
    schedule.nextRun = new Date(Date.now() + schedule.interval);

    log.info(`Running data quality checks: ${scheduleName}`, { scheduleName });

    try {
      const result = await runDataQualityChecks(schedule.checks);

      // Create alerts for failures
      for (const [checkName, validationResult] of result.results.entries()) {
        if (!validationResult.passed) {
          const check = schedule.checks.find((c) => c.name === checkName);
          if (check) {
            this.createAlert(
              checkName,
              check.severity,
              validationResult.errors.join("; "),
              validationResult.metadata
            );
          }
        }

        // Create alerts for warnings
        if (validationResult.warnings.length > 0) {
          const check = schedule.checks.find((c) => c.name === checkName);
          if (check) {
            this.createAlert(
              checkName,
              "warning",
              validationResult.warnings.join("; "),
              validationResult.metadata
            );
          }
        }
      }

      log.info(
        `Data quality checks completed: ${scheduleName}`,
        {
          scheduleName,
          passed: result.passed,
          summary: result.summary,
        }
      );
    } catch (error) {
      log.error(
        `Error running data quality checks: ${scheduleName}`,
        {
          scheduleName,
          error,
        }
      );
    }
  }

  /**
   * Create an alert
   */
  private createAlert(
    checkName: string,
    severity: "error" | "warning",
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const alert: DataQualityAlert = {
      id: this.generateAlertId(),
      checkName,
      severity,
      message,
      timestamp: new Date(),
      metadata,
      acknowledged: false,
    };

    this.alerts.push(alert);

    // Prevent memory leaks
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    // Log the alert
    const logMethod = severity === "error" ? log.error : log.warn;
    logMethod(
      `Data quality alert: ${message}`,
      {
        alertId: alert.id,
        checkName,
        metadata,
      }
    );

    // In production, you would send notifications here
    // e.g., Slack, PagerDuty, email, etc.
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(acknowledged: boolean = false): DataQualityAlert[] {
    return this.alerts.filter((a) => a.acknowledged === acknowledged);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: "error" | "warning"): DataQualityAlert[] {
    return this.alerts.filter((a) => a.severity === severity);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      log.info(`Alert acknowledged: ${alertId}`, { alertId });
    }
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledgedAlerts(): void {
    const initialCount = this.alerts.length;
    this.alerts = this.alerts.filter((a) => !a.acknowledged);
    const clearedCount = initialCount - this.alerts.length;
    log.info(`Cleared ${clearedCount} acknowledged alerts`, { clearedCount });
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    schedules: Array<{
      name: string;
      enabled: boolean;
      lastRun?: string;
      nextRun?: string;
      checksCount: number;
    }>;
    alerts: {
      total: number;
      errors: number;
      warnings: number;
      unacknowledged: number;
    };
  } {
    const scheduleStatus = Array.from(this.schedules.entries()).map(
      ([name, schedule]) => ({
        name,
        enabled: schedule.enabled,
        lastRun: schedule.lastRun?.toISOString(),
        nextRun: schedule.nextRun?.toISOString(),
        checksCount: schedule.checks.length,
      })
    );

    const errors = this.alerts.filter((a) => a.severity === "error").length;
    const warnings = this.alerts.filter((a) => a.severity === "warning").length;
    const unacknowledged = this.alerts.filter((a) => !a.acknowledged).length;

    return {
      schedules: scheduleStatus,
      alerts: {
        total: this.alerts.length,
        errors,
        warnings,
        unacknowledged,
      },
    };
  }

  /**
   * Stop all monitoring
   */
  stopAll(): void {
    for (const scheduleName of this.schedules.keys()) {
      this.stop(scheduleName);
    }
    log.info("All data quality monitoring stopped");
  }
}

// Singleton instance
export const dataQualityMonitor = new DataQualityMonitor();

// Helper to set up common monitoring schedules
export const MonitoringPresets = {
  /**
   * Monitor data freshness every 5 minutes
   */
  freshnessMonitoring(checks: DataQualityCheck[]): void {
    dataQualityMonitor.register(
      "freshness",
      checks,
      5 * 60 * 1000 // 5 minutes
    );
  },

  /**
   * Monitor data quality hourly
   */
  hourlyQualityChecks(checks: DataQualityCheck[]): void {
    dataQualityMonitor.register(
      "hourly-quality",
      checks,
      60 * 60 * 1000 // 1 hour
    );
  },

  /**
   * Monitor data integrity daily
   */
  dailyIntegrityChecks(checks: DataQualityCheck[]): void {
    dataQualityMonitor.register(
      "daily-integrity",
      checks,
      24 * 60 * 60 * 1000 // 24 hours
    );
  },

  /**
   * Critical checks every minute
   */
  criticalMonitoring(checks: DataQualityCheck[]): void {
    dataQualityMonitor.register(
      "critical",
      checks,
      60 * 1000 // 1 minute
    );
  },
};

export { dataQualityMonitor as monitor };
