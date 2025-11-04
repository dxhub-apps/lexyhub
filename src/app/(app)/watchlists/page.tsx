"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import Link from "next/link";
import { Star, Trash2, Plus, ExternalLink, TrendingUp, BarChart3 } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompetitionScore } from "@/components/watchlists/CompetitionScore";

type WatchlistItem = {
  id: string;
  addedAt: string;
  label: string;
  context?: string;
  type: "keyword" | "listing";
  url?: string | null;
  // Keyword metrics
  competitionScore?: number;
  demandScore?: number;
  trendScore?: number;
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

          // Extract keyword metrics if available
          const competitionScore = isKeyword && item.keyword?.competition_score !== undefined
            ? Math.round((item.keyword.competition_score ?? 0) * 100)
            : undefined;
          const demandScore = isKeyword && item.keyword?.demand_index !== undefined
            ? Math.round((item.keyword.demand_index ?? 0) * 100)
            : undefined;
          const trendScore = isKeyword && item.keyword?.trend_momentum !== undefined
            ? Math.round((item.keyword.trend_momentum ?? 0) * 100)
            : undefined;

          return {
            id: String(item.id ?? ""),
            addedAt: String(item.addedAt ?? item.added_at ?? ""),
            label,
            context,
            type: isKeyword ? "keyword" : "listing",
            url: item.listing?.url ?? null,
            competitionScore,
            demandScore,
            trendScore,
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
      return "Loading your watchlist...";
    }
    if (totalItems === 0) {
      return "You haven't saved any keywords yet. Use the keyword explorer to start tracking ideas.";
    }
    const itemLabel = totalItems === 1 ? "keyword" : "keywords";
    return `You're tracking ${totalItems} ${itemLabel}.`;
  }, [loading, totalItems]);

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
        <CardContent className="space-y-4 pt-6">
          {watchlist.items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-4">Your watchlist is empty. Add keywords from the explorer to start tracking opportunities.</p>
              <Button asChild>
                <Link href="/keywords">
                  <Plus className="mr-2 h-4 w-4" />
                  Add your first keyword
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {watchlist.items.map((item) => {
                const addedAt = new Date(item.addedAt);
                const formatted = Number.isNaN(addedAt.getTime())
                  ? "Unknown"
                  : addedAt.toLocaleString(undefined, { dateStyle: "medium" });
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
                  <div key={item.id} className="border rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {item.type === "keyword" ? (
                            <Link
                              href={`/keywords/${encodeURIComponent(item.label)}`}
                              className="text-lg font-semibold hover:text-primary transition-colors inline-flex items-center gap-2"
                            >
                              {item.label}
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          ) : item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-lg font-semibold hover:text-primary transition-colors inline-flex items-center gap-2"
                            >
                              {item.label}
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : (
                            <span className="text-lg font-semibold">{item.label}</span>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">{sourceLabel}</Badge>
                            <span className="text-xs text-muted-foreground">Added {formatted}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRemove(item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {item.type === "keyword" && item.competitionScore !== undefined && (
                        <div className="space-y-2">
                          <CompetitionScore score={item.competitionScore} size="sm" />
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            {item.demandScore !== undefined && (
                              <div className="flex items-center gap-2 text-sm">
                                <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                                <span className="text-muted-foreground">Demand:</span>
                                <span className="font-semibold text-blue-600">{item.demandScore}%</span>
                              </div>
                            )}
                            {item.trendScore !== undefined && (
                              <div className="flex items-center gap-2 text-sm">
                                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                                <span className="text-muted-foreground">Momentum:</span>
                                <span className="font-semibold text-green-600">{item.trendScore}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <Badge variant="outline" className="w-fit">Monitoring</Badge>
              <CardTitle className="text-3xl font-bold">Watchlist</CardTitle>
              <CardDescription className="text-base">
                Track keywords and monitor their performance over time. Add items from the{" "}
                <Link href="/keywords" className="text-primary hover:underline">
                  keyword explorer
                </Link>{" "}
                or{" "}
                <Link href="/niche-explorer" className="text-primary hover:underline">
                  niche explorer
                </Link>
                .
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/keywords">
                <Plus className="mr-2 h-4 w-4" />
                Add Keywords
              </Link>
            </Button>
          </div>
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
        ) : (
          watchlists.map(renderWatchlistCard)
        )}
      </div>
    </div>
  );
}
