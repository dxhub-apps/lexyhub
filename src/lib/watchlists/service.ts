import { getSupabaseServerClient } from "../supabase-server";
import { assertQuota, QuotaError, recordUsage, resolvePlanContext } from "../usage/quotas";

export type WatchlistRecord = {
  id: string;
  name: string;
  description?: string | null;
  capacity: number;
};

export type WatchlistItemRecord = {
  id: string;
  addedAt: string;
  keyword?: {
    id: string;
    term: string;
    market: string;
  } | null;
  listing?: {
    id: string;
    title: string;
    url?: string | null;
  } | null;
};

export type WatchlistWithItems = WatchlistRecord & {
  items: WatchlistItemRecord[];
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

export async function listWatchlists(userId: string): Promise<WatchlistWithItems[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { data, error } = await supabase
    .from("watchlists")
    .select(
      `id, name, description, capacity,
       items:watchlist_items (
         id,
         added_at,
         keyword_id,
         listing_id,
         keywords:keyword_id ( id, term, market ),
         listings:listing_id ( id, title, url )
       )`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("added_at", { ascending: false, foreignTable: "items" });

  if (error) {
    throw new Error(error.message);
  }

  const watchlists = (data ?? []).map((raw) => {
    const items = (raw.items ?? []).map((item: any) => ({
      id: item.id as string,
      addedAt: item.added_at as string,
      keyword: item.keywords
        ? {
            id: String(item.keywords.id ?? ""),
            term: String(item.keywords.term ?? ""),
            market: String(item.keywords.market ?? ""),
          }
        : null,
      listing: item.listings
        ? {
            id: String(item.listings.id ?? ""),
            title: String(item.listings.title ?? ""),
            url: item.listings.url ?? null,
          }
        : null,
    })) as WatchlistItemRecord[];

    return {
      id: String(raw.id ?? ""),
      name: String(raw.name ?? ""),
      description: raw.description ?? null,
      capacity: Number(raw.capacity ?? 0),
      items,
    } satisfies WatchlistWithItems;
  });

  return watchlists;
}

export async function removeWatchlistItem(userId: string, itemId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { data: item, error: fetchError } = await supabase
    .from("watchlist_items")
    .select("id, owner:watchlists!inner(user_id)")
    .eq("id", itemId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!item) {
    return false;
  }

  if ((item as any).owner?.user_id !== userId) {
    throw new Error("You are not allowed to modify this watchlist.");
  }

  const { error: deleteError } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", itemId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return true;
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
