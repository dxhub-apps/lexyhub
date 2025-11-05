// src/lib/extension/auth.ts
/**
 * Extension authentication utilities for API endpoints
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export interface ExtensionContext {
  userId: string;
  isExtension: boolean;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) return null;

  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Check if request is from extension client
 */
function isExtensionClient(headers: Headers): boolean {
  const extHeader = headers.get("x-ext-client");
  return extHeader === "true" || extHeader === "1";
}

/**
 * Authenticate extension request and extract user context
 * Returns null if authentication fails
 */
export async function authenticateExtension(
  request: Request
): Promise<ExtensionContext | null> {
  const token = extractBearerToken(request.headers);
  if (!token) {
    return null;
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase credentials not configured");
    return null;
  }

  // Create a client with the user's JWT token
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.warn("Extension auth failed:", error?.message);
      return null;
    }

    return {
      userId: user.id,
      isExtension: isExtensionClient(request.headers),
    };
  } catch (error) {
    console.error("Extension authentication error:", error);
    return null;
  }
}

/**
 * Rate limit helper for extension endpoints
 * Simple in-memory rate limiter (replace with Redis in production)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  userId: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const key = `ext:${userId}`;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}
