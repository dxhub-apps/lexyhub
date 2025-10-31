import { getSupabaseServerClient } from "../supabase-server";
import { assertQuota, QuotaError, recordUsage, resolvePlanContext } from "../usage/quotas";

export type WatchlistRecord = {
  id: string;
  name: string;
  description?: string | null;
  capacity: number;
};

export async function ensureWatchlist(
  userId: string,
  options: { name?: string; description?: string },
): Promise<WatchlistRecord | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const name = options.name ?? "Operational Watchlist";

  const { data: existing, error: fetchError } = await supabase
    .from("watchlists")
    .select("id, name, description, capacity")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw new Error(fetchError.message);
  }

  if (existing) {
    return existing as WatchlistRecord;
  }

  const plan = await resolvePlanContext(userId);

  const { data: watchlists, count, error: countError } = await supabase
    .from("watchlists")
    .select("id", { count: "exact" })
    .eq("user_id", userId);

  if (countError) {
    throw new Error(countError.message);
  }

  const total = typeof count === "number" ? count : watchlists?.length ?? 0;
  if (total >= plan.limits.watchlistLimit) {
    throw new QuotaError("Watchlist limit reached for current plan.");
  }

  const capacity = plan.limits.watchlistItemCapacity;

  const { data, error } = await supabase
    .from("watchlists")
    .insert({
      user_id: userId,
      name,
      description: options.description ?? null,
      capacity,
    })
    .select("id, name, description, capacity")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as WatchlistRecord;
}

export async function addItemToWatchlist({
  userId,
  watchlistId,
  keywordId,
  listingId,
}: {
  userId: string;
  watchlistId: string;
  keywordId?: string;
  listingId?: string;
}): Promise<{ id: string } | null> {
  if (!keywordId && !listingId) {
    throw new Error("A keywordId or listingId is required to add a watchlist item.");
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const plan = await assertQuota(userId, "watchlist_add");

  const { data: watchlist, error: watchlistError } = await supabase
    .from("watchlists")
    .select("id, capacity")
    .eq("id", watchlistId)
    .eq("user_id", userId)
    .maybeSingle();

  if (watchlistError || !watchlist) {
    throw new Error(watchlistError?.message ?? "Watchlist not found");
  }

  const { data: items, count, error: countError } = await supabase
    .from("watchlist_items")
    .select("id", { count: "exact" })
    .eq("watchlist_id", watchlistId);

  if (countError) {
    throw new Error(countError.message);
  }

  const totalItems = typeof count === "number" ? count : items?.length ?? 0;
  const maxItems = watchlist.capacity ?? plan.limits.watchlistItemCapacity;

  if (totalItems >= maxItems) {
    throw new QuotaError("Watchlist is at capacity for the current plan.");
  }

  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({
      watchlist_id: watchlistId,
      keyword_id: keywordId ?? null,
      listing_id: listingId ?? null,
      added_by: userId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new QuotaError("This item is already on the watchlist.");
    }
    throw new Error(error.message);
  }

  await recordUsage(userId, "watchlist_add", 1, {
    watchlist_id: watchlistId,
    keyword_id: keywordId,
    listing_id: listingId,
  });

  return data as { id: string };
}
