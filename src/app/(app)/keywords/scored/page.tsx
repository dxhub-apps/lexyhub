"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, TrendingDown, Activity } from "lucide-react";

interface ScoredKeyword {
  id: string;
  term: string;
  source: string;
  market: string;
  base_demand_index: number | null;
  adjusted_demand_index: number | null;
  trend_momentum: number | null;
  deseasoned_trend_momentum: number | null;
  seasonal_label: string | null;
  opportunity_badge: string | null;
  last_seen: string | null;
}

const BADGE_COLORS: Record<string, string> = {
  hot: "bg-red-500 text-white",
  rising: "bg-orange-500 text-white",
  stable: "bg-blue-500 text-white",
  cooling: "bg-gray-500 text-white",
  unknown: "bg-gray-300 text-gray-700",
};

export default function ScoredKeywordsPage() {
  const [keywords, setKeywords] = useState<ScoredKeyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    market: "",
    country: "global",
    minDI: "",
    minTM: "",
    sort: "adjusted_demand_index.desc",
  });

  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.market) params.set("market", filters.market);
      if (filters.country) params.set("country", filters.country);
      if (filters.minDI) params.set("minDI", filters.minDI);
      if (filters.minTM) params.set("minTM", filters.minTM);
      params.set("sort", filters.sort);
      params.set("limit", "100");

      const res = await fetch(`/api/keywords/scored?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch keywords");

      const json = await res.json();
      setKeywords(json.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchKeywords();
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Seasonal Demand Index & Trend Momentum</CardTitle>
          <CardDescription>
            Real-time seasonal-aware demand scoring with AI-powered trend analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="search">Search Keyword</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    className="pl-9"
                    placeholder="e.g., holiday gifts"
                    value={filters.q}
                    onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="market">Market</Label>
                <Select value={filters.market} onValueChange={(v) => setFilters({ ...filters, market: v })}>
                  <SelectTrigger id="market">
                    <SelectValue placeholder="All Markets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Markets</SelectItem>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="uk">United Kingdom</SelectItem>
                    <SelectItem value="de">Germany</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country (Seasonal)</Label>
                <Select value={filters.country} onValueChange={(v) => setFilters({ ...filters, country: v })}>
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Global" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="UK">United Kingdom</SelectItem>
                    <SelectItem value="CN">China</SelectItem>
                    <SelectItem value="JP">Japan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="minDI">Min Demand Index</Label>
                <Input
                  id="minDI"
                  type="number"
                  placeholder="0-100"
                  value={filters.minDI}
                  onChange={(e) => setFilters({ ...filters, minDI: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minTM">Min Trend Momentum (%)</Label>
                <Input
                  id="minTM"
                  type="number"
                  placeholder="e.g., 5"
                  value={filters.minTM}
                  onChange={(e) => setFilters({ ...filters, minTM: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort">Sort By</Label>
                <Select value={filters.sort} onValueChange={(v) => setFilters({ ...filters, sort: v })}>
                  <SelectTrigger id="sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjusted_demand_index.desc">Demand Index (High)</SelectItem>
                    <SelectItem value="adjusted_demand_index.asc">Demand Index (Low)</SelectItem>
                    <SelectItem value="trend_momentum.desc">Trend Momentum (High)</SelectItem>
                    <SelectItem value="trend_momentum.asc">Trend Momentum (Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Searching..." : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keywords ({keywords.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-sm font-medium">Keyword</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Base DI</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Adjusted DI</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Trend %</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Deseasoned TM</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Seasonal</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Badge</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Loading keywords...
                    </td>
                  </tr>
                )}

                {!loading && keywords.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No keywords found. Try adjusting filters.
                    </td>
                  </tr>
                )}

                {!loading &&
                  keywords.map((kw) => (
                    <tr
                      key={kw.id}
                      className="border-b hover:bg-muted/50"
                    >
                      <td className="px-4 py-3 font-medium">
                        <div>
                          <div className="font-semibold">{kw.term}</div>
                          <div className="text-xs text-muted-foreground">
                            {kw.source} · {kw.market}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {kw.base_demand_index !== null ? kw.base_demand_index.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {kw.adjusted_demand_index !== null ? kw.adjusted_demand_index.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          {kw.trend_momentum !== null ? (
                            <>
                              {kw.trend_momentum > 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              ) : kw.trend_momentum < 0 ? (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              ) : (
                                <Activity className="h-4 w-4 text-gray-500" />
                              )}
                              <span
                                className={
                                  kw.trend_momentum > 0
                                    ? "text-green-600"
                                    : kw.trend_momentum < 0
                                      ? "text-red-600"
                                      : ""
                                }
                              >
                                {kw.trend_momentum > 0 ? "+" : ""}
                                {kw.trend_momentum.toFixed(1)}%
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {kw.deseasoned_trend_momentum !== null
                          ? `${kw.deseasoned_trend_momentum > 0 ? "+" : ""}${kw.deseasoned_trend_momentum.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {kw.seasonal_label ? (
                          <Badge variant="outline">{kw.seasonal_label}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {kw.opportunity_badge && (
                          <Badge
                            className={
                              BADGE_COLORS[kw.opportunity_badge] || BADGE_COLORS.unknown
                            }
                          >
                            {kw.opportunity_badge}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {kw.last_seen ? new Date(kw.last_seen).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
