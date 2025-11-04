"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import Link from "next/link";
import { Star, Trash2, Plus, ExternalLink } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const loadWatchlists = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!userId) {
      setLoading(false);
      setWatchlists([]);
      setError("You must be signed in to view watchlists.");
      return;
    }
    try {
      const response = await fetch("/api/watchlists", {
        headers: { "x-user-id": userId },
      });
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
  }, [userId]);

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
      if (!userId) {
        toast({
          title: "Session required",
          description: "Sign in again to modify your watchlists.",
          variant: "destructive",
        });
        return;
      }
      try {
        const response = await fetch(`/api/watchlists/items/${item.id}`, {
          method: "DELETE",
          headers: { "x-user-id": userId },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Unable to remove item (${response.status})`);
        }
        toast({
          title: "Removed from watchlist",
          description: `"${item.label}" will no longer be tracked.`,
          variant: "success",
        });
        await loadWatchlists();
      } catch (err) {
        console.error("Failed to remove watchlist item", err);
        toast({
          title: "Watchlist error",
          description: err instanceof Error ? err.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [loadWatchlists, toast, userId],
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
      ? new Date(lastUpdated).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not yet updated";
    const primaryActionLabel = watchlist.items.length ? "View in keywords" : "Add keywords";
    const trackedCount = watchlist.items.length;
    const trackedLabel = trackedCount === 1 ? "keyword" : "keywords";

    return (
      <Card key={watchlist.id}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Badge variant="outline" className="w-fit">Watchlist</Badge>
              <CardTitle>{watchlist.name}</CardTitle>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
              <span>Tracking {trackedCount} {trackedLabel}</span>
              <span>Updated {formattedUpdated}</span>
            </div>
          </div>
          <CardDescription>{watchlist.description ?? "Auto-created starter watchlist."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/keywords">
              <span className="flex items-center justify-center">
                <Plus className="mr-2 h-4 w-4" />
                {primaryActionLabel}
              </span>
            </Link>
          </Button>

          {watchlist.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">This watchlist is empty. Add items from the keyword explorer.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th scope="col" className="px-4 py-3 text-left text-sm font-medium">Item</th>
                    <th scope="col" className="px-4 py-3 text-left text-sm font-medium">Source</th>
                    <th scope="col" className="px-4 py-3 text-left text-sm font-medium">Added on</th>
                    <th scope="col" className="px-4 py-3 text-left text-sm font-medium" aria-label="actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlist.items.map((item) => {
                    const addedAt = new Date(item.addedAt);
                    const formatted = Number.isNaN(addedAt.getTime())
                      ? "Unknown"
                      : addedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm font-medium">
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                              {item.label}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            item.label
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant="secondary">{sourceLabel}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatted}</td>
                        <td className="px-4 py-3 text-sm">
                          <Button variant="ghost" size="sm" onClick={() => handleRemove(item)}>
                            <Trash2 className="mr-1 h-3 w-3" />
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2">Monitoring</Badge>
          <CardTitle className="text-3xl font-bold">Watchlists</CardTitle>
          <CardDescription className="mt-2 text-base">
            Keep the ideas you care about in one place. Add them from the{" "}
            <Link href="/keywords" className="text-primary hover:underline">
              keyword explorer
            </Link>{" "}
            whenever inspiration strikes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4" />
            <span>{summaryMessage}</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Loading watchlists…</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : watchlists.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Start your first watchlist</CardTitle>
              <CardDescription>
                You haven&apos;t saved any watchlists yet. Add keywords from the explorer to build your first collection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/keywords">
                  <span className="flex items-center justify-center">
                    <Plus className="mr-2 h-4 w-4" />
                    Add your first keyword
                  </span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          watchlists.map(renderWatchlistCard)
        )}
      </div>
    </div>
  );
}
