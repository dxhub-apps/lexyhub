import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type {
  KeywordUpsertPayload,
  ListingKeywordPayload,
  ListingTagPayload,
  RawSourcePayload,
  UpsertPayloads,
} from "./payloads";

function formatPostgrestError(error: PostgrestError): string {
  return `${error.code ?? ""} ${error.message}`.trim();
}

async function executeStoredTransaction(
  client: SupabaseClient,
  payloads: UpsertPayloads,
): Promise<boolean> {
  try {
    const { error } = await client.rpc("etsy_ingest_transaction", {
      listing: payloads.listing,
      keywords: payloads.keywords,
      listing_keywords: payloads.listingKeywords,
      listing_tags: payloads.listingTags,
      raw_source: payloads.rawSource,
    });
    if (error) {
      console.warn(`Stored transaction failed (${formatPostgrestError(error)}), falling back to sequential upserts.`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Stored transaction invocation unavailable, falling back to sequential upserts.", error);
    return false;
  }
}

async function upsertListing(client: SupabaseClient, payload: UpsertPayloads["listing"]): Promise<string> {
  const { data, error } = await client
    .from("listings")
    .upsert(payload, { onConflict: "marketplace_account_id,external_listing_id" })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Failed to upsert listing: ${formatPostgrestError(error)}`);
  }
  if (!data?.id) {
    throw new Error("Listing upsert did not return an identifier");
  }
  return data.id as string;
}

async function upsertKeywords(
  client: SupabaseClient,
  payloads: KeywordUpsertPayload[],
): Promise<Map<string, string>> {
  if (!payloads.length) {
    return new Map();
  }

  // Use lexy_upsert_keyword RPC for each keyword (Task 3)
  const map = new Map<string, string>();
  for (const payload of payloads) {
    try {
      const { data, error } = await client.rpc('lexy_upsert_keyword', {
        p_term: payload.term,
        p_market: payload.market,
        p_source: payload.source,
        p_tier: 0,
        p_method: 'etsy_ingest',
        p_extras: payload.extras || {},
        p_freshness: new Date().toISOString(),
      });
      if (error) {
        console.warn(`Failed to upsert keyword "${payload.term}": ${formatPostgrestError(error)}`);
        continue;
      }
      if (data) {
        map.set(payload.term, data as string);
      }
    } catch (error) {
      console.warn(`Error upserting keyword "${payload.term}":`, error);
    }
  }

  return map;
}

async function upsertListingKeywords(
  client: SupabaseClient,
  listingId: string,
  payloads: ListingKeywordPayload[],
  keywordMap: Map<string, string>,
): Promise<void> {
  if (!payloads.length) {
    return;
  }
  const rows = payloads
    .map((payload) => {
      const keywordId = keywordMap.get(payload.term);
      if (!keywordId) {
        return null;
      }
      return {
        listing_id: listingId,
        keyword_id: keywordId,
        source: payload.source,
      };
    })
    .filter((row): row is { listing_id: string; keyword_id: string; source: string } => Boolean(row));
  if (!rows.length) {
    return;
  }
  const { error } = await client
    .from("listing_keywords")
    .upsert(rows, { onConflict: "listing_id,keyword_id,source" });
  if (error) {
    throw new Error(`Failed to upsert listing keyword relationships: ${formatPostgrestError(error)}`);
  }
}

async function upsertListingTags(
  client: SupabaseClient,
  listingId: string,
  payloads: ListingTagPayload[],
): Promise<void> {
  if (!payloads.length) {
    return;
  }
  const rows = payloads.map((payload) => ({
    listing_id: listingId,
    tag: payload.tag,
    source: payload.source,
  }));
  const { error } = await client.from("listing_tags").upsert(rows, { onConflict: "listing_id,tag" });
  if (error) {
    throw new Error(`Failed to upsert listing tags: ${formatPostgrestError(error)}`);
  }
}

async function recordRawSource(client: SupabaseClient, payload: RawSourcePayload): Promise<void> {
  const { error } = await client.from("raw_sources").insert(payload);
  if (error) {
    throw new Error(`Failed to insert raw source payload: ${formatPostgrestError(error)}`);
  }
}

export async function persistInSupabase(client: SupabaseClient, payloads: UpsertPayloads): Promise<void> {
  const executedTransaction = await executeStoredTransaction(client, payloads);
  if (executedTransaction) {
    return;
  }

  const listingId = await upsertListing(client, payloads.listing);
  const keywordMap = await upsertKeywords(client, payloads.keywords);
  await upsertListingKeywords(client, listingId, payloads.listingKeywords, keywordMap);
  await upsertListingTags(client, listingId, payloads.listingTags);
  await recordRawSource(client, payloads.rawSource);
}
