"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarEvent } from "./MonthCalendar";
import { TrendingKeyword } from "@/app/api/seasonal-periods/trending-keywords/route";
import Link from "next/link";
import { ArrowRight, Calendar, Globe, TrendingUp, Loader2 } from "lucide-react";

interface EventDetailsModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailsModal({
  event,
  open,
  onOpenChange,
}: EventDetailsModalProps) {
  const [keywords, setKeywords] = useState<TrendingKeyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event && open) {
      fetchTrendingKeywords(event.name);
    }
  }, [event, open]);

  const fetchTrendingKeywords = async (periodName: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/seasonal-periods/trending-keywords?periodName=${encodeURIComponent(
          periodName
        )}&limit=20`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch trending keywords");
      }
      const data = await response.json();
      setKeywords(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load keywords"
      );
      setKeywords([]);
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  const dateFormat: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {event.name}
            <Badge variant="secondary" className="ml-2">
              Weight: {event.weight}
            </Badge>
          </DialogTitle>
          <DialogDescription className="space-y-2 text-base">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {startDate.toLocaleDateString("en-US", dateFormat)} -{" "}
                {endDate.toLocaleDateString("en-US", dateFormat)}
              </span>
            </div>
            {event.country_code && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>{event.country_code}</span>
              </div>
            )}
            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {event.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Trending Keywords</h3>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-muted-foreground">
              {error}
            </div>
          )}

          {!loading && !error && keywords.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No trending keywords found for this seasonal period yet.
            </div>
          )}

          {!loading && !error && keywords.length > 0 && (
            <div className="space-y-2">
              {keywords.map((keyword) => (
                <Link
                  key={keyword.term}
                  href={`/keywords/${encodeURIComponent(keyword.term)}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/10 transition-colors group cursor-pointer">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium group-hover:text-primary transition-colors">
                          {keyword.term}
                        </div>
                        {keyword.source === "ai" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-auto bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                          >
                            AI
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                        <span>
                          Demand:{" "}
                          {keyword.adjusted_demand_index?.toFixed(1) ?? "N/A"}
                        </span>
                        <span>
                          Trend:{" "}
                          {keyword.deseasoned_trend_momentum?.toFixed(1) ??
                            "N/A"}
                        </span>
                        <span>
                          Competition:{" "}
                          {keyword.competition_score?.toFixed(1) ?? "N/A"}
                        </span>
                        {keyword.engagement_score && (
                          <span>
                            Engagement: {keyword.engagement_score.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
