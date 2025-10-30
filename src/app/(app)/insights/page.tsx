"use client";

import { useCallback, useState } from "react";

import IntentGraph from "@/components/insights/IntentGraph";
import TrendRadar from "@/components/insights/TrendRadar";
import { useToast } from "@/components/ui/ToastProvider";

type VisualTagResponse = {
  caption: string;
  tags: Array<{ tag: string; confidence: number }>;
  assetPath?: string;
};

export default function InsightsPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hints, setHints] = useState("handmade, ceramic");
  const [result, setResult] = useState<VisualTagResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const { push } = useToast();

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
        push({
          title: "Upload required",
          description: "Select an asset before running Visual Tag AI.",
          tone: "warning",
        });
        return;
      }

      setUploading(true);
      setResult(null);
      try {
        const response = await fetch("/api/ai/visual-tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        push({
          title: "Visual tags ready",
          description: "AI extracted marketplace-ready tags with caption context.",
          tone: "success",
        });
      } catch (error) {
        console.error("Visual tag AI failed", error);
        push({
          title: "Visual tag AI error",
          description: error instanceof Error ? error.message : "Unexpected error",
          tone: "error",
        });
      } finally {
        setUploading(false);
      }
    },
    [hints, imagePreview, push],
  );

  return (
    <section className="insights-grid">
      <header>
        <h1>Insights Sandbox</h1>
        <p>
          Sprint 5 unlocks intent intelligence, a multi-source trend radar, and refreshed automation. Explore the new radar,
          graph, and partner API foundations alongside the existing AI surfaces.
        </p>
      </header>

      <div className="insights-card insights-card--full">
        <TrendRadar />
      </div>

      <div className="insights-card insights-card--full">
        <IntentGraph />
      </div>

      <div className="insights-card">
        <h2>Visual Tag AI</h2>
        <p className="insights-muted">
          Assets are uploaded to Supabase storage then captioned locally before GPT refinement. Confidence scores combine
          fallback heuristics with optional model output.
        </p>
        <form className="visual-tag-form" onSubmit={handleSubmit}>
          <label className="visual-tag-upload">
            <span>Listing asset</span>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          {imagePreview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- Preview only, not persisted to DOM in production builds */}
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
      </div>

      <div className="insights-card">
        <h2>Watchlist momentum</h2>
        <p className="insights-muted">
          Track watchlist adds vs. plan capacity to understand operator momentum. Usage quotas now enforce AI access fairly
          across tiers and populate Supabase usage tables.
        </p>
        <ul className="insights-list">
          <li>Trend radar metrics now sync back into keyword momentum for watchlist prioritisation.</li>
          <li>Intent classification fills extras.classification for downstream personalization.</li>
          <li>Partner API beta exposes normalized keywords with rate-limited access keys.</li>
        </ul>
      </div>
    </section>
  );
}
