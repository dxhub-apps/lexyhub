/**
 * Business Metrics Collection and Tracking
 * Provides utilities for collecting and analyzing business and system metrics
 */

import { log } from "../logger";

// Metric types
export enum MetricType {
  COUNTER = "counter",
  GAUGE = "gauge",
  HISTOGRAM = "histogram",
  SUMMARY = "summary",
}

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  unit?: string;
}

export interface MetricAggregation {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private readonly maxMetricsPerType = 10000; // Prevent memory leaks

  /**
   * Record a counter metric (incrementing value)
   */
  incrementCounter(
    name: string,
    value: number = 1,
    tags?: Record<string, string>
  ): void {
    this.recordMetric({
      name,
      type: MetricType.COUNTER,
      value,
      timestamp: Date.now(),
      tags,
    });

    log.debug(
      `Counter metric recorded: ${name}`,
      { metric: name, value, tags }
    );
  }

  /**
   * Record a gauge metric (current value at a point in time)
   */
  recordGauge(
    name: string,
    value: number,
    tags?: Record<string, string>,
    unit?: string
  ): void {
    this.recordMetric({
      name,
      type: MetricType.GAUGE,
      value,
      timestamp: Date.now(),
      tags,
      unit,
    });

    log.debug(
      `Gauge metric recorded: ${name}`,
      { metric: name, value, unit, tags }
    );
  }

  /**
   * Record a histogram metric (distribution of values)
   */
  recordHistogram(
    name: string,
    value: number,
    tags?: Record<string, string>,
    unit?: string
  ): void {
    this.recordMetric({
      name,
      type: MetricType.HISTOGRAM,
      value,
      timestamp: Date.now(),
      tags,
      unit,
    });

    log.debug(
      `Histogram metric recorded: ${name}`,
      { metric: name, value, unit, tags }
    );
  }

  /**
   * Record a timing metric (specialized histogram for duration)
   */
  recordTiming(
    name: string,
    durationMs: number,
    tags?: Record<string, string>
  ): void {
    this.recordHistogram(name, durationMs, tags, "ms");
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: Metric): void {
    const key = metric.name;
    const metrics = this.metrics.get(key) || [];

    metrics.push(metric);

    // Prevent memory leaks by limiting stored metrics
    if (metrics.length > this.maxMetricsPerType) {
      metrics.shift(); // Remove oldest metric
    }

    this.metrics.set(key, metrics);
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string, since?: number): Metric[] {
    const metrics = this.metrics.get(name) || [];

    if (since) {
      return metrics.filter((m) => m.timestamp >= since);
    }

    return metrics;
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Calculate aggregations for a metric
   */
  getAggregation(name: string, since?: number): MetricAggregation | null {
    const metrics = this.getMetrics(name, since);

    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map((m) => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const count = values.length;

    return {
      count,
      sum,
      avg: sum / count,
      min: values[0],
      max: values[count - 1],
      p50: this.percentile(values, 50),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Clear metrics older than the specified time
   */
  clearOldMetrics(olderThanMs: number): void {
    const cutoff = Date.now() - olderThanMs;

    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter((m) => m.timestamp >= cutoff);
      if (filtered.length === 0) {
        this.metrics.delete(name);
      } else {
        this.metrics.set(name, filtered);
      }
    }

    log.info(
      "Cleared old metrics",
      { retainedMetricTypes: this.metrics.size }
    );
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    log.info("All metrics reset");
  }

  /**
   * Get summary of all metrics
   */
  getSummary(): Record<string, MetricAggregation> {
    const summary: Record<string, MetricAggregation> = {};

    for (const name of this.getMetricNames()) {
      const agg = this.getAggregation(name);
      if (agg) {
        summary[name] = agg;
      }
    }

    return summary;
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

// Business metrics helpers
export const BusinessMetrics = {
  /**
   * Track user registration
   */
  userRegistered(userId: string, source?: string): void {
    metricsCollector.incrementCounter("user.registered", 1, {
      source: source || "unknown",
    });
    log.info("User registered", { userId, source });
  },

  /**
   * Track user login
   */
  userLoggedIn(userId: string): void {
    metricsCollector.incrementCounter("user.login", 1);
    log.info("User logged in", { userId });
  },

  /**
   * Track API request
   */
  apiRequest(endpoint: string, method: string, statusCode: number): void {
    metricsCollector.incrementCounter("api.request", 1, {
      endpoint,
      method,
      status: statusCode.toString(),
    });
  },

  /**
   * Track API response time
   */
  apiResponseTime(endpoint: string, durationMs: number): void {
    metricsCollector.recordTiming("api.response_time", durationMs, {
      endpoint,
    });
  },

  /**
   * Track database query
   */
  databaseQuery(queryType: string, durationMs: number): void {
    metricsCollector.recordTiming("database.query", durationMs, {
      type: queryType,
    });
  },

  /**
   * Track AI operation
   */
  aiOperation(operation: string, durationMs: number, tokensUsed?: number): void {
    metricsCollector.recordTiming("ai.operation", durationMs, {
      operation,
    });

    if (tokensUsed) {
      metricsCollector.incrementCounter("ai.tokens_used", tokensUsed, {
        operation,
      });
    }
  },

  /**
   * Track cache hit/miss
   */
  cacheHit(cacheType: string): void {
    metricsCollector.incrementCounter("cache.hit", 1, { type: cacheType });
  },

  cacheMiss(cacheType: string): void {
    metricsCollector.incrementCounter("cache.miss", 1, { type: cacheType });
  },

  /**
   * Track feature usage
   */
  featureUsed(feature: string, userId?: string): void {
    metricsCollector.incrementCounter("feature.used", 1, {
      feature,
      userId: userId || "anonymous",
    });
  },

  /**
   * Track error
   */
  error(errorType: string, endpoint?: string): void {
    metricsCollector.incrementCounter("error.occurred", 1, {
      type: errorType,
      endpoint: endpoint || "unknown",
    });
  },

  /**
   * Track revenue event
   */
  revenueEvent(
    eventType: "subscription" | "upgrade" | "downgrade" | "cancellation",
    amount?: number
  ): void {
    metricsCollector.incrementCounter("revenue.event", 1, {
      type: eventType,
    });

    if (amount) {
      metricsCollector.recordGauge("revenue.amount", amount, {
        type: eventType,
      });
    }
  },
};

// Export collector for advanced usage
export { metricsCollector as metrics };

// Auto-cleanup old metrics every hour
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      metricsCollector.clearOldMetrics(24 * 60 * 60 * 1000); // Keep 24 hours
    },
    60 * 60 * 1000
  ); // Run every hour
}
