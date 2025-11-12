/**
 * Seasonal Context Utilities
 *
 * Fetches current and upcoming seasonal periods to enrich LexyBrain prompts
 * with timely seller opportunities.
 */

import { createServerClient } from "@/lib/supabase/server";

export interface SeasonalPeriod {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  weight: number;
  tags: string[];
  days_remaining?: number;
  days_until?: number;
}

export interface SeasonalContext {
  current_periods?: SeasonalPeriod[];
  upcoming_periods?: SeasonalPeriod[];
}

/**
 * Fetch seasonal context for LexyBrain enrichment
 *
 * @param country_code - Country code for localized seasons (e.g., 'US', 'GB', 'global')
 * @param lookahead_days - How many days ahead to look for upcoming periods (default: 60)
 * @returns Seasonal context with current and upcoming periods
 */
export async function getSeasonalContext(
  country_code: string = "global",
  lookahead_days: number = 60
): Promise<SeasonalContext | null> {
  try {
    const supabase = await createServerClient();

    // Call the database function we created in the migration
    const { data, error } = await supabase.rpc("get_seasonal_context", {
      p_as_of: new Date().toISOString().split("T")[0], // Today's date
      p_country_code: country_code,
      p_lookahead_days: lookahead_days,
    });

    if (error) {
      console.error("Error fetching seasonal context:", error);
      return null;
    }

    if (!data) {
      return { current_periods: [], upcoming_periods: [] };
    }

    return {
      current_periods: data.current_periods || [],
      upcoming_periods: data.upcoming_periods || [],
    };
  } catch (error) {
    console.error("Failed to fetch seasonal context:", error);
    return null;
  }
}

/**
 * Check if there are any active high-priority seasonal periods
 * (weight >= 1.5) to highlight urgency to sellers
 */
export function hasHighPrioritySeasons(context: SeasonalContext | null): boolean {
  if (!context) return false;

  const currentHighPriority =
    context.current_periods?.some((p) => p.weight >= 1.5) || false;
  const upcomingHighPriority =
    context.upcoming_periods?.some((p) => p.weight >= 1.8 && (p.days_until || 999) <= 30) ||
    false;

  return currentHighPriority || upcomingHighPriority;
}

/**
 * Get a human-readable summary of active seasonal periods
 * Useful for notifications or UI displays
 */
export function getSeasonalSummary(context: SeasonalContext | null): string {
  if (!context) return "";

  const parts: string[] = [];

  if (context.current_periods && context.current_periods.length > 0) {
    const names = context.current_periods.map((p) => p.name).join(", ");
    parts.push(`Active: ${names}`);
  }

  if (context.upcoming_periods && context.upcoming_periods.length > 0) {
    const critical = context.upcoming_periods.filter(
      (p) => p.weight >= 1.8 && (p.days_until || 999) <= 30
    );
    if (critical.length > 0) {
      const names = critical.map((p) => p.name).join(", ");
      parts.push(`Coming soon: ${names}`);
    }
  }

  return parts.join(" | ");
}

/**
 * Determine the country code from user profile or default to global
 */
export async function getUserCountryCode(userId: string): Promise<string> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("user_profiles")
      .select("extras")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return "global";
    }

    // Check for country in extras JSON field
    const country = data.extras?.country;
    return typeof country === "string" ? country : "global";
  } catch (error) {
    console.error("Failed to fetch user country:", error);
    return "global";
  }
}
