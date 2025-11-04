"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { Image as ImageIcon, Upload, Sparkles, TrendingUp } from "lucide-react";

import IntentGraph from "@/components/insights/IntentGraph";
import TrendRadar from "@/components/insights/TrendRadar";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type VisualTagResponse = {
  caption: string;
  tags: Array<{ tag: string; confidence: number }>;
  assetPath?: string;
};

const TIMEFRAMES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
];

export default function InsightsPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hints, setHints] = useState("handmade, ceramic");
  const [result, setResult] = useState<VisualTagResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [trendTimeframe, setTrendTimeframe] = useState<string>("7d");
  const [intentTimeframe, setIntentTimeframe] = useState<string>("7d");
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!imagePreview) {
        toast({
          title: "Upload required",
          description: "Select an asset before running Visual Tag AI.",
          variant: "warning",
        });
        return;
      }

      setUploading(true);
      setResult(null);
      if (!userId) {
        toast({
          title: "Sign in required",
          description: "You must be signed in to generate visual tags.",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      try {
        const response = await fetch("/api/ai/visual-tag", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({
            imageBase64: imagePreview,
            keywordHints: hints
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean),
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Visual tag request failed (${response.status})`);
        }

        const payload = (await response.json()) as VisualTagResponse;
        setResult(payload);
        toast({
          title: "Visual tags ready",
          description: "AI extracted marketplace-ready tags with caption context.",
          variant: "success",
        });
      } catch (error) {
        console.error("Visual tag AI failed", error);
        toast({
          title: "Visual tag AI error",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [hints, imagePreview, toast, userId],
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <TrendingUp className="h-6 w-6 text-muted-foreground" />
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold">Commerce Insights</CardTitle>
              <CardDescription className="text-base">
                Explore real-time radar views, purchase intent graphs, and partner analytics to uncover the next products to launch.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Dashboard timeframes sync with your keyword control center so the same toggles apply everywhere.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <TrendRadar
            title="Trend radar"
            timeframe={trendTimeframe}
            timeframeOptions={TIMEFRAMES}
            onTimeframeChange={setTrendTimeframe}
          />
          <p className="mt-4 text-sm text-muted-foreground">Visualise momentum across categories to prioritise roadmap bets.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <IntentGraph
            title="Intent graph"
            timeframe={intentTimeframe}
            timeframeOptions={TIMEFRAMES}
            onTimeframeChange={setIntentTimeframe}
          />
          <p className="mt-4 text-sm text-muted-foreground">Demand and supply delta informs which watchlists to accelerate.</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Visual Tag AI</CardTitle>
            </div>
            <CardDescription>
              Upload a listing asset to generate marketplace-ready captions and confidence-scored tags using LexyHub&apos;s visual intelligence engine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="listing-asset">Listing asset</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="listing-asset"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                </div>
              </div>

              {imagePreview ? (
                <div className="relative aspect-square w-full overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Local preview only */}
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm">Upload an image to preview</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="keyword-hints">Keyword hints</Label>
                <Input
                  id="keyword-hints"
                  type="text"
                  value={hints}
                  onChange={(event) => setHints(event.target.value)}
                  placeholder="e.g. handmade, ceramic, planter"
                />
              </div>

              <Button type="submit" disabled={uploading} className="w-full">
                {uploading ? (
                  <>Generating…</>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Generate Tags
                  </>
                )}
              </Button>
            </form>

            {result && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Caption</h3>
                  <p className="text-sm">{result.caption}</p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.tags.map((tag) => (
                      <Badge key={tag.tag} variant="secondary" className="gap-1">
                        {tag.tag}
                        <span className="text-xs opacity-70">{Math.round(tag.confidence * 100)}%</span>
                      </Badge>
                    ))}
                  </div>
                </div>
                {result.assetPath && (
                  <p className="text-xs text-muted-foreground">Stored at: {result.assetPath}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Watchlist momentum</CardTitle>
            <CardDescription>
              Track watchlist adds versus plan capacity to understand operator momentum. Usage quotas enforce AI access fairly across tiers and surface alerts before limits are reached.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Trend radar metrics sync with keyword momentum to highlight the strongest opportunities.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Intent classification automatically populates downstream personalization signals.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>The partner API exposes normalized keywords with managed, rate-limited access keys.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
