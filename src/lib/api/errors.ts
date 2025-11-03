/**
 * Standardized API Error Responses
 *
 * Provides consistent error handling and formatting across all API routes.
 *
 * Usage:
 *   import { ApiError, handleApiError, ErrorCode } from '@/lib/api/errors';
 *
 *   throw new ApiError('Resource not found', ErrorCode.NOT_FOUND, { resourceId });
 *
 *   // Or in catch block:
 *   catch (error) {
 *     return handleApiError(error);
 *   }
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

/**
 * Standard error codes matching HTTP status codes
 */
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  message: string;
  code: ErrorCode;
  details?: unknown;
  timestamp: string;
  path?: string;
  requestId?: string;
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.BAD_REQUEST, details);
    this.name = "ValidationError";
  }
}

/**
 * Authentication Error (401)
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = "Authentication required", details?: unknown) {
    super(message, ErrorCode.UNAUTHORIZED, details);
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization Error (403)
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = "Insufficient permissions", details?: unknown) {
    super(message, ErrorCode.FORBIDDEN, details);
    this.name = "AuthorizationError";
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = "Resource", details?: unknown) {
    super(`${resource} not found`, ErrorCode.NOT_FOUND, details);
    this.name = "NotFoundError";
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.CONFLICT, details);
    this.name = "ConflictError";
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends ApiError {
  constructor(message: string = "Rate limit exceeded", details?: unknown) {
    super(message, ErrorCode.TOO_MANY_REQUESTS, details);
    this.name = "RateLimitError";
  }
}

/**
 * Format error response
 */
function formatErrorResponse(
  error: Error | ApiError | ZodError,
  path?: string,
  requestId?: string
): ErrorResponse {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      error: "Validation Error",
      message: "Invalid input data",
      code: ErrorCode.BAD_REQUEST,
      details: error.errors.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      })),
      timestamp: new Date().toISOString(),
      path,
      requestId,
    };
  }

  // Handle custom API errors
  if (error instanceof ApiError) {
    return {
      error: error.name,
      message: error.message,
      code: error.code,
      details: error.details,
      timestamp: new Date().toISOString(),
      path,
      requestId,
    };
  }

  // Handle unknown errors (don't expose internal details)
  return {
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "An unexpected error occurred",
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    timestamp: new Date().toISOString(),
    path,
    requestId,
  };
}

/**
 * Handle API errors and return formatted NextResponse
 *
 * @param error - Error object
 * @param request - Optional request for logging context
 * @returns NextResponse with error details
 */
export function handleApiError(
  error: unknown,
  request?: Request
): NextResponse<ErrorResponse> {
  const url = request ? new URL(request.url) : undefined;
  const path = url?.pathname;
  const requestId = request?.headers.get("x-request-id") || undefined;

  // Convert to Error if needed
  const err = error instanceof Error ? error : new Error(String(error));

  // Format response
  const response = formatErrorResponse(err, path, requestId);

  // Log error
  const logLevel = response.code >= 500 ? "error" : "warn";
  logger[logLevel]("API error", {
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
    code: response.code,
    path,
    requestId,
    details: response.details,
  });

  // Return response
  return NextResponse.json(response, {
    status: response.code,
    headers: {
      "Content-Type": "application/json",
      ...(requestId && { "X-Request-ID": requestId }),
    },
  });
}

/**
 * Async error handler wrapper for API routes
 *
 * @example
 * export const GET = withErrorHandling(async (request) => {
 *   // Your code that might throw
 *   const data = await fetchData();
 *   return NextResponse.json(data);
 * });
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0] as Request | undefined;
      return handleApiError(error, request);
    }
  }) as T;
}

/**
 * Assert condition or throw error
 *
 * @example
 * assert(user, new NotFoundError('User'));
 * assert(hasPermission, new AuthorizationError());
 */
export function assert(condition: unknown, error: ApiError): asserts condition {
  if (!condition) {
    throw error;
  }
}

/**
 * Success response helper
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  headers?: Record<string, string>
): NextResponse<{ data: T; timestamp: string }> {
  return NextResponse.json(
    {
      data,
      timestamp: new Date().toISOString(),
    },
    { status, headers }
  );
}
