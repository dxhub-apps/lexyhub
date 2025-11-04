"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, ExternalLink, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type RelatedKeyword = {
  term: string;
  relationshipStrength: number;
  relationshipType: string;
  demand: number;
  competition: number;
  momentum: number;
  insight: string;
};

type RelatedKeywordsProps = {
  keyword: string;
  market?: string;
};

export function RelatedKeywords({ keyword, market = "us" }: RelatedKeywordsProps): JSX.Element {
  const [relatedKeywords, setRelatedKeywords] = useState<RelatedKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRelatedKeywords() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/keywords/related", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword, market, limit: 10 }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch related keywords (${response.status})`);
        }

        const data = await response.json();
        setRelatedKeywords(data.relatedKeywords || []);
      } catch (err: any) {
        console.error("Failed to fetch related keywords", err);
        setError(err?.message ?? "Failed to load related keywords");
      } finally {
        setLoading(false);
      }
    }

    void fetchRelatedKeywords();
  }, [keyword, market]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Discovering related opportunities with AI...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (relatedKeywords.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No related keywords found.</p>
      </div>
    );
  }

  const getRelationshipColor = (strength: number): string => {
    if (strength >= 80) return "bg-green-500";
    if (strength >= 60) return "bg-blue-500";
    if (strength >= 40) return "bg-yellow-500";
    return "bg-gray-400";
  };

  const getRelationshipLabel = (strength: number): string => {
    if (strength >= 80) return "Very Strong";
    if (strength >= 60) return "Strong";
    if (strength >= 40) return "Moderate";
    return "Weak";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>AI-powered keyword relationships based on user intent and behavior patterns</span>
      </div>

      <div className="grid gap-3">
        {relatedKeywords.map((related, index) => (
          <Link
            key={related.term}
            href={`/keywords/${encodeURIComponent(related.term)}`}
            className="block group"
          >
            <div className="border rounded-lg p-4 hover:border-primary hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="shrink-0">
                      #{index + 1}
                    </Badge>
                    <h4 className="font-semibold truncate group-hover:text-primary transition-colors">
                      {related.term}
                    </h4>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Relationship:</span>
                        <div className="flex-1 max-w-[200px]">
                          <Progress
                            value={related.relationshipStrength}
                            className={`h-2 ${getRelationshipColor(related.relationshipStrength)}`}
                          />
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {getRelationshipLabel(related.relationshipStrength)}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {related.relationshipType}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {related.insight}
                    </p>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Demand:</span>
                        <span className="font-semibold text-blue-600">{related.demand}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Competition:</span>
                        <span className="font-semibold text-red-600">{related.competition}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        <span className="font-semibold text-green-600">{related.momentum}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="pt-4 text-center">
        <Button variant="outline" size="sm" asChild>
          <Link href="/niche-explorer">
            Explore More Opportunities
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default RelatedKeywords;
