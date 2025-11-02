#!/usr/bin/env node
import { EtsyProviderFactory } from "@/lib/etsy/providers/factory";
import type { NormalizedEtsyShop } from "@/lib/etsy/types";
import { getFeatureFlags } from "@/lib/feature-flags";
import { getSupabaseServerClient } from "@/lib/supabase-server";

import { loadConfig } from "./config";
import { extractListingKeywords } from "./keywords";
import { buildUpsertPayloads } from "./payloads";
import { normalizeListing } from "./normalize";
import { persistInSupabase } from "./supabase";

async function loadShop(
  listingShopUrl: string | null,
  provider: ReturnType<typeof EtsyProviderFactory.get>,
  preferredShopUrl?: string,
): Promise<NormalizedEtsyShop | null> {
  const shopUrl = preferredShopUrl ?? listingShopUrl ?? null;
  if (!shopUrl || typeof provider.getShopByUrl !== "function") {
    return null;
  }

  try {
    return await provider.getShopByUrl(shopUrl);
  } catch (error) {
    console.warn(`Failed to load shop details from ${shopUrl}`, error);
    return null;
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const provider = EtsyProviderFactory.get();
  const listing = await provider.getListingByUrl(config.listingUrl);
  const shop = await loadShop(listing.shop.url ?? null, provider, config.shopUrl);
  const normalizedListing = normalizeListing(listing, { shop });
  const keywords = await extractListingKeywords(normalizedListing, config.keywordsEnabled);

  const supabase = getSupabaseServerClient();
  const flags = await getFeatureFlags({ supabase });

  if (!flags.require_official_etsy_api) {
    console.warn("Etsy ingest skipped because require_official_etsy_api is disabled.");
    return;
  }

  if (!supabase) {
    throw new Error("Supabase service client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const payloads = buildUpsertPayloads(normalizedListing, keywords, {
    marketplaceAccountId: config.marketplaceAccountId,
    providerId: config.providerId,
    providerName: config.providerName,
    featureFlags: config.featureFlags,
  });

  await persistInSupabase(supabase, payloads);

  console.log(
    JSON.stringify(
      {
        message: "Etsy listing ingested",
        listingId: normalizedListing.id,
        listingUrl: normalizedListing.url,
        keywords: keywords.length,
        provider: config.providerId,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Etsy ingest job failed", error);
  process.exit(1);
});
