/**
 * Structured Logging Utility
 *
 * Provides consistent, structured logging across the application with context.
 * Uses Pino for high-performance logging with JSON output.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Failed to fetch data', { error, context });
 *   logger.debug('Processing request', { requestId, data });
 */

import pino from "pino";

// Log level from environment (default: info)
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

// Check if we're in development
const isDevelopment = process.env.NODE_ENV === "development";

// Base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: LOG_LEVEL,
  // Include timestamp
  timestamp: pino.stdTimeFunctions.isoTime,
  // Add hostname and process ID
  base: {
    pid: process.pid,
    hostname: process.env.VERCEL_URL || "localhost",
    env: process.env.NODE_ENV || "development",
  },
  // Redact sensitive fields
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "apiKey",
      "*.apiKey",
      "secret",
      "*.secret",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
    ],
    remove: true,
  },
  // Serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
};

// Pretty print in development, JSON in production
const logger = isDevelopment
  ? pino({
      ...baseConfig,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    })
  : pino(baseConfig);

/**
 * Create a child logger with additional context
 *
 * @param context - Context to add to all log messages
 * @returns Child logger
 *
 * @example
 * const log = createLogger({ userId: '123', requestId: 'abc' });
 * log.info('Processing request'); // Will include userId and requestId
 */
export function createLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}

/**
 * Log levels:
 * - trace: Very detailed, typically not needed
 * - debug: Detailed debug information
 * - info: General informational messages
 * - warn: Warning messages
 * - error: Error messages
 * - fatal: Fatal errors causing application crash
 */

export { logger };

// Export type-safe logging functions
export const log = {
  /**
   * Debug level - detailed information for debugging
   */
  debug: (message: string, context?: Record<string, unknown>) => {
    logger.debug(context || {}, message);
  },

  /**
   * Info level - general informational messages
   */
  info: (message: string, context?: Record<string, unknown>) => {
    logger.info(context || {}, message);
  },

  /**
   * Warn level - warning messages that don't prevent operation
   */
  warn: (message: string, context?: Record<string, unknown>) => {
    logger.warn(context || {}, message);
  },

  /**
   * Error level - error messages for recoverable errors
   */
  error: (message: string, context?: Record<string, unknown>) => {
    logger.error(context || {}, message);
  },

  /**
   * Fatal level - critical errors causing application failure
   */
  fatal: (message: string, context?: Record<string, unknown>) => {
    logger.fatal(context || {}, message);
  },
};

/**
 * Helper to log with request context from Next.js request
 */
export function withRequestContext(request: Request) {
  const url = new URL(request.url);

  return createLogger({
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    userAgent: request.headers.get("user-agent"),
    // Generate a request ID if not present
    requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
  });
}

/**
 * Log API request/response for debugging
 */
export function logApiCall(
  method: string,
  url: string,
  status: number,
  durationMs: number,
  context?: Record<string, unknown>
) {
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  logger[level](
    {
      type: "api_call",
      method,
      url,
      status,
      durationMs,
      ...context,
    },
    `${method} ${url} ${status} ${durationMs}ms`
  );
}

/**
 * Log database query for debugging (sanitize sensitive data)
 */
export function logDatabaseQuery(
  operation: string,
  table: string,
  durationMs: number,
  context?: Record<string, unknown>
) {
  logger.debug(
    {
      type: "database_query",
      operation,
      table,
      durationMs,
      ...context,
    },
    `DB ${operation} on ${table} (${durationMs}ms)`
  );
}

/**
 * Log external API call
 */
export function logExternalApiCall(
  service: string,
  operation: string,
  success: boolean,
  durationMs: number,
  context?: Record<string, unknown>
) {
  const level = success ? "info" : "error";

  logger[level](
    {
      type: "external_api_call",
      service,
      operation,
      success,
      durationMs,
      ...context,
    },
    `External API: ${service}.${operation} ${success ? "success" : "failed"} (${durationMs}ms)`
  );
}

/**
 * Log AI/ML operation
 */
export function logAiOperation(
  model: string,
  operation: string,
  tokensUsed?: number,
  durationMs?: number,
  context?: Record<string, unknown>
) {
  logger.info(
    {
      type: "ai_operation",
      model,
      operation,
      tokensUsed,
      durationMs,
      ...context,
    },
    `AI: ${model} ${operation}${tokensUsed ? ` (${tokensUsed} tokens)` : ""}${durationMs ? ` ${durationMs}ms` : ""}`
  );
}

/**
 * Log background job execution
 */
export function logJobExecution(
  jobName: string,
  status: "started" | "completed" | "failed",
  durationMs?: number,
  context?: Record<string, unknown>
) {
  const level = status === "failed" ? "error" : "info";

  logger[level](
    {
      type: "job_execution",
      jobName,
      status,
      durationMs,
      ...context,
    },
    `Job ${jobName} ${status}${durationMs ? ` in ${durationMs}ms` : ""}`
  );
}

/**
 * Log authentication events
 */
export function logAuthEvent(
  event: "login" | "logout" | "register" | "token_refresh" | "auth_failed",
  userId?: string,
  context?: Record<string, unknown>
) {
  const level = event === "auth_failed" ? "warn" : "info";

  logger[level](
    {
      type: "auth_event",
      event,
      userId,
      ...context,
    },
    `Auth: ${event}${userId ? ` (user: ${userId})` : ""}`
  );
}

export default logger;
