"use client";

export const dynamic = 'force-dynamic';

import { FormEvent, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { Zap, Play, ExternalLink, Loader2 } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type ProductData = {
  url: string;
  marketplace: string;
  id: string | null;
  title: string | null;
  price: {
    amount: number | null;
    currency: string | null;
  };
  description: string | null;
  tags: string[];
  images: string[];
  category?: string[];
  shop?: {
    id?: string | null;
    name?: string | null;
    url?: string | null;
  };
  extras?: Record<string, unknown>;
  fetchedAt: string;
};

type SimulationResult = {
  id: string;
  createdAt: string;
  product: ProductData;
  scenario: {
    title: string;
    tags: string[];
    priceCents: number;
    description: string;
    goals: string[];
  };
  result: {
    explanation: string;
    predictedVisibility: number;
    confidence: number;
    semanticGap: number;
    recommendations: string[];
  };
};

function formatCurrency(cents: number | null | undefined, currency?: string): string {
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

  // Product URL and data
  const [productUrl, setProductUrl] = useState("");
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [fetchingProduct, setFetchingProduct] = useState(false);

  // Scenario inputs
  const [scenarioTitle, setScenarioTitle] = useState("");
  const [scenarioTags, setScenarioTags] = useState<string>("");
  const [scenarioPrice, setScenarioPrice] = useState<number | string>("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [goals, setGoals] = useState<string>("Increase visibility;Improve conversion;Optimize pricing");

  // Simulation state
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<SimulationResult[]>([]);

  const fetchProductData = async () => {
    if (!productUrl.trim()) {
      toast({
        title: "URL required",
        description: "Enter a product URL from any marketplace.",
        variant: "warning"
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Sign in required",
        description: "You must be signed in to analyze products.",
        variant: "destructive",
      });
      return;
    }

    setFetchingProduct(true);
    try {
      const response = await fetch("/api/market-twin/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, url: productUrl }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to fetch product data");
      }

      setProductData(json.product);
      setScenarioTitle(json.product.title || "");
      setScenarioTags(json.product.tags.join(", "));
      setScenarioPrice(json.product.price.amount != null ? json.product.price.amount.toFixed(2) : "");
      setScenarioDescription(json.product.description || "");

      toast({
        title: "Product loaded",
        description: `Fetched data from ${json.product.marketplace}`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed to fetch product",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setFetchingProduct(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!productData) {
      toast({
        title: "Load product first",
        description: "Click 'Load Product' to analyze a product URL.",
        variant: "warning"
      });
      return;
    }

    if (!scenarioTitle.trim()) {
      toast({
        title: "Scenario title required",
        description: "Give your optimized listing a title.",
        variant: "warning"
      });
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
          productUrl: productData.url,
          productData,
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
        title: "Simulation complete",
        description: "Market Twin generated AI-backed projections.",
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
                  Paste any product link, tweak the scenario, and generate AI-backed market projections and optimizations.
                </CardDescription>
              </div>
            </div>
            <Badge className="gap-1">
              <Play className="h-3 w-3" />
              Live Simulation
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Supports products from Etsy, Amazon, Shopify, and other major marketplaces. The AI analyzes visibility, pricing, SEO, and market fit.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Simulation wizard</CardTitle>
            <CardDescription>Paste a product link, load the data, tweak your scenario, and generate predictions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product URL Input */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product-url">Product URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="product-url"
                      value={productUrl}
                      onChange={(event) => setProductUrl(event.target.value)}
                      placeholder="https://www.etsy.com/listing/... or https://www.amazon.com/..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={fetchProductData}
                      disabled={fetchingProduct || !productUrl.trim()}
                    >
                      {fetchingProduct ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Load Product
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paste a product URL from Etsy, Amazon, Shopify, or other marketplaces
                  </p>
                </div>
              </div>

              {productData && (
                <>
                  <div className="rounded-md border bg-muted/50 p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{productData.marketplace}</Badge>
                        <span className="text-sm font-medium">Product loaded</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{productData.title}</p>
                  </div>

                  <div className="border-t pt-6 space-y-4">
                    <h3 className="font-semibold">Scenario tweaks</h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="scenario-title">Optimized title</Label>
                        <Input
                          id="scenario-title"
                          value={scenarioTitle}
                          onChange={(event) => setScenarioTitle(event.target.value)}
                          placeholder="Improved SEO title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="scenario-price">Optimized price (USD)</Label>
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
                      <Label htmlFor="scenario-tags">Optimized tags</Label>
                      <Textarea
                        id="scenario-tags"
                        rows={2}
                        value={scenarioTags}
                        onChange={(event) => setScenarioTags(event.target.value)}
                        placeholder="handmade, gift, trending, sustainable"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description-tweaks">Description tweaks</Label>
                      <Textarea
                        id="description-tweaks"
                        rows={3}
                        value={scenarioDescription}
                        onChange={(event) => setScenarioDescription(event.target.value)}
                        placeholder="Highlight faster shipping, new bundles, or creative variations."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="goals">Optimization goals</Label>
                      <Input
                        id="goals"
                        value={goals}
                        onChange={(event) => setGoals(event.target.value)}
                        placeholder="Increase visibility;Improve conversion;Optimize pricing"
                      />
                      <p className="text-xs text-muted-foreground">
                        Semicolon-separated goals to guide AI recommendations
                      </p>
                    </div>

                    <Button type="submit" disabled={submitting} className="w-full">
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Running simulation...
                        </>
                      ) : (
                        "Run Market Twin Analysis"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {productData && (
            <Card>
              <CardHeader>
                <CardTitle>Product snapshot</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="font-semibold line-clamp-2">{productData.title}</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-border pb-2">
                      <dt className="font-medium">Marketplace</dt>
                      <dd className="text-muted-foreground">{productData.marketplace}</dd>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <dt className="font-medium">Price</dt>
                      <dd className="text-muted-foreground">
                        {productData.price.amount
                          ? `${productData.price.amount.toFixed(2)} ${productData.price.currency || 'USD'}`
                          : 'N/A'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="font-medium">Tags</dt>
                      <dd className="text-muted-foreground text-xs">
                        {productData.tags.length ? productData.tags.slice(0, 3).join(", ") + (productData.tags.length > 3 ? "..." : "") : "No tags"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent simulations</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No simulations yet. Run your first analysis above.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((record) => (
                    <div key={record.id} className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-sm font-semibold line-clamp-1">{record.scenario.title}</strong>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(record.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">{record.product.marketplace}</Badge>
                      <p className="text-sm text-muted-foreground line-clamp-2">{record.result.explanation}</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">
                          Visibility: {formatPercent(record.result.predictedVisibility)}
                        </Badge>
                        <Badge variant="secondary">
                          Confidence: {formatPercent(record.result.confidence)}
                        </Badge>
                        <Badge variant="secondary">
                          Semantic gap: {formatPercent(record.result.semanticGap)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
