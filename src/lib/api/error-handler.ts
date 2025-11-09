import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";

/**
 * Error context for better debugging and tracking
 */
export interface ErrorContext {
  feature?: string;
  component?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  requestId?: string;
  statusCode: number;
}

/**
 * Wrapper for API route handlers that adds comprehensive error handling and Sentry integration
 *
 * @example
 * ```ts
 * export const GET = withErrorHandling(
 *   async (request: NextRequest) => {
 *     const data = await fetchData();
 *     return NextResponse.json(data);
 *   },
 *   { feature: "dashboard", component: "metrics-endpoint" }
 * );
 * ```
 */
export function withErrorHandling<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  context?: ErrorContext
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();

    try {
      // Set request context in Sentry
      Sentry.setContext("request", {
        id: requestId,
        url: request.url,
        method: request.method,
        headers: {
          "user-agent": request.headers.get("user-agent"),
          "referer": request.headers.get("referer"),
        },
      });

      // Add custom context if provided
      if (context) {
        Sentry.setTags({
          feature: context.feature,
          component: context.component,
        });

        if (context.userId) {
          Sentry.setUser({ id: context.userId });
        }

        if (context.metadata) {
          Sentry.setContext("custom", context.metadata);
        }
      }

      // Execute the handler
      return await handler(request, ...args);
    } catch (error) {
      // Capture the error in Sentry with full context
      Sentry.captureException(error, {
        tags: {
          feature: context?.feature || "api",
          component: context?.component || "unknown",
          requestId,
        },
        contexts: {
          request: {
            id: requestId,
            url: request.url,
            method: request.method,
          },
        },
        extra: {
          metadata: context?.metadata,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        },
      });

      // Log the error
      log.error("API route error", {
        error,
        requestId,
        url: request.url,
        method: request.method,
        feature: context?.feature,
        component: context?.component,
      });

      // Return appropriate error response
      return handleErrorResponse(error, requestId);
    }
  };
}

/**
 * Captures an error to Sentry with proper context
 */
export function captureApiError(
  error: unknown,
  context: ErrorContext & { url?: string; method?: string }
): void {
  Sentry.captureException(error, {
    tags: {
      feature: context.feature || "api",
      component: context.component || "unknown",
    },
    contexts: {
      request: context.url && context.method ? {
        url: context.url,
        method: context.method,
      } : undefined,
    },
    extra: {
      metadata: context.metadata,
      userId: context.userId,
    },
  });

  log.error("API error captured", {
    error,
    context,
  });
}

/**
 * Formats error into a proper HTTP response
 */
function handleErrorResponse(error: unknown, requestId: string): NextResponse<ApiErrorResponse> {
  // Handle different error types
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.name,
        message: error.message,
        requestId,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    );
  }

  // Handle validation errors
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: error.message,
        requestId,
        statusCode: 400,
      },
      { status: 400 }
    );
  }

  // Handle authentication errors
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      {
        error: "AuthenticationError",
        message: error.message,
        requestId,
        statusCode: 401,
      },
      { status: 401 }
    );
  }

  // Handle authorization errors
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      {
        error: "AuthorizationError",
        message: error.message,
        requestId,
        statusCode: 403,
      },
      { status: 403 }
    );
  }

  // Handle not found errors
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      {
        error: "NotFoundError",
        message: error.message,
        requestId,
        statusCode: 404,
      },
      { status: 404 }
    );
  }

  // Handle rate limit errors
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        error: "RateLimitError",
        message: error.message,
        requestId,
        statusCode: 429,
      },
      { status: 429 }
    );
  }

  // Default to 500 for unknown errors
  const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";

  return NextResponse.json(
    {
      error: "InternalServerError",
      message: process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : errorMessage,
      requestId,
      statusCode: 500,
    },
    { status: 500 }
  );
}

/**
 * Custom error classes for better error handling
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, 429, "RATE_LIMIT_ERROR");
    this.name = "RateLimitError";
  }
}

export class ExternalServiceError extends ApiError {
  constructor(
    message: string,
    public service: string
  ) {
    super(message, 503, "EXTERNAL_SERVICE_ERROR");
    this.name = "ExternalServiceError";
  }
}
