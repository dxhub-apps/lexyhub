"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";

import IntentGraph from "@/components/insights/IntentGraph";
import TrendRadar from "@/components/insights/TrendRadar";
import { useToast } from "@/components/ui/use-toast";

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
    <section className="insights-grid">
      <article className="insights-card insights-card--full surface-card">
        <h1>Commerce Insights</h1>
        <p>
          Explore real-time radar views, purchase intent graphs, and partner analytics to uncover the next products to
          launch.
        </p>
        <p className="insights-muted">
          Dashboard timeframes sync with your keyword control center so the same toggles apply everywhere.
        </p>
      </article>

      <article className="insights-card insights-card--full surface-card">
        <TrendRadar
          title="Trend radar"
          timeframe={trendTimeframe}
          timeframeOptions={TIMEFRAMES}
          onTimeframeChange={setTrendTimeframe}
        />
        <p className="insights-muted">Visualise momentum across categories to prioritise roadmap bets.</p>
      </article>

      <article className="insights-card insights-card--full surface-card">
        <IntentGraph
          title="Intent graph"
          timeframe={intentTimeframe}
          timeframeOptions={TIMEFRAMES}
          onTimeframeChange={setIntentTimeframe}
        />
        <p className="insights-muted">Demand and supply delta informs which watchlists to accelerate.</p>
      </article>

      <article className="insights-card surface-card">
        <h2>Visual Tag AI</h2>
        <p className="insights-muted">
          Upload a listing asset to generate marketplace-ready captions and confidence-scored tags using LexyHub&apos;s visual
          intelligence engine.
        </p>
        <form className="visual-tag-form" onSubmit={handleSubmit}>
          <label className="visual-tag-upload">
            <span>Listing asset</span>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          {imagePreview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- Local preview only */}
              <img src={imagePreview} alt="Preview" className="visual-tag-preview" />
            </>
          ) : (
            <div className="visual-tag-placeholder">Upload an image to preview</div>
          )}

          <label className="visual-tag-field">
            <span>Keyword hints</span>
            <input
              type="text"
              value={hints}
              onChange={(event) => setHints(event.target.value)}
              placeholder="e.g. handmade, ceramic, planter"
            />
          </label>
          <button type="submit" disabled={uploading}>
            {uploading ? "Generating…" : "Generate Tags"}
          </button>
        </form>

        {result ? (
          <div className="visual-tag-result">
            <h3>Caption</h3>
            <p>{result.caption}</p>
            <h3>Tags</h3>
            <ul>
              {result.tags.map((tag) => (
                <li key={tag.tag}>
                  <code>{tag.tag}</code>
                  <span>{Math.round(tag.confidence * 100)}%</span>
                </li>
              ))}
            </ul>
            {result.assetPath ? (
              <p className="insights-muted">Stored at: {result.assetPath}</p>
            ) : null}
          </div>
        ) : null}
      </article>

      <article className="insights-card surface-card">
        <h2>Watchlist momentum</h2>
        <p className="insights-muted">
          Track watchlist adds versus plan capacity to understand operator momentum. Usage quotas enforce AI access fairly
          across tiers and surface alerts before limits are reached.
        </p>
        <ul className="insights-list">
          <li>Trend radar metrics sync with keyword momentum to highlight the strongest opportunities.</li>
          <li>Intent classification automatically populates downstream personalization signals.</li>
          <li>The partner API exposes normalized keywords with managed, rate-limited access keys.</li>
        </ul>
      </article>
    </section>
  );
}
