/**
 * Redis Caching Utilities
 *
 * Provides caching functionality using Upstash Redis.
 * Supports TTL, namespace prefixes, and typed cache values.
 *
 * Usage:
 *   import { cache } from '@/lib/cache/redis';
 *
 *   const value = await cache.get('key');
 *   await cache.set('key', value, 3600); // 1 hour TTL
 */

import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

// Initialize Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    })
  : null;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  // Default TTLs (in seconds)
  ttl: {
    short: 60, // 1 minute
    medium: 300, // 5 minutes
    long: 3600, // 1 hour
    day: 86400, // 24 hours
    week: 604800, // 7 days
  },

  // Cache key prefixes
  prefixes: {
    embeddings: "embedding:",
    keywords: "keyword:",
    insights: "insight:",
    trends: "trend:",
    featureFlags: "flag:",
    user: "user:",
    session: "session:",
  },
} as const;

/**
 * Cache operations
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    if (!redis) {
      logger.debug("Cache miss: Redis not configured", { key });
      return null;
    }

    try {
      const value = await redis.get<T>(key);
      if (value === null) {
        logger.debug("Cache miss", { key });
      } else {
        logger.debug("Cache hit", { key });
      }
      return value;
    } catch (error) {
      logger.error("Cache get error", { key, error });
      return null;
    }
  },

  /**
   * Set value in cache
   */
  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    if (!redis) {
      logger.debug("Cache skip: Redis not configured", { key });
      return;
    }

    try {
      if (ttl) {
        await redis.setex(key, ttl, value);
      } else {
        await redis.set(key, value);
      }
      logger.debug("Cache set", { key, ttl });
    } catch (error) {
      logger.error("Cache set error", { key, error });
    }
  },

  /**
   * Delete value from cache
   */
  async del(key: string | string[]): Promise<void> {
    if (!redis) return;

    try {
      if (Array.isArray(key)) {
        await redis.del(...key);
      } else {
        await redis.del(key);
      }
      logger.debug("Cache deleted", { key });
    } catch (error) {
      logger.error("Cache delete error", { key, error });
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!redis) return false;

    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Cache exists check error", { key, error });
      return false;
    }
  },

  /**
   * Set expiration time
   */
  async expire(key: string, ttl: number): Promise<void> {
    if (!redis) return;

    try {
      await redis.expire(key, ttl);
      logger.debug("Cache expiration set", { key, ttl });
    } catch (error) {
      logger.error("Cache expire error", { key, error });
    }
  },

  /**
   * Get multiple values
   */
  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (!redis) return keys.map(() => null);

    try {
      const values = await redis.mget<T[]>(...keys);
      return values;
    } catch (error) {
      logger.error("Cache mget error", { keys, error });
      return keys.map(() => null);
    }
  },

  /**
   * Set multiple values
   */
  async mset(entries: Record<string, unknown>): Promise<void> {
    if (!redis) return;

    try {
      const pairs = Object.entries(entries).flat();
      await redis.mset(...pairs);
      logger.debug("Cache mset", { count: Object.keys(entries).length });
    } catch (error) {
      logger.error("Cache mset error", { error });
    }
  },

  /**
   * Increment value
   */
  async incr(key: string): Promise<number> {
    if (!redis) return 0;

    try {
      return await redis.incr(key);
    } catch (error) {
      logger.error("Cache incr error", { key, error });
      return 0;
    }
  },

  /**
   * Decrement value
   */
  async decr(key: string): Promise<number> {
    if (!redis) return 0;

    try {
      return await redis.decr(key);
    } catch (error) {
      logger.error("Cache decr error", { key, error });
      return 0;
    }
  },

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!redis) return 0;

    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;

      await redis.del(...keys);
      logger.info("Cache pattern deleted", { pattern, count: keys.length });
      return keys.length;
    } catch (error) {
      logger.error("Cache delete pattern error", { pattern, error });
      return 0;
    }
  },
};

/**
 * Create namespaced cache with prefix
 *
 * @example
 * const userCache = createNamespacedCache('user:');
 * await userCache.set('123', userData); // Key: user:123
 */
export function createNamespacedCache(prefix: string) {
  return {
    get: <T = unknown>(key: string) => cache.get<T>(`${prefix}${key}`),
    set: <T = unknown>(key: string, value: T, ttl?: number) =>
      cache.set(`${prefix}${key}`, value, ttl),
    del: (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      return cache.del(keys.map((k) => `${prefix}${k}`));
    },
    exists: (key: string) => cache.exists(`${prefix}${key}`),
    expire: (key: string, ttl: number) => cache.expire(`${prefix}${key}`, ttl),
  };
}

/**
 * Cached function wrapper
 *
 * @example
 * const fetchUser = cached(
 *   async (userId: string) => {
 *     return await db.users.get(userId);
 *   },
 *   (userId) => `user:${userId}`,
 *   3600 // 1 hour
 * );
 */
export function cached<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  keyFn: (...args: TArgs) => string,
  ttl: number
) {
  return async (...args: TArgs): Promise<TReturn> => {
    const key = keyFn(...args);

    // Try cache first
    const cached = await cache.get<TReturn>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function
    const result = await fn(...args);

    // Cache result
    await cache.set(key, result, ttl);

    return result;
  };
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redis !== null;
}
