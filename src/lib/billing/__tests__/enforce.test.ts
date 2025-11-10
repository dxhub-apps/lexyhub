import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../supabase-server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import { getSupabaseServerClient } from "../../supabase-server";
import {
  enforceQuota,
  getCurrentUsage,
  QuotaExceededError,
  type QuotaKey,
  type StandardQuotaKey,
  type LegacyQuotaKey,
} from "../enforce";

const supabaseClientMock = vi.mocked(getSupabaseServerClient);

type QuotaRPCResult = {
  allowed: boolean;
  used: number;
  limit: number;
};

function createMockSupabase({
  rpcResult,
  rpcError = null,
}: {
  rpcResult?: QuotaRPCResult;
  rpcError?: Error | null;
}) {
  return {
    rpc: vi.fn(async () => {
      if (rpcError) {
        return { data: null, error: rpcError };
      }
      return { data: [rpcResult], error: null };
    }),
  };
}

describe("enforceQuota", () => {
  const testUserId = "test-user-123";

  beforeEach(() => {
    supabaseClientMock.mockReset();
  });

  describe("Standard quota keys (v1)", () => {
    it("should enforce KS (keyword search) quota successfully", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: true, used: 10, limit: 50 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const result = await enforceQuota(testUserId, "ks", 1);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(10);
      expect(result.limit).toBe(50);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("use_quota", {
        p_user: testUserId,
        p_key: "ks",
        p_amount: 1,
      });
    });

    it("should enforce LB (LexyBrain) quota successfully", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: true, used: 5, limit: 20 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const result = await enforceQuota(testUserId, "lb", 1);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(5);
      expect(result.limit).toBe(20);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("use_quota", {
        p_user: testUserId,
        p_key: "lb",
        p_amount: 1,
      });
    });

    it("should enforce BR (briefs) quota successfully", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: true, used: 0, limit: 1 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const result = await enforceQuota(testUserId, "br", 1);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.limit).toBe(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("use_quota", {
        p_user: testUserId,
        p_key: "br",
        p_amount: 1,
      });
    });

    it("should enforce WL (watchlist) quota successfully", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: true, used: 5, limit: 10 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const result = await enforceQuota(testUserId, "wl", 1);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(5);
      expect(result.limit).toBe(10);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("use_quota", {
        p_user: testUserId,
        p_key: "wl",
        p_amount: 1,
      });
    });
  });

  describe("Legacy quota keys (backward compatibility)", () => {
    it("should enforce 'searches' quota successfully", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: true, used: 25, limit: 50 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const result = await enforceQuota(testUserId, "searches", 1);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(25);
      expect(result.limit).toBe(50);
    });

    it("should enforce 'ai_opportunities' quota successfully", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: true, used: 10, limit: 20 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const result = await enforceQuota(testUserId, "ai_opportunities", 1);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(10);
      expect(result.limit).toBe(20);
    });

    it("should enforce 'niches' quota successfully", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: true, used: 3, limit: 10 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const result = await enforceQuota(testUserId, "niches", 1);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(3);
      expect(result.limit).toBe(10);
    });
  });

  describe("Quota exceeded scenarios", () => {
    it("should throw QuotaExceededError when quota is exceeded", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: false, used: 50, limit: 50 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      await expect(enforceQuota(testUserId, "ks", 1)).rejects.toThrow(
        QuotaExceededError
      );

      try {
        await enforceQuota(testUserId, "ks", 1);
      } catch (error) {
        expect(error).toBeInstanceOf(QuotaExceededError);
        if (error instanceof QuotaExceededError) {
          expect(error.used).toBe(50);
          expect(error.limit).toBe(50);
          expect(error.key).toBe("ks");
        }
      }
    });

    it("should throw QuotaExceededError for briefs when limit reached", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: false, used: 1, limit: 1 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      await expect(enforceQuota(testUserId, "br", 1)).rejects.toThrow(
        QuotaExceededError
      );

      try {
        await enforceQuota(testUserId, "br", 1);
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          expect(error.key).toBe("br");
          expect(error.used).toBe(1);
          expect(error.limit).toBe(1);
        }
      }
    });

    it("should throw QuotaExceededError for legacy keys", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: false, used: 20, limit: 20 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      await expect(
        enforceQuota(testUserId, "ai_opportunities", 1)
      ).rejects.toThrow(QuotaExceededError);
    });
  });

  describe("Multi-unit quota consumption", () => {
    it("should enforce quota with custom amount", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: true, used: 15, limit: 50 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const result = await enforceQuota(testUserId, "ks", 5);

      expect(result.allowed).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("use_quota", {
        p_user: testUserId,
        p_key: "ks",
        p_amount: 5,
      });
    });

    it("should reject when custom amount exceeds remaining quota", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: false, used: 48, limit: 50 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      await expect(enforceQuota(testUserId, "ks", 5)).rejects.toThrow(
        QuotaExceededError
      );
    });
  });

  describe("Error handling", () => {
    it("should throw error when Supabase client is unavailable", async () => {
      supabaseClientMock.mockReturnValue(null as never);

      await expect(enforceQuota(testUserId, "ks", 1)).rejects.toThrow(
        "Supabase client unavailable"
      );
    });

    it("should throw error when RPC fails", async () => {
      const mockSupabase = createMockSupabase({
        rpcError: new Error("Database connection failed"),
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      await expect(enforceQuota(testUserId, "ks", 1)).rejects.toThrow(
        "Failed to check quota: Database connection failed"
      );
    });

    it("should throw error when RPC returns no data", async () => {
      const mockSupabase = {
        rpc: vi.fn(async () => ({ data: null, error: null })),
      };
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      await expect(enforceQuota(testUserId, "ks", 1)).rejects.toThrow(
        "No quota data returned"
      );
    });
  });

  describe("Usage warning thresholds", () => {
    it("should return correct values at 80% threshold (warning level)", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: true, used: 40, limit: 50 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const result = await enforceQuota(testUserId, "ks", 1);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(40);
      expect(result.limit).toBe(50);
      expect((result.used / result.limit) * 100).toBeGreaterThanOrEqual(80);
    });

    it("should return correct values at 90% threshold (critical level)", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: true, used: 45, limit: 50 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const result = await enforceQuota(testUserId, "ks", 1);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(45);
      expect(result.limit).toBe(50);
      expect((result.used / result.limit) * 100).toBeGreaterThanOrEqual(90);
    });

    it("should handle 100% usage (quota exceeded)", async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { allowed: false, used: 50, limit: 50 },
      });
      supabaseClientMock.mockReturnValue(mockSupabase as never);

      await expect(enforceQuota(testUserId, "ks", 1)).rejects.toThrow(
        QuotaExceededError
      );
    });
  });
});

describe("getCurrentUsage", () => {
  const testUserId = "test-user-123";

  beforeEach(() => {
    supabaseClientMock.mockReset();
  });

  it("should return usage for all legacy quota keys", async () => {
    const mockSupabase = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ allowed: true, used: 25, limit: 50 }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ allowed: true, used: 10, limit: 20 }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ allowed: true, used: 5, limit: 10 }],
          error: null,
        }),
    };
    supabaseClientMock.mockReturnValue(mockSupabase as never);

    const usage = await getCurrentUsage(testUserId);

    expect(usage.searches).toEqual({ used: 25, limit: 50 });
    expect(usage.ai_opportunities).toEqual({ used: 10, limit: 20 });
    expect(usage.niches).toEqual({ used: 5, limit: 10 });
  });

  it("should handle errors gracefully", async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Database error"),
      }),
    };
    supabaseClientMock.mockReturnValue(mockSupabase as never);

    await expect(getCurrentUsage(testUserId)).rejects.toThrow();
  });
});

describe("Type validation", () => {
  it("should accept all standard quota keys", () => {
    const standardKeys: StandardQuotaKey[] = ["ks", "lb", "br", "wl"];

    // This test verifies TypeScript compilation - if it compiles, types are correct
    standardKeys.forEach((key) => {
      expect(["ks", "lb", "br", "wl"]).toContain(key);
    });
  });

  it("should accept all legacy quota keys", () => {
    const legacyKeys: LegacyQuotaKey[] = [
      "searches",
      "ai_opportunities",
      "niches",
    ];

    // This test verifies TypeScript compilation - if it compiles, types are correct
    legacyKeys.forEach((key) => {
      expect(["searches", "ai_opportunities", "niches"]).toContain(key);
    });
  });

  it("should accept both standard and legacy keys as QuotaKey", () => {
    const allKeys: QuotaKey[] = [
      "ks",
      "lb",
      "br",
      "wl",
      "searches",
      "ai_opportunities",
      "niches",
    ];

    // This test verifies TypeScript compilation - if it compiles, types are correct
    expect(allKeys.length).toBe(7);
  });
});
