import type { SupabaseClient } from "@supabase/supabase-js";

import type { EtsyListing, EtsyListingResult, EtsyShop, EtsyTokenResponse } from "./client";
import { fetchEtsyListings, fetchEtsyShops, refreshEtsyToken } from "./client";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type MarketplaceAccount = {
  id: string;
  user_id: string;
  provider_id: string;
  external_shop_id: string;
  shop_name: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  status: string;
  last_synced_at: string | null;
};

export type SyncOptions = {
  limit?: number;
  incremental?: boolean;
};

export type SyncResult = {
  accountId: string;
  listingsProcessed: number;
  listingsUpserted: number;
  tagsUpserted: number;
  statsUpserted: number;
  startedAt: Date;
  finishedAt: Date;
  cursor?: string | null;
  status: "success" | "skipped" | "failed";
  error?: string;
};

function resolveSupabase(client?: SupabaseClient | null): SupabaseClient | null {
  if (client) {
    return client;
  }
  return getSupabaseServerClient();
}

function centsFromPrice(listing: EtsyListing): number | null {
  if (!listing.price) {
    return null;
  }
  const divisor = listing.price.divisor || 100;
  const amount = listing.price.amount || 0;
  if (!divisor) {
    return Math.round(amount);
  }
  return Math.round((amount / divisor) * 100);
}

function isoFromEpoch(epoch?: number | null): string | null {
  if (!epoch || epoch <= 0) {
    return null;
  }
  return new Date(epoch * 1000).toISOString();
}

export async function ensureEtsyProvider(supabase?: SupabaseClient | null): Promise<void> {
  const client = resolveSupabase(supabase);
  if (!client) {
    return;
  }

  const { error } = await client.from("data_providers").upsert(
    {
      id: "etsy",
      display_name: "Etsy Marketplace",
      provider_type: "marketplace",
      is_enabled: true,
      max_freshness_seconds: 6 * 60 * 60,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.warn("Failed to upsert Etsy provider", error);
  }
}

export async function upsertMarketplaceAccount(
  userId: string,
  shop: EtsyShop,
  token: EtsyTokenResponse,
  scopes: string[],
  supabase?: SupabaseClient | null,
): Promise<MarketplaceAccount | null> {
  const client = resolveSupabase(supabase);
  if (!client) {
    return null;
  }

  await ensureEtsyProvider(client);

  const tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const { data, error } = await client
    .from("marketplace_accounts")
    .upsert(
      {
        user_id: userId,
        provider_id: "etsy",
        external_shop_id: String(shop.shop_id),
        shop_name: shop.shop_name,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_expires_at: tokenExpiresAt,
        scopes,
        status: "active",
        metadata: {
          currency: shop.currency_code ?? null,
          createdAt: isoFromEpoch(shop.create_date) ?? null,
          updatedAt: isoFromEpoch(shop.update_date) ?? null,
        },
        last_synced_at: null,
      },
      { onConflict: "provider_id,external_shop_id" },
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to upsert marketplace account", error);
    return null;
  }

  return data as MarketplaceAccount | null;
}

export async function listMarketplaceAccounts(
  userId?: string,
  supabase?: SupabaseClient | null,
): Promise<MarketplaceAccount[]> {
  const client = resolveSupabase(supabase);
  if (!client) {
    return [];
  }

  let query = client
    .from("marketplace_accounts")
    .select(
      "id, user_id, provider_id, external_shop_id, shop_name, access_token, refresh_token, token_expires_at, scopes, status, last_synced_at",
    )
    .eq("provider_id", "etsy")
    .eq("status", "active");

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("Failed to load Etsy accounts", error);
    return [];
  }

  return (data ?? []) as MarketplaceAccount[];
}

async function upsertListings(
  client: SupabaseClient,
  account: MarketplaceAccount,
  listings: EtsyListing[],
): Promise<{ listingsUpserted: number; tagsUpserted: number; statsUpserted: number }> {
  if (listings.length === 0) {
    return { listingsUpserted: 0, tagsUpserted: 0, statsUpserted: 0 };
  }

  const listingPayload = listings.map((listing) => ({
    marketplace_account_id: account.id,
    external_listing_id: String(listing.listing_id),
    title: listing.title,
    description: listing.description ?? null,
    url: listing.url,
    currency: listing.price?.currency_code ?? null,
    price_cents: centsFromPrice(listing),
    quantity: listing.quantity,
    status: listing.state,
    published_at: isoFromEpoch(listing.original_create_timestamp),
    updated_at: isoFromEpoch(listing.last_modified_timestamp) ?? new Date().toISOString(),
    extras: {
      provider: "etsy",
      stats: {
        views: listing.views ?? null,
        favorites: listing.num_favorers ?? null,
      },
    },
  }));

  const { data, error } = await client
    .from("listings")
    .upsert(listingPayload, { onConflict: "marketplace_account_id,external_listing_id" })
    .select("id, external_listing_id");

  if (error) {
    throw new Error(`Failed to upsert listings: ${error.message}`);
  }

  const listingMap = new Map<string, string>();
  for (const record of data ?? []) {
    listingMap.set(record.external_listing_id, record.id);
  }

  const tagsPayload: Array<{ listing_id: string; tag: string; source: string }> = [];
  const statsPayload: Array<{ listing_id: string; recorded_on: string; views: number; favorites: number; extras: Record<string, unknown> }>
    = [];

  for (const listing of listings) {
    const listingId = listingMap.get(String(listing.listing_id));
    if (!listingId) {
      continue;
    }

    for (const tag of listing.tags ?? []) {
      const value = tag.trim();
      if (!value) {
        continue;
      }
      tagsPayload.push({ listing_id: listingId, tag: value.toLowerCase(), source: "seller" });
    }

    const recordedOn = isoFromEpoch(listing.last_modified_timestamp) ?? new Date().toISOString();
    statsPayload.push({
      listing_id: listingId,
      recorded_on: recordedOn.slice(0, 10),
      views: listing.views ?? 0,
      favorites: listing.num_favorers ?? 0,
      extras: {
        provider: "etsy",
        raw: {
          views: listing.views ?? null,
          favorites: listing.num_favorers ?? null,
        },
      },
    });
  }

  if (tagsPayload.length > 0) {
    const { error: tagsError } = await client
      .from("listing_tags")
      .upsert(tagsPayload, { onConflict: "listing_id,tag" });
    if (tagsError) {
      console.warn("Failed to upsert listing tags", tagsError);
    }
  }

  if (statsPayload.length > 0) {
    const { error: statsError } = await client
      .from("listing_stats")
      .upsert(statsPayload, { onConflict: "listing_id,recorded_on" });
    if (statsError) {
      console.warn("Failed to upsert listing stats", statsError);
    }
  }

  return {
    listingsUpserted: listingPayload.length,
    tagsUpserted: tagsPayload.length,
    statsUpserted: statsPayload.length,
  };
}

async function updateSyncState(
  client: SupabaseClient,
  account: MarketplaceAccount,
  result: SyncResult,
  cursor?: string | null,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await client.from("provider_sync_states").upsert(
    {
      marketplace_account_id: account.id,
      sync_type: "etsy:listings",
      cursor: cursor ?? null,
      last_run_at: nowIso,
      next_run_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      status: result.status,
      message: result.error ?? null,
      metadata: {
        listingsProcessed: result.listingsProcessed,
        listingsUpserted: result.listingsUpserted,
      },
    },
    { onConflict: "marketplace_account_id,sync_type" },
  );

  if (error) {
    console.warn("Failed to update provider sync state", error);
  }

  const { error: accountUpdateError } = await client
    .from("marketplace_accounts")
    .update({ last_synced_at: nowIso })
    .eq("id", account.id);

  if (accountUpdateError) {
    console.warn("Failed to update marketplace account last_synced_at", accountUpdateError);
  }
}

async function maybeRefreshToken(account: MarketplaceAccount): Promise<EtsyTokenResponse | null> {
  if (!account.refresh_token) {
    return null;
  }

  if (!account.token_expires_at) {
    return null;
  }

  const expiresAt = new Date(account.token_expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return null;
  }

  return refreshEtsyToken(account.refresh_token);
}

export async function syncEtsyAccount(
  account: MarketplaceAccount,
  options: SyncOptions = {},
  supabase?: SupabaseClient | null,
): Promise<SyncResult> {
  const client = resolveSupabase(supabase);
  const startedAt = new Date();

  if (!client) {
    return {
      accountId: account.id,
      listingsProcessed: 0,
      listingsUpserted: 0,
      tagsUpserted: 0,
      statsUpserted: 0,
      startedAt,
      finishedAt: startedAt,
      status: "skipped",
      error: "Supabase client unavailable",
    };
  }

  let accessToken = account.access_token;
  try {
    const refreshed = await maybeRefreshToken(account);
    if (refreshed) {
      accessToken = refreshed.access_token;
      await client
        .from("marketplace_accounts")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? account.refresh_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", account.id);
    }
  } catch (error) {
    console.warn("Failed to refresh Etsy token", error);
  }

  if (!accessToken) {
    return {
      accountId: account.id,
      listingsProcessed: 0,
      listingsUpserted: 0,
      tagsUpserted: 0,
      statsUpserted: 0,
      startedAt,
      finishedAt: new Date(),
      status: "skipped",
      error: "No access token available for account",
    };
  }

  const updatedSince = options.incremental && account.last_synced_at ? new Date(account.last_synced_at) : null;
  let cursor: string | null | undefined = undefined;
  let processed = 0;
  let upserted = 0;
  let tags = 0;
  let stats = 0;
  let page: EtsyListingResult | null = null;

  try {
    do {
      page = await fetchEtsyListings(accessToken, Number(account.external_shop_id), {
        limit: options.limit,
        updatedSince,
        cursor,
      });
      processed += page.listings.length;
      const writeResult = await upsertListings(client, account, page.listings);
      upserted += writeResult.listingsUpserted;
      tags += writeResult.tagsUpserted;
      stats += writeResult.statsUpserted;
      cursor = page.cursor;
    } while (cursor);

    const result: SyncResult = {
      accountId: account.id,
      listingsProcessed: processed,
      listingsUpserted: upserted,
      tagsUpserted: tags,
      statsUpserted: stats,
      startedAt,
      finishedAt: new Date(),
      cursor: cursor ?? null,
      status: "success",
    };

    await updateSyncState(client, account, result, cursor ?? null);
    return result;
  } catch (error) {
    const failure: SyncResult = {
      accountId: account.id,
      listingsProcessed: processed,
      listingsUpserted: upserted,
      tagsUpserted: tags,
      statsUpserted: stats,
      startedAt,
      finishedAt: new Date(),
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
    await updateSyncState(client, account, failure, cursor ?? null);
    return failure;
  }
}

export async function syncAllEtsyAccounts(
  options: SyncOptions & { userId?: string } = {},
  supabase?: SupabaseClient | null,
): Promise<SyncResult[]> {
  const accounts = await listMarketplaceAccounts(options.userId, supabase);
  const results: SyncResult[] = [];
  for (const account of accounts) {
    const result = await syncEtsyAccount(account, options, supabase);
    results.push(result);
  }
  return results;
}

export async function linkEtsyAccount(
  userId: string,
  accessToken: string,
  scopes: string[],
  supabase?: SupabaseClient | null,
): Promise<MarketplaceAccount | null> {
  const shops = await fetchEtsyShops(accessToken);
  const primary = shops[0];
  if (!primary) {
    throw new Error("No Etsy shops were returned for the account");
  }

  const token: EtsyTokenResponse = {
    access_token: accessToken,
    refresh_token: accessToken,
    expires_in: 3600,
    token_type: "Bearer",
    scope: scopes.join(" "),
  };

  return upsertMarketplaceAccount(userId, primary, token, scopes, supabase);
}
