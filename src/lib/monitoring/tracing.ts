/**
 * Distributed Tracing with OpenTelemetry
 * Provides request tracing across services and operations
 */

import { log } from "../logger";

// Trace context
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: number;
}

// Span represents a unit of work
export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  status: SpanStatus;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

export enum SpanStatus {
  OK = "ok",
  ERROR = "error",
  UNSET = "unset",
}

class TracingManager {
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: Span[] = [];
  private readonly maxCompletedSpans = 1000;

  /**
   * Start a new trace
   */
  startTrace(name: string, attributes?: Record<string, unknown>): Span {
    const traceId = this.generateId();
    const spanId = this.generateId();

    const span: Span = {
      id: spanId,
      traceId,
      name,
      startTime: Date.now(),
      attributes: attributes || {},
      events: [],
      status: SpanStatus.UNSET,
    };

    this.activeSpans.set(spanId, span);

    log.debug(
      `Trace started: ${name}`,
      { traceId, spanId, name }
    );

    return span;
  }

  /**
   * Start a child span
   */
  startSpan(
    name: string,
    parentSpan: Span,
    attributes?: Record<string, unknown>
  ): Span {
    const spanId = this.generateId();

    const span: Span = {
      id: spanId,
      traceId: parentSpan.traceId,
      parentSpanId: parentSpan.id,
      name,
      startTime: Date.now(),
      attributes: attributes || {},
      events: [],
      status: SpanStatus.UNSET,
    };

    this.activeSpans.set(spanId, span);

    log.debug(
      `Span started: ${name}`,
      { traceId: span.traceId, spanId, parentSpanId: parentSpan.id, name }
    );

    return span;
  }

  /**
   * End a span
   */
  endSpan(span: Span, status: SpanStatus = SpanStatus.OK): void {
    const activeSpan = this.activeSpans.get(span.id);
    if (!activeSpan) {
      log.warn("Attempted to end non-existent span", { spanId: span.id });
      return;
    }

    activeSpan.endTime = Date.now();
    activeSpan.duration = activeSpan.endTime - activeSpan.startTime;
    activeSpan.status = status;

    // Move to completed spans
    this.activeSpans.delete(span.id);
    this.completedSpans.push(activeSpan);

    // Prevent memory leaks
    if (this.completedSpans.length > this.maxCompletedSpans) {
      this.completedSpans.shift();
    }

    log.debug(
      `Span ended: ${activeSpan.name}`,
      {
        traceId: activeSpan.traceId,
        spanId: activeSpan.id,
        duration: activeSpan.duration,
        status,
      }
    );
  }

  /**
   * Add an event to a span
   */
  addSpanEvent(
    span: Span,
    name: string,
    attributes?: Record<string, unknown>
  ): void {
    const activeSpan = this.activeSpans.get(span.id);
    if (activeSpan) {
      activeSpan.events.push({
        name,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  /**
   * Set span attributes
   */
  setSpanAttributes(span: Span, attributes: Record<string, unknown>): void {
    const activeSpan = this.activeSpans.get(span.id);
    if (activeSpan) {
      activeSpan.attributes = { ...activeSpan.attributes, ...attributes };
    }
  }

  /**
   * Record an exception in a span
   */
  recordException(span: Span, error: Error): void {
    this.addSpanEvent(span, "exception", {
      "exception.type": error.name,
      "exception.message": error.message,
      "exception.stacktrace": error.stack,
    });
    this.setSpanAttributes(span, { "error": true });
  }

  /**
   * Get active spans
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Get completed spans
   */
  getCompletedSpans(traceId?: string): Span[] {
    if (traceId) {
      return this.completedSpans.filter((s) => s.traceId === traceId);
    }
    return this.completedSpans;
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): Span[] {
    const active = Array.from(this.activeSpans.values()).filter(
      (s) => s.traceId === traceId
    );
    const completed = this.completedSpans.filter((s) => s.traceId === traceId);
    return [...active, ...completed];
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Clear completed spans
   */
  clearCompletedSpans(): void {
    this.completedSpans = [];
    log.info("Cleared completed spans");
  }
}

// Singleton instance
const tracingManager = new TracingManager();

/**
 * Trace decorator for functions
 */
export function trace(name?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const spanName = name || `${String(propertyKey)}`;

    descriptor.value = async function (...args: unknown[]) {
      const span = tracingManager.startTrace(spanName, {
        "function.name": String(propertyKey),
        "function.args": JSON.stringify(args),
      });

      try {
        const result = await originalMethod.apply(this, args);
        tracingManager.endSpan(span, SpanStatus.OK);
        return result;
      } catch (error) {
        tracingManager.recordException(span, error as Error);
        tracingManager.endSpan(span, SpanStatus.ERROR);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Trace an async operation
 */
export async function traceAsync<T>(
  name: string,
  operation: (span: Span) => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  const span = tracingManager.startTrace(name, attributes);

  try {
    const result = await operation(span);
    tracingManager.endSpan(span, SpanStatus.OK);
    return result;
  } catch (error) {
    tracingManager.recordException(span, error as Error);
    tracingManager.endSpan(span, SpanStatus.ERROR);
    throw error;
  }
}

/**
 * Trace a synchronous operation
 */
export function traceSync<T>(
  name: string,
  operation: (span: Span) => T,
  attributes?: Record<string, unknown>
): T {
  const span = tracingManager.startTrace(name, attributes);

  try {
    const result = operation(span);
    tracingManager.endSpan(span, SpanStatus.OK);
    return result;
  } catch (error) {
    tracingManager.recordException(span, error as Error);
    tracingManager.endSpan(span, SpanStatus.ERROR);
    throw error;
  }
}

// HTTP tracing helpers
export const HttpTracing = {
  /**
   * Start HTTP request span
   */
  startRequest(
    method: string,
    url: string,
    headers?: Record<string, string>
  ): Span {
    return tracingManager.startTrace("http.request", {
      "http.method": method,
      "http.url": url,
      "http.headers": headers,
    });
  },

  /**
   * End HTTP request span
   */
  endRequest(span: Span, statusCode: number, responseSize?: number): void {
    tracingManager.setSpanAttributes(span, {
      "http.status_code": statusCode,
      "http.response_size": responseSize,
    });

    const status =
      statusCode >= 500 ? SpanStatus.ERROR : SpanStatus.OK;
    tracingManager.endSpan(span, status);
  },
};

// Database tracing helpers
export const DatabaseTracing = {
  /**
   * Start database query span
   */
  startQuery(
    operation: string,
    table?: string,
    query?: string
  ): Span {
    return tracingManager.startTrace("database.query", {
      "db.operation": operation,
      "db.table": table,
      "db.query": query,
    });
  },

  /**
   * End database query span
   */
  endQuery(span: Span, rowCount?: number, error?: Error): void {
    if (rowCount !== undefined) {
      tracingManager.setSpanAttributes(span, {
        "db.row_count": rowCount,
      });
    }

    if (error) {
      tracingManager.recordException(span, error);
      tracingManager.endSpan(span, SpanStatus.ERROR);
    } else {
      tracingManager.endSpan(span, SpanStatus.OK);
    }
  },
};

// External API tracing helpers
export const ExternalAPITracing = {
  /**
   * Start external API call span
   */
  startCall(
    service: string,
    endpoint: string,
    method: string
  ): Span {
    return tracingManager.startTrace("external.api", {
      "service.name": service,
      "api.endpoint": endpoint,
      "api.method": method,
    });
  },

  /**
   * End external API call span
   */
  endCall(span: Span, statusCode: number, error?: Error): void {
    tracingManager.setSpanAttributes(span, {
      "api.status_code": statusCode,
    });

    if (error) {
      tracingManager.recordException(span, error);
      tracingManager.endSpan(span, SpanStatus.ERROR);
    } else {
      tracingManager.endSpan(span, SpanStatus.OK);
    }
  },
};

export {
  tracingManager as tracing,
  TracingManager,
};
