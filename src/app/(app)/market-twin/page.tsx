"use client";

export const dynamic = 'force-dynamic';

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { Zap, Play, Eye, Heart } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type ListingOption = {
  id: string;
  title: string;
  shopName: string | null;
  status: string;
  priceCents: number | null;
  currency: string | null;
  tags: string[];
  stats?: { views: number; favorites: number };
};

type SimulationHistoryItem = {
  id?: string;
  listing_id?: string;
  created_at?: string;
  createdAt?: string;
  scenario_input?: {
    listingId: string;
    scenarioTitle: string;
    scenarioTags: string[];
    scenarioPriceCents: number;
    scenarioDescription?: string;
    goals?: string[];
  };
  predicted_visibility?: number | null;
  confidence?: number | null;
  extras?: {
    explanation?: string;
    semanticGap?: number;
    trendCorrelationDelta?: number;
  };
  baseline?: { title: string };
  result?: {
    explanation?: string;
    predictedVisibility?: number;
    confidence?: number;
    semanticGap?: number;
  };
};

function formatCurrency(cents: number | null | undefined, currency?: string | null): string {
  if (cents == null) {
    return "n/a";
  }
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
  });
  return formatter.format(cents / 100);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) {
    return "n/a";
  }
  return `${(value * 100).toFixed(1)}%`;
}

export default function MarketTwinPage(): JSX.Element {
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;
  const [listings, setListings] = useState<ListingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [scenarioTitle, setScenarioTitle] = useState("");
  const [scenarioTags, setScenarioTags] = useState<string>("");
  const [scenarioPrice, setScenarioPrice] = useState<number | string>("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [goals, setGoals] = useState<string>("Increase visibility;Improve conversion");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      if (!userId) {
        setListings([]);
        setHistory([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const encodedUserId = encodeURIComponent(userId);
        const listingResponse = await fetch(`/api/listings?userId=${encodedUserId}`, {
          signal: controller.signal,
        });
        const listingJson = await listingResponse.json();
        setListings(listingJson.listings ?? []);

        const historyResponse = await fetch(`/api/market-twin?userId=${encodedUserId}`, {
          signal: controller.signal,
        });
        const historyJson = await historyResponse.json();
        setHistory(historyJson.simulations ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Failed to load Market Twin data", error);
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();

    return () => controller.abort();
  }, [userId]);

  useEffect(() => {
    if (!selectedListingId) {
      if (listings.length > 0) {
        setSelectedListingId(listings[0].id);
      }
      return;
    }

    const listing = listings.find((item) => item.id === selectedListingId);
    if (listing) {
      setScenarioTitle(listing.title);
      setScenarioTags(listing.tags.join(", "));
      setScenarioPrice(listing.priceCents != null ? (listing.priceCents / 100).toFixed(2) : "");
    }
  }, [listings, selectedListingId]);

  const activeListing = useMemo(
    () => listings.find((listing) => listing.id === selectedListingId) ?? null,
    [listings, selectedListingId],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedListingId) {
      toast({ title: "Select a listing", description: "Choose an Etsy listing to simulate.", variant: "warning" });
      return;
    }
    if (!scenarioTitle.trim()) {
      toast({ title: "Scenario title required", description: "Give your hypothetical listing a title.", variant: "warning" });
      return;
    }

    if (!userId) {
      toast({
        title: "Sign in required",
        description: "You must be signed in to run Market Twin simulations.",
        variant: "destructive",
      });
      return;
    }

    const parsedPrice = typeof scenarioPrice === "string" ? Number.parseFloat(scenarioPrice) : scenarioPrice;
    const priceCents = Number.isFinite(parsedPrice) ? Math.round(parsedPrice * 100) : 0;

    setSubmitting(true);
    try {
      const response = await fetch("/api/market-twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          listingId: selectedListingId,
          scenarioTitle,
          scenarioTags: scenarioTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          scenarioPriceCents: priceCents,
          scenarioDescription,
          goals: goals
            .split(";")
            .map((goal) => goal.trim())
            .filter(Boolean),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to run simulation");
      }

      toast({
        title: "Simulation ready",
        description: "Market Twin computed new visibility and semantic fit.",
        variant: "success",
      });

      setHistory((records) => [json, ...records].slice(0, 25));
    } catch (error) {
      toast({
        title: "Simulation failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Zap className="h-6 w-6 text-muted-foreground" />
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold">AI Market Twin</CardTitle>
                <CardDescription className="text-base">
                  Compare your baseline Etsy listings against hypothetical upgrades to predict visibility shifts.
                </CardDescription>
              </div>
            </div>
            <Badge className="gap-1">
              <Play className="h-3 w-3" />
              Live Simulation
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Simulation wizard</CardTitle>
            <CardDescription>Select a baseline listing, tweak the scenario, and generate AI-backed projections.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseline-listing">Baseline listing</Label>
                <Select
                  value={selectedListingId ?? ""}
                  onValueChange={(value) => setSelectedListingId(value || null)}
                  disabled={loading || listings.length === 0}
                >
                  <SelectTrigger id="baseline-listing">
                    <SelectValue placeholder={loading ? "Loading listings..." : "Select a listing"} />
                  </SelectTrigger>
                  <SelectContent>
                    {listings.map((listing) => (
                      <SelectItem key={listing.id} value={listing.id}>
                        {listing.title} — {listing.shopName ?? "Etsy shop"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scenario-title">Scenario title</Label>
                  <Input
                    id="scenario-title"
                    value={scenarioTitle}
                    onChange={(event) => setScenarioTitle(event.target.value)}
                    placeholder="Improved SEO title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scenario-price">Scenario price (USD)</Label>
                  <Input
                    id="scenario-price"
                    type="number"
                    step="0.01"
                    value={scenarioPrice}
                    onChange={(event) => setScenarioPrice(event.target.value)}
                    placeholder="29.99"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scenario-tags">Scenario tags</Label>
                <Textarea
                  id="scenario-tags"
                  rows={3}
                  value={scenarioTags}
                  onChange={(event) => setScenarioTags(event.target.value)}
                  placeholder="handmade, gift, trending"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goals">Goals</Label>
                <Input
                  id="goals"
                  value={goals}
                  onChange={(event) => setGoals(event.target.value)}
                  placeholder="Increase visibility;Improve conversion"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description-tweaks">Description tweaks</Label>
                <Textarea
                  id="description-tweaks"
                  rows={4}
                  value={scenarioDescription}
                  onChange={(event) => setScenarioDescription(event.target.value)}
                  placeholder="Highlight faster shipping, new bundles, or creative variations."
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Running simulation..." : "Run Market Twin"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Baseline snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              {activeListing ? (
                <div className="space-y-4">
                  <h3 className="font-semibold">{activeListing.title}</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-border pb-2">
                      <dt className="font-medium">Shop</dt>
                      <dd className="text-muted-foreground">{activeListing.shopName ?? "Etsy"}</dd>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <dt className="font-medium">Status</dt>
                      <dd className="text-muted-foreground">{activeListing.status}</dd>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <dt className="font-medium">Price</dt>
                      <dd className="text-muted-foreground">{formatCurrency(activeListing.priceCents, activeListing.currency)}</dd>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <dt className="font-medium">Tags</dt>
                      <dd className="text-muted-foreground">{activeListing.tags.length ? activeListing.tags.join(", ") : "No tags"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="font-medium">Signals</dt>
                      <dd className="text-muted-foreground">
                        {activeListing.stats ? (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {activeListing.stats.views}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {activeListing.stats.favorites}
                            </span>
                          </div>
                        ) : (
                          "No stats yet"
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a listing to inspect baseline metrics.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent simulations</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No simulations recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((record) => {
                    const timestamp = record.createdAt ?? record.created_at;
                    const label = timestamp ? new Date(timestamp).toLocaleString() : "Pending";
                    return (
                      <div key={record.id ?? record.createdAt ?? label} className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between">
                          <strong className="text-sm font-semibold">{record.baseline?.title ?? record.scenario_input?.scenarioTitle ?? "Scenario"}</strong>
                          <span className="text-xs text-muted-foreground">{label}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{record.result?.explanation ?? record.extras?.explanation ?? "Analysis pending. Check back shortly."}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline">Visibility: {formatPercent(record.result?.predictedVisibility ?? record.predicted_visibility)}</Badge>
                          <Badge variant="outline">Confidence: {formatPercent(record.result?.confidence ?? record.confidence)}</Badge>
                          <Badge variant="outline">Semantic gap: {formatPercent(record.result?.semanticGap ?? record.extras?.semanticGap)}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
