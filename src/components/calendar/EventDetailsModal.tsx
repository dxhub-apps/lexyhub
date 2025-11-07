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
import { cn } from "@/lib/utils";

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

  // Determine if event is active
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isActive = startDate <= today && endDate >= today;
  const isPast = endDate < today;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className={cn(
            "p-4 -m-6 mb-4 border-b",
            isActive && "bg-gradient-to-br from-success/10 to-success/5 border-success/30",
            !isActive && !isPast && "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20",
            isPast && "bg-muted/30"
          )}>
            <DialogTitle className="text-3xl flex items-start gap-3 mb-3">
              <span className="flex-1">{event.name}</span>
            </DialogTitle>
            <div className="flex flex-wrap gap-2">
              {isActive && (
                <Badge variant="secondary" className="bg-success/20 text-success border-success/30">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Active Now
                </Badge>
              )}
              {!isActive && !isPast && (
                <Badge variant="secondary" className="bg-primary/20 border-primary/30">
                  Upcoming
                </Badge>
              )}
              {isPast && (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  Past
                </Badge>
              )}
              <Badge variant="outline">
                Weight: {event.weight}
              </Badge>
              {event.country_code && (
                <Badge variant="outline">
                  <Globe className="h-3 w-3 mr-1" />
                  {event.country_code}
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription className="space-y-3 text-base pt-2">
            <div className="flex items-center gap-2 text-foreground">
              <Calendar className="h-5 w-5" />
              <span className="font-medium">
                {startDate.toLocaleDateString("en-US", dateFormat)} -{" "}
                {endDate.toLocaleDateString("en-US", dateFormat)}
              </span>
            </div>
            {event.tags.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {event.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 bg-gradient-to-br from-muted/30 to-transparent border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Trending Keywords</h3>
              <p className="text-xs text-muted-foreground">
                Popular search terms for this seasonal period
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Loading keywords...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 px-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && keywords.length === 0 && (
            <div className="text-center py-8 px-4 bg-muted/30 border border-dashed border-border rounded-lg">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                No trending keywords found for this seasonal period yet.
              </p>
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
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-primary/5 hover:border-primary/40 transition-all group cursor-pointer shadow-sm hover:shadow-md">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-semibold group-hover:text-primary transition-colors truncate">
                          {keyword.term}
                        </div>
                        {keyword.source === "ai" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-auto bg-warning/10 text-warning border-warning/30 flex-shrink-0"
                          >
                            AI
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Demand:</span>
                          {keyword.adjusted_demand_index?.toFixed(1) ?? "N/A"}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Trend:</span>
                          {keyword.deseasoned_trend_momentum?.toFixed(1) ?? "N/A"}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Competition:</span>
                          {keyword.competition_score?.toFixed(1) ?? "N/A"}
                        </span>
                        {keyword.engagement_score && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Engagement:</span>
                            {keyword.engagement_score.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
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
