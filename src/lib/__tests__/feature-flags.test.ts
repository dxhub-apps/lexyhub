import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFeatureFlags,
  isFeatureFlagEnabled,
  invalidateFeatureFlagCache,
  requireOfficialEtsyApiEnabled,
  allowSearchSamplingEnabled,
  allowUserTelemetryEnabled,
} from "../feature-flags";

vi.mock("../supabase-server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import { getSupabaseServerClient } from "../supabase-server";

const supabaseClientMock = vi.mocked(getSupabaseServerClient);

describe("Feature Flags", () => {
  beforeEach(() => {
    supabaseClientMock.mockReset();
    invalidateFeatureFlagCache();
  });

  describe("getFeatureFlags", () => {
    it("returns default flags when database returns empty", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const flags = await getFeatureFlags();

      expect(flags).toEqual({
        require_official_etsy_api: false,
        allow_search_sampling: false,
        allow_user_telemetry: false,
      });
    });

    it("merges database flags with defaults", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            { key: "require_official_etsy_api", is_enabled: true },
            { key: "allow_user_telemetry", is_enabled: true },
          ],
          error: null,
        }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const flags = await getFeatureFlags();

      expect(flags).toEqual({
        require_official_etsy_api: true,
        allow_search_sampling: false,
        allow_user_telemetry: true,
      });
    });

    it("handles database errors gracefully", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const flags = await getFeatureFlags();

      // Should return defaults on error
      expect(flags).toEqual({
        require_official_etsy_api: false,
        allow_search_sampling: false,
        allow_user_telemetry: false,
      });
    });

    it("caches flags for subsequent calls", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ key: "allow_user_telemetry", is_enabled: true }],
          error: null,
        }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      // First call
      await getFeatureFlags();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await getFeatureFlags();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it("bypasses cache with forceRefresh option", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      // First call
      await getFeatureFlags();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Force refresh
      await getFeatureFlags({ forceRefresh: true });
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });

    it("uses custom supabase client when provided", async () => {
      const customSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      await getFeatureFlags({ supabase: customSupabase as never });

      expect(customSupabase.from).toHaveBeenCalledWith("feature_flags");
      expect(supabaseClientMock).not.toHaveBeenCalled();
    });
  });

  describe("isFeatureFlagEnabled", () => {
    it("returns correct value for enabled flag", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ key: "allow_user_telemetry", is_enabled: true }],
          error: null,
        }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const enabled = await isFeatureFlagEnabled("allow_user_telemetry");
      expect(enabled).toBe(true);
    });

    it("returns correct value for disabled flag", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ key: "allow_user_telemetry", is_enabled: false }],
          error: null,
        }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const enabled = await isFeatureFlagEnabled("allow_user_telemetry");
      expect(enabled).toBe(false);
    });
  });

  describe("helper functions", () => {
    it("requireOfficialEtsyApiEnabled works correctly", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ key: "require_official_etsy_api", is_enabled: true }],
          error: null,
        }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const enabled = await requireOfficialEtsyApiEnabled();
      expect(enabled).toBe(true);
    });

    it("allowSearchSamplingEnabled works correctly", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ key: "allow_search_sampling", is_enabled: true }],
          error: null,
        }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const enabled = await allowSearchSamplingEnabled();
      expect(enabled).toBe(true);
    });

    it("allowUserTelemetryEnabled works correctly", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ key: "allow_user_telemetry", is_enabled: true }],
          error: null,
        }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      const enabled = await allowUserTelemetryEnabled();
      expect(enabled).toBe(true);
    });
  });

  describe("invalidateFeatureFlagCache", () => {
    it("clears cache forcing database fetch", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      supabaseClientMock.mockReturnValue(mockSupabase as never);

      // First call
      await getFeatureFlags();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Invalidate and call again
      invalidateFeatureFlagCache();
      await getFeatureFlags();
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });
  });
});
