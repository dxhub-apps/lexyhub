import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../supabase-server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import { getSupabaseServerClient } from "../supabase-server";
import { resolvePlanContext } from "../usage/quotas";

const supabaseClientMock = vi.mocked(getSupabaseServerClient);

type OverrideRow = {
  plan?: string | null;
  daily_query_limit?: number | null;
  watchlist_limit?: number | null;
  watchlist_item_capacity?: number | null;
  ai_suggestion_limit?: number | null;
  momentum_multiplier?: number | null;
};

type ProfileRow = {
  plan?: string | null;
  momentum?: string | null;
};

function createMockSupabase({
  profile,
  override,
}: {
  profile?: ProfileRow | null;
  override?: OverrideRow | null;
}) {
  const userProfilesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: profile ?? null, error: null })),
  };

  const planOverridesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi
      .fn()
      .mockResolvedValue({
        data: override ? [override] : [],
        error: null,
      }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "user_profiles") {
        return userProfilesQuery;
      }
      if (table === "plan_overrides") {
        return planOverridesQuery;
      }
      throw new Error(`Unexpected table requested: ${table}`);
    }),
  };
}

describe("resolvePlanContext", () => {
  beforeEach(() => {
    supabaseClientMock.mockReset();
  });

  it("respects zero-valued plan overrides", async () => {
    const mockSupabase = createMockSupabase({
      profile: { plan: "scale", momentum: "steady" },
      override: {
        daily_query_limit: 0,
        watchlist_limit: 0,
        watchlist_item_capacity: 0,
        ai_suggestion_limit: 0,
        momentum_multiplier: 2,
      },
    });

    supabaseClientMock.mockReturnValue(mockSupabase as never);

    const context = await resolvePlanContext("user-123");

    expect(context.plan).toBe("scale");
    expect(context.limits.dailyQueryLimit).toBe(0);
    expect(context.limits.watchlistLimit).toBe(0);
    expect(context.limits.watchlistItemCapacity).toBe(0);
    expect(context.limits.aiSuggestionLimit).toBe(0);
    expect(context.momentumMultiplier).toBe(2);
  });
});
