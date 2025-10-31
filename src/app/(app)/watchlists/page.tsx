"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useToast } from "@/components/ui/ToastProvider";
import { useAnalytics } from "@/lib/analytics/use-analytics";

type WatchlistItem = {
  id: string;
  addedAt: string;
  label: string;
  context?: string;
  type: "keyword" | "listing";
  url?: string | null;
};

type Watchlist = {
  id: string;
  name: string;
  description?: string | null;
  capacity: number;
  items: WatchlistItem[];
};

export default function WatchlistsPage(): JSX.Element {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const analytics = useAnalytics();

  const loadWatchlists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/watchlists");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Unable to load watchlists (${response.status})`);
      }

      const payload = (await response.json()) as { watchlists?: any[] };
      const normalized = (payload.watchlists ?? []).map((watchlist) => {
        const items = (watchlist.items ?? []).map((item: any) => {
          const isKeyword = Boolean(item.keyword?.term);
          const label = isKeyword
            ? String(item.keyword.term ?? "")
            : String(item.listing?.title ?? item.listing?.id ?? "Listing");
          const context = isKeyword
            ? String(item.keyword.market ?? "").toUpperCase()
            : item.listing?.id
              ? String(item.listing.id)
              : "Listing";

          return {
            id: String(item.id ?? ""),
            addedAt: String(item.addedAt ?? item.added_at ?? ""),
            label,
            context,
            type: isKeyword ? "keyword" : "listing",
            url: item.listing?.url ?? null,
          } satisfies WatchlistItem;
        });

        return {
          id: String(watchlist.id ?? ""),
          name: String(watchlist.name ?? ""),
          description: watchlist.description ?? null,
          capacity: Number(watchlist.capacity ?? 0),
          items,
        } satisfies Watchlist;
      });

      setWatchlists(normalized);
      analytics.capture("watchlists.list.loaded", {
        watchlists: normalized.length,
        totalItems: normalized.reduce((sum, watchlist) => sum + watchlist.items.length, 0),
      });
    } catch (err) {
      console.error("Failed to load watchlists", err);
      setError(err instanceof Error ? err.message : "Unexpected error while loading watchlists.");
      analytics.capture("watchlists.list.failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [analytics]);

  useEffect(() => {
    void loadWatchlists();
  }, [loadWatchlists]);

  const totalItems = useMemo(() => {
    return watchlists.reduce((sum, watchlist) => sum + watchlist.items.length, 0);
  }, [watchlists]);

  const handleRemove = useCallback(
    async (item: WatchlistItem) => {
      try {
        const response = await fetch(`/api/watchlists/items/${item.id}`, { method: "DELETE" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Unable to remove item (${response.status})`);
        }
        push({
          title: "Removed from watchlist",
          description: `\"${item.label}\" will no longer be tracked.`,
          tone: "success",
        });
        analytics.capture("watchlists.item.removed", {
          itemId: item.id,
          type: item.type,
          label: item.label,
        });
        await loadWatchlists();
      } catch (err) {
        console.error("Failed to remove watchlist item", err);
        push({
          title: "Watchlist error",
          description: err instanceof Error ? err.message : "Unexpected error",
          tone: "error",
        });
        analytics.capture("watchlists.item.remove_failed", {
          itemId: item.id,
          type: item.type,
          label: item.label,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [analytics, loadWatchlists, push],
  );

  return (
    <div className="watchlists-page">
      <header className="watchlists-header">
        <div>
          <span className="watchlists-eyebrow">Monitoring</span>
          <h1>Watchlists</h1>
          <p>
            Every new account receives an Operational Watchlist automatically. Populate it from the{" "}
            <Link href="/keywords">keyword explorer</Link>{" "}
            or by calling the <code>/api/watchlists/add</code> endpoint.
          </p>
        </div>
        <dl className="watchlists-meta">
          <div>
            <dt>Total watchlists</dt>
            <dd>{watchlists.length}</dd>
          </div>
          <div>
            <dt>Tracked items</dt>
            <dd>{totalItems}</dd>
          </div>
        </dl>
      </header>

      <section className="watchlists-content">
        {loading ? (
          <p className="watchlists-empty">Loading watchlists…</p>
        ) : error ? (
          <p className="watchlists-error">{error}</p>
        ) : watchlists.length === 0 ? (
          <p className="watchlists-empty">
            No watchlists found. They will be provisioned automatically when a user profile is created.
          </p>
        ) : (
          watchlists.map((watchlist) => {
            const remaining = Math.max(watchlist.capacity - watchlist.items.length, 0);
            return (
              <article key={watchlist.id} className="watchlists-card">
                <header>
                  <h2>{watchlist.name}</h2>
                  <p>{watchlist.description ?? "Auto-created starter watchlist."}</p>
                  <span className="watchlists-capacity">
                    {watchlist.items.length} of {watchlist.capacity} slots used · {remaining} remaining
                  </span>
                </header>
                {watchlist.items.length === 0 ? (
                  <p className="watchlists-empty">This watchlist is empty. Add items from the keyword explorer.</p>
                ) : (
                  <table className="watchlists-table">
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col">Context</th>
                        <th scope="col">Added</th>
                        <th scope="col" aria-label="actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {watchlist.items.map((item) => {
                        const addedAt = new Date(item.addedAt);
                        const formatted = Number.isNaN(addedAt.getTime())
                          ? "Unknown"
                          : addedAt.toLocaleString();
                        return (
                          <tr key={item.id}>
                            <td data-type={item.type}>
                              {item.url ? (
                                <a href={item.url} target="_blank" rel="noreferrer">
                                  {item.label}
                                </a>
                              ) : (
                                item.label
                              )}
                            </td>
                            <td>{item.context ?? ""}</td>
                            <td>{formatted}</td>
                            <td>
                              <button type="button" className="watchlists-remove" onClick={() => handleRemove(item)}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
