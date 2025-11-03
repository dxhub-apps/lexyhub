/**
 * Rate Limiting Middleware
 *
 * Implements rate limiting for API routes using Upstash Redis.
 * Supports different limits based on user authentication and plan.
 *
 * Usage in API routes:
 *   import { rateLimit } from '@/lib/middleware/rate-limit';
 *
 *   export async function GET(request: Request) {
 *     const { success, limit, remaining, reset } = await rateLimit(request);
 *     if (!success) {
 *       return new Response('Rate limit exceeded', { status: 429 });
 *     }
 *     // ... your code
 *   }
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// Initialize Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    })
  : null;

// Rate limit configurations
export const RATE_LIMITS = {
  anonymous: {
    requests: 10,
    window: "1 m",
  },
  authenticated: {
    requests: 100,
    window: "1 m",
  },
  premium: {
    requests: 1000,
    window: "1 m",
  },
} as const;

// Create rate limiters
const anonymousLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "@ratelimit/anonymous",
    })
  : null;

const authenticatedLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true,
      prefix: "@ratelimit/authenticated",
    })
  : null;

const premiumLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1000, "1 m"),
      analytics: true,
      prefix: "@ratelimit/premium",
    })
  : null;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  identifier: string;
}

/**
 * Get rate limit identifier from request
 * Uses userId if authenticated, otherwise IP address
 */
function getIdentifier(request: NextRequest): string {
  // Try to get user ID from headers (set by auth middleware)
  const userId = request.headers.get("x-user-id");
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "anonymous";

  return `ip:${ip.split(",")[0].trim()}`;
}

/**
 * Determine user tier based on headers
 */
function getUserTier(request: NextRequest): "anonymous" | "authenticated" | "premium" {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return "anonymous";
  }

  const userPlan = request.headers.get("x-user-plan");
  if (userPlan === "scale" || userPlan === "premium") {
    return "premium";
  }

  return "authenticated";
}

/**
 * Apply rate limiting to a request
 *
 * @param request - The Next.js request object
 * @returns Rate limit result with success status and metadata
 */
export async function rateLimit(request: NextRequest): Promise<RateLimitResult> {
  // If Redis is not configured, allow all requests (dev mode)
  if (!redis) {
    logger.warn("Rate limiting disabled - Redis not configured");
    return {
      success: true,
      limit: 999999,
      remaining: 999999,
      reset: Date.now() + 60000,
      identifier: "dev-mode",
    };
  }

  const identifier = getIdentifier(request);
  const tier = getUserTier(request);

  // Select appropriate limiter
  const limiter =
    tier === "premium"
      ? premiumLimiter
      : tier === "authenticated"
        ? authenticatedLimiter
        : anonymousLimiter;

  if (!limiter) {
    logger.error("Rate limiter not initialized", { tier });
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: Date.now(),
      identifier,
    };
  }

  // Check rate limit
  const result = await limiter.limit(identifier);

  // Log if rate limit exceeded
  if (!result.success) {
    logger.warn("Rate limit exceeded", {
      identifier,
      tier,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
    });
  }

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    identifier,
  };
}

/**
 * Rate limit middleware helper for API routes
 *
 * Returns a NextResponse with rate limit headers if limit exceeded
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const rateLimitResponse = await withRateLimit(request);
 *   if (rateLimitResponse) return rateLimitResponse;
 *
 *   // Your API logic here
 *   return NextResponse.json({ data: "..." });
 * }
 */
export async function withRateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  const { success, limit, remaining, reset } = await rateLimit(request);

  if (!success) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: "Too many requests. Please try again later.",
        limit,
        remaining,
        reset: new Date(reset).toISOString(),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set("X-RateLimit-Limit", result.limit.toString());
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  response.headers.set("X-RateLimit-Reset", result.reset.toString());
  return response;
}

/**
 * Custom rate limit for specific endpoints
 *
 * @param requests - Number of requests allowed
 * @param window - Time window (e.g., "10 s", "1 m", "1 h")
 * @param identifier - Custom identifier (e.g., "api-key:abc123")
 */
export async function customRateLimit(
  requests: number,
  window: string,
  identifier: string
): Promise<RateLimitResult> {
  if (!redis) {
    return {
      success: true,
      limit: requests,
      remaining: requests,
      reset: Date.now() + 60000,
      identifier,
    };
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: "@ratelimit/custom",
  });

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    identifier,
  };
}
