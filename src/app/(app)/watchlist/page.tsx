"use client";

import { useEffect, useState } from "react";
import { Brain, Loader2, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WatchlistItem {
  id: string;
  keyword_id: string;
  term: string;
  market: string;
  trend_momentum?: number | null;
  demand_index?: number | null;
  competition_score?: number | null;
}

export default function WatchlistPage(): JSX.Element {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/watchlist");
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Failed to load watchlist (${response.status})`);
        }

        const payload = await response.json();
        const normalized = (payload.watchlist ?? []).map((entry: any) => ({
          id: String(entry.id ?? ""),
          keyword_id: String(entry.keyword_id ?? entry.keywords?.id ?? ""),
          term: String(entry.keywords?.term ?? ""),
          market: String(entry.keywords?.market ?? "").toUpperCase(),
          trend_momentum: entry.keywords?.trend_momentum ?? null,
          demand_index: entry.keywords?.adjusted_demand_index ?? entry.keywords?.demand_index ?? null,
          competition_score: entry.keywords?.competition_score ?? null,
        }));
        setItems(normalized);
      } catch (err) {
        console.error("Failed to load watchlist", err);
        setError(err instanceof Error ? err.message : "Watchlist unavailable");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold leading-none">Watchlist</h1>
          <p className="mt-2 text-sm text-foreground">Keywords saved for continuous monitoring.</p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading watchlist…
        </div>
      ) : error ? (
        <p className="text-sm text-foreground">{error}</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border p-6 text-sm">
          <p>No keywords saved yet. Add keywords from the search workspace.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="flex h-full flex-col gap-4 rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    <h2 className="text-base font-semibold">{item.term}</h2>
                  </div>
                  <Badge variant="outline" className="w-fit uppercase">
                    {item.market || "US"}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = `/keyword/${item.keyword_id}`;
                  }}
                >
                  Open
                </Button>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-border p-2">
                  <dt className="font-medium">Volume</dt>
                  <dd className="text-sm font-semibold">{formatPercent(item.demand_index)}</dd>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <dt className="font-medium">Competition</dt>
                  <dd className="text-sm font-semibold">{formatPercent(item.competition_score)}</dd>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <dt className="font-medium">Trend</dt>
                  <dd className="text-sm font-semibold">{formatPercent(item.trend_momentum)}</dd>
                </div>
              </dl>

              <Button
                variant="accent"
                className="mt-auto"
                onClick={() => {
                  window.location.href = `/ask-lexybrain?keyword=${encodeURIComponent(item.term)}`;
                }}
              >
                <Brain className="mr-2 h-4 w-4" /> Ask LexyBrain
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  const bounded = Math.max(0, Math.min(1, value));
  return `${Math.round(bounded * 100)}%`;
}
