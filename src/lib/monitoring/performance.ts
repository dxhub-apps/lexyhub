/**
 * Performance Monitoring Utilities
 *
 * Provides utilities for measuring and tracking performance metrics.
 *
 * Usage:
 *   import { measureTime, trackMetric } from '@/lib/monitoring/performance';
 *
 *   const duration = await measureTime('operation', async () => {
 *     // Your code
 *   });
 */

import { logger, logDatabaseQuery, logExternalApiCall } from "@/lib/logger";

/**
 * Measure execution time of async function
 */
export async function measureTime<T>(
  operationName: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    logger.debug(
      {
        operation: operationName,
        duration: Math.round(duration),
        unit: "ms",
      },
      `Performance: ${operationName}`
    );

    return { result, duration };
  } catch (error) {
    const duration = performance.now() - start;

    logger.error(
      {
        operation: operationName,
        duration: Math.round(duration),
        error,
      },
      `Performance: ${operationName} failed`
    );

    throw error;
  }
}

/**
 * Measure and log database query performance
 */
export async function measureDatabaseQuery<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    logDatabaseQuery(operation, table, Math.round(duration));

    // Warn on slow queries
    if (duration > 1000) {
      logger.warn(
        {
          operation,
          table,
          duration: Math.round(duration),
        },
        "Slow database query detected"
      );
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;

    logger.error(
      {
        operation,
        table,
        duration: Math.round(duration),
        error,
      },
      "Database query error"
    );

    throw error;
  }
}

/**
 * Measure and log external API call performance
 */
export async function measureExternalApiCall<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    logExternalApiCall(service, operation, true, Math.round(duration));

    // Warn on slow external calls
    if (duration > 5000) {
      logger.warn(
        {
          service,
          operation,
          duration: Math.round(duration),
        },
        "Slow external API call detected"
      );
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;

    logExternalApiCall(service, operation, false, Math.round(duration), {
      error,
    });

    throw error;
  }
}

/**
 * Performance metrics tracker
 */
class PerformanceTracker {
  private metrics: Map<string, number[]> = new Map();

  /**
   * Record a metric value
   */
  record(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  /**
   * Get statistics for a metric
   */
  getStats(name: string): {
    count: number;
    mean: number;
    median: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      mean: sum / count,
      median: sorted[Math.floor(count / 2)],
      min: sorted[0],
      max: sorted[count - 1],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  /**
   * Get all metrics
   */
  getAllStats(): Record<string, ReturnType<typeof this.getStats>> {
    const result: Record<string, ReturnType<typeof this.getStats>> = {};
    for (const name of this.metrics.keys()) {
      result[name] = this.getStats(name);
    }
    return result;
  }

  /**
   * Clear metrics
   */
  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

// Global performance tracker
export const performanceTracker = new PerformanceTracker();

/**
 * Track a custom metric
 */
export function trackMetric(name: string, value: number, unit?: string): void {
  performanceTracker.record(name, value);

  logger.debug(
    {
      metric: name,
      value,
      unit: unit || "units",
    },
    `Metric: ${name}`
  );
}

/**
 * Create a performance monitor decorator
 */
export function monitored(metricName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const { result, duration } = await measureTime(metricName, () =>
        originalMethod.apply(this, args)
      );
      trackMetric(metricName, duration, "ms");
      return result;
    };

    return descriptor;
  };
}

/**
 * Get Web Vitals thresholds
 */
export const WEB_VITALS_THRESHOLDS = {
  // Largest Contentful Paint
  LCP: {
    good: 2500,
    needsImprovement: 4000,
  },
  // First Input Delay
  FID: {
    good: 100,
    needsImprovement: 300,
  },
  // Cumulative Layout Shift
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  // First Contentful Paint
  FCP: {
    good: 1800,
    needsImprovement: 3000,
  },
  // Time to First Byte
  TTFB: {
    good: 800,
    needsImprovement: 1800,
  },
};

/**
 * Evaluate Web Vital score
 */
export function evaluateWebVital(
  metric: keyof typeof WEB_VITALS_THRESHOLDS,
  value: number
): "good" | "needs-improvement" | "poor" {
  const thresholds = WEB_VITALS_THRESHOLDS[metric];
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.needsImprovement) return "needs-improvement";
  return "poor";
}
