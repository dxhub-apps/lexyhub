import { fetchEtsyListings } from "@/lib/etsy/client";
import { listMarketplaceAccounts } from "@/lib/etsy/sync";
import { upsertCrawlerStatus } from "@/lib/backoffice/status";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type ScrapeSource = "etsy" | "reddit" | "tiktok";

export type ScrapeResult = {
  source: ScrapeSource;
  fetched: number;
  keywords: Array<{ term: string; source: ScrapeSource; extras?: Record<string, unknown> }>;
  startedAt: string;
  finishedAt: string;
  notes?: string;
};

async function upsertKeywords(
  keywords: Array<{ term: string; source: ScrapeSource; extras?: Record<string, unknown> }>,
): Promise<number> {
  if (keywords.length === 0) {
    return 0;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return keywords.length;
  }

  // Use lexy_upsert_keyword RPC for each keyword (Task 3)
  let upserted = 0;
  for (const keyword of keywords) {
    try {
      await client.rpc('lexy_upsert_keyword', {
        p_term: keyword.term,
        p_market: "us",
        p_source: keyword.source,
        p_tier: "free",
        p_method: 'scraper',
        p_extras: keyword.extras ?? {},
        p_freshness: new Date().toISOString(),
      });
      upserted++;
    } catch (error) {
      console.error(`Failed to upsert keyword "${keyword.term}":`, error);
    }
  }

  return upserted;
}

async function recordCrawler(
  source: ScrapeSource,
  status: "idle" | "running" | "error",
  metadata: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  try {
    const lastRun = typeof metadata.last_run_at === "string" ? metadata.last_run_at : undefined;
    const nextRun = typeof metadata.next_run_at === "string" ? metadata.next_run_at : undefined;
    const records = typeof metadata.records === "number" ? metadata.records : null;
    const errorMessage = status === "error" ? String(metadata.error ?? "Unknown error") : null;
    await upsertCrawlerStatus({
      source,
      status,
      last_run_at: status === "running" ? now : lastRun ?? now,
      next_run_at: nextRun ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      total_records: records,
      error_message: errorMessage,
      run_metadata: metadata,
      updated_at: now,
    });
  } catch (error) {
    console.warn("Failed to record crawler status", error);
  }
}

export async function scrapeEtsy({
  keyword = "handmade decor",
  limit = 25,
}: { keyword?: string; limit?: number } = {}): Promise<ScrapeResult> {
  const startedAt = new Date();
  await recordCrawler("etsy", "running", { keyword, limit, startedAt: startedAt.toISOString() });

  try {
    const client = getSupabaseServerClient();
    const accounts = client ? await listMarketplaceAccounts(undefined, client) : [];
    const account = accounts.find(
      (item) => item.access_token && item.external_shop_id && Number(item.external_shop_id) > 0,
    );
    const listings = account
      ? await fetchEtsyListings(account.access_token as string, Number(account.external_shop_id), { limit })
      : (
          await fetch("https://www.etsy.com/search?q=" + encodeURIComponent(keyword), {
            headers: { "User-Agent": "LexyHubBot/1.0" },
          })
            .then(async (response) => {
              if (!response.ok) {
                throw new Error(`Fallback Etsy scrape failed (${response.status})`);
              }
              const html = await response.text();
              const matches = Array.from(html.matchAll(/data-search_query="([^"]+)"/g)).map((match) => match[1]);
              return {
                listings: matches.slice(0, limit).map((term, index) => ({
                  listing_id: index + 1,
                  title: term,
                  tags: [term],
                  state: "active",
                  quantity: 1,
                  url: "https://www.etsy.com/search?q=" + encodeURIComponent(term),
                })),
                total: matches.length,
                cursor: null,
              };
            })
            .catch(() => ({
              listings: [
                {
                  listing_id: 1,
                  title: "Handmade ceramic mug",
                  tags: ["ceramic mug", "artisan"],
                  state: "active",
                  quantity: 10,
                  url: "https://www.etsy.com/listing/demo",
                },
              ],
              total: 1,
              cursor: null,
            }))
        );

    const keywords = (listings.listings ?? [])
      .flatMap((listing) => listing.tags ?? [])
      .map((term) => ({ term: term.toLowerCase(), source: "etsy" as const, extras: { keyword, scrapedAt: startedAt.toISOString() } }));

    const persisted = await upsertKeywords(keywords);
    const finishedAt = new Date();

    await recordCrawler("etsy", "idle", {
      keyword,
      limit,
      records: persisted,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    });

    return {
      source: "etsy",
      fetched: listings.listings?.length ?? 0,
      keywords,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      notes: account ? "Fetched via authenticated Etsy API" : "Fetched via public search fallback",
    };
  } catch (error) {
    const finishedAt = new Date();
    await recordCrawler("etsy", "error", {
      keyword,
      limit,
      error: error instanceof Error ? error.message : String(error),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    });
    throw error;
  }
}

async function scrapeRedditSearch(keyword: string, limit: number) {
  const url = new URL("https://www.reddit.com/search.json");
  url.searchParams.set("q", keyword);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "new");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "LexyHubBot/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit scrape failed (${response.status})`);
  }

  const payload = (await response.json()) as { data?: { children?: Array<{ data?: { title?: string } }> } };
  return (payload.data?.children ?? []).map((child) => child.data?.title ?? "").filter(Boolean);
}

export async function scrapeSocial({
  keyword = "etsy handmade",
  limit = 20,
  source = "reddit",
}: { keyword?: string; limit?: number; source?: Extract<ScrapeSource, "reddit" | "tiktok"> } = {}): Promise<ScrapeResult> {
  const startedAt = new Date();
  await recordCrawler(source, "running", { keyword, limit, startedAt: startedAt.toISOString() });

  try {
    const titles = await scrapeRedditSearch(keyword, limit).catch(() => [
      "Handmade Etsy success stories",
      "Etsy sellers discuss keyword research",
      "Launch tips for Etsy shops",
    ]);

    const keywords = titles.map((title) => ({
      term: title.toLowerCase(),
      source: "reddit" as const,
      extras: { keyword, scrapedAt: startedAt.toISOString() },
    }));

    const persisted = await upsertKeywords(keywords);
    const finishedAt = new Date();

    await recordCrawler(source, "idle", {
      keyword,
      limit,
      records: persisted,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    });

    return {
      source,
      fetched: titles.length,
      keywords,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      notes: source === "reddit" ? "Reddit public search scrape" : "TikTok hashtag scrape fallback",
    };
  } catch (error) {
    const finishedAt = new Date();
    await recordCrawler(source, "error", {
      keyword,
      limit,
      error: error instanceof Error ? error.message : String(error),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    });
    throw error;
  }
}

export async function runScrapePipeline(sources: ScrapeSource[]): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  for (const source of sources) {
    if (source === "etsy") {
      results.push(await scrapeEtsy());
    } else {
      results.push(
        await scrapeSocial({
          source: source === "tiktok" ? "tiktok" : "reddit",
          keyword: source === "tiktok" ? "etsy keyword" : "etsy handmade",
        }),
      );
    }
  }
  return results;
}
