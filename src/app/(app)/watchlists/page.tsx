"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useToast } from "@/components/ui/ToastProvider";

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
    } catch (err) {
      console.error("Failed to load watchlists", err);
      setError(err instanceof Error ? err.message : "Unexpected error while loading watchlists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWatchlists();
  }, [loadWatchlists]);

  const totalItems = useMemo(() => {
    return watchlists.reduce((sum, watchlist) => sum + watchlist.items.length, 0);
  }, [watchlists]);

  const summaryMessage = useMemo(() => {
    if (loading) {
      return "We’re loading your saved watchlists.";
    }
    if (watchlists.length === 0) {
      return "You haven't saved any watchlists yet. Use the keyword explorer to start tracking ideas.";
    }
    const listLabel = watchlists.length === 1 ? "watchlist" : "watchlists";
    const itemLabel = totalItems === 1 ? "keyword" : "keywords";
    return `You're tracking ${totalItems} ${itemLabel} across ${watchlists.length} ${listLabel}.`;
  }, [loading, totalItems, watchlists.length]);

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
          description: `"${item.label}" will no longer be tracked.`,
          tone: "success",
        });
        await loadWatchlists();
      } catch (err) {
        console.error("Failed to remove watchlist item", err);
        push({
          title: "Watchlist error",
          description: err instanceof Error ? err.message : "Unexpected error",
          tone: "error",
        });
      }
    },
    [loadWatchlists, push],
  );

  const renderWatchlistCard = (watchlist: Watchlist) => {
    const lastUpdated = watchlist.items.reduce<string | null>((latest, item) => {
      if (!item.addedAt) {
        return latest;
      }
      if (!latest) {
        return item.addedAt;
      }
      return new Date(item.addedAt).getTime() > new Date(latest).getTime() ? item.addedAt : latest;
    }, null);

    const formattedUpdated = lastUpdated
      ? new Date(lastUpdated).toLocaleDateString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not yet updated";
    const primaryActionLabel = watchlist.items.length ? "View in keywords" : "Add keywords";
    const trackedCount = watchlist.items.length;
    const trackedLabel = trackedCount === 1 ? "keyword" : "keywords";

    return (
      <article key={watchlist.id} className="watchlists-card">
        <header>
          <div>
            <span className="watchlists-eyebrow">Watchlist</span>
            <h2>{watchlist.name}</h2>
          </div>
          <div className="watchlists-card-meta">
            <span>Tracking {trackedCount} {trackedLabel}</span>
            <span>Updated {formattedUpdated}</span>
          </div>
        </header>
        <p>{watchlist.description ?? "Auto-created starter watchlist."}</p>
        <div className="watchlists-card-actions">
          <Link href="/keywords" className="primary-action">
            {primaryActionLabel}
          </Link>
        </div>
        {watchlist.items.length === 0 ? (
          <p className="watchlists-empty">This watchlist is empty. Add items from the keyword explorer.</p>
        ) : (
          <div className="table-wrapper">
            <table className="watchlists-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Source</th>
                  <th scope="col">Added on</th>
                  <th scope="col" aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {watchlist.items.map((item) => {
                  const addedAt = new Date(item.addedAt);
                  const formatted = Number.isNaN(addedAt.getTime())
                    ? "Unknown"
                    : addedAt.toLocaleDateString(undefined, { dateStyle: "medium", timeStyle: "short" });
                  const sourceLabel = item.type === "keyword"
                    ? (item.context
                        ? item.context
                            .toLowerCase()
                            .split(/[_\s]+/)
                            .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
                            .join(" ")
                        : "Keyword")
                    : "Product listing";
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
                      <td>{sourceLabel}</td>
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
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="watchlists-page">
      <section className="surface-card watchlists-hero">
        <div className="watchlists-header">
          <div>
            <span className="watchlists-eyebrow">Monitoring</span>
            <h1>Watchlists</h1>
            <p>
              Keep the ideas you care about in one place. Add them from the <Link href="/keywords">keyword explorer</Link> whenever inspiration strikes.
            </p>
            <p className="watchlists-hero-summary">{summaryMessage}</p>
          </div>
        </div>
      </section>

      <section className="watchlists-content">
        {loading ? (
          <article className="watchlists-card">
            <p className="watchlists-empty">Loading watchlists…</p>
          </article>
        ) : error ? (
          <article className="watchlists-card">
            <p className="watchlists-error">{error}</p>
          </article>
        ) : watchlists.length === 0 ? (
          <article className="watchlists-card">
            <h2>Start your first watchlist</h2>
            <p className="watchlists-empty">
              You haven&apos;t saved any watchlists yet. Add keywords from the explorer to build your first collection.
            </p>
            <div className="watchlists-card-actions">
              <Link href="/keywords" className="primary-action">
                Add your first keyword
              </Link>
            </div>
          </article>
        ) : (
          watchlists.map(renderWatchlistCard)
        )}
      </section>
    </div>
  );
}
