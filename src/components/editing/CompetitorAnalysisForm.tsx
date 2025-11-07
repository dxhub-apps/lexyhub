"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { Plus, Trash2, Loader2, AlertCircle } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import type { CompetitorInsight } from "@/lib/insights/competitors";

type CompetitorEntry = {
  title: string;
  price: string;
  reviews: string;
  rating: string;
  salesVolume: string;
  tags: string;
  imageCount: string;
};

type CompetitorAnalysisResponse = {
  insight: CompetitorInsight;
};

const EMPTY_ENTRY: CompetitorEntry = {
  title: "",
  price: "",
  reviews: "",
  rating: "",
  salesVolume: "",
  tags: "",
  imageCount: "",
};

function parseTags(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function CompetitorAnalysisForm(): JSX.Element {
  const [query, setQuery] = useState("");
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([{ ...EMPTY_ENTRY }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompetitorInsight | null>(null);
  const { toast } = useToast();

  const handleChange = (index: number, field: keyof CompetitorEntry) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setCompetitors((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addCompetitor = () => {
    setCompetitors((current) => [...current, { ...EMPTY_ENTRY }]);
  };

  const removeCompetitor = (index: number) => {
    setCompetitors((current) => (current.length > 1 ? current.filter((_, idx) => idx !== index) : current));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        query,
        listings: competitors
          .filter((entry) => entry.title.trim().length > 0)
          .map((entry) => ({
            title: entry.title,
            priceCents: entry.price ? Math.round(Number(entry.price) * 100) : null,
            reviews: entry.reviews ? Number(entry.reviews) : null,
            rating: entry.rating ? Number(entry.rating) : null,
            salesVolume: entry.salesVolume ? Number(entry.salesVolume) : null,
            tags: parseTags(entry.tags),
            imageCount: entry.imageCount ? Number(entry.imageCount) : null,
          })),
      };
      const response = await fetch("/api/insights/competitors", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error ?? `Competitor analysis failed (${response.status})`);
      }
      const json = (await response.json()) as CompetitorAnalysisResponse;
      setResult(json.insight);
      toast({
        title: "Competitor analysis ready",
        description: "Benchmarks generated for the selected niche.",
        variant: "success",
      });
    } catch (error) {
      console.error("Competitor analysis request failed", error);
      toast({
        title: "Unable to benchmark competitors",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surface-card form-card">
      <header>
        <h2>Competitor benchmark</h2>
        <p>Map a keyword or shop niche to the top competitor traits—pricing, reviews, phrasing, and saturation levels.</p>
      </header>
      <form onSubmit={handleSubmit} className="form-grid" autoComplete="off">
        {/* Main Query */}
        <div className="space-y-2">
          <label>
            <span className="font-semibold flex items-center gap-2">
              Keyword or shop name
              <span className="text-destructive">*</span>
            </span>
            <input
              required
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="boho wall art"
              className="w-full"
            />
          </label>
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>Enter the niche or keyword you want to analyze competitor listings for</span>
          </p>
        </div>

        <div className="border-t border-border my-4" />

        {/* Competitor Listings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Competitor Listings ({competitors.length})
          </h3>

          {competitors.map((competitor, index) => (
            <fieldset key={index} className="competitor-fieldset bg-muted/20 rounded-lg p-6 space-y-4 relative">
              <div className="flex items-center justify-between mb-3">
                <legend className="text-base font-bold">Listing #{index + 1}</legend>
                {competitors.length > 1 && (
                  <button
                    type="button"
                    className="competitor-remove flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                    onClick={() => removeCompetitor(index)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="md:col-span-2">
                  <span className="font-medium flex items-center gap-1">
                    Title
                    <span className="text-destructive">*</span>
                  </span>
                  <input
                    required
                    value={competitor.title}
                    onChange={handleChange(index, "title")}
                    placeholder="Personalized boho wall art"
                  />
                </label>

                <label>
                  <span className="font-medium">Price (USD)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={competitor.price}
                    onChange={handleChange(index, "price")}
                    placeholder="36.00"
                  />
                </label>

                <label>
                  <span className="font-medium">Reviews</span>
                  <input
                    type="number"
                    min="0"
                    value={competitor.reviews}
                    onChange={handleChange(index, "reviews")}
                    placeholder="540"
                  />
                </label>

                <label>
                  <span className="font-medium">Rating</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.01"
                    value={competitor.rating}
                    onChange={handleChange(index, "rating")}
                    placeholder="4.8"
                  />
                </label>

                <label>
                  <span className="font-medium">Estimated sales</span>
                  <input
                    type="number"
                    min="0"
                    value={competitor.salesVolume}
                    onChange={handleChange(index, "salesVolume")}
                    placeholder="1200"
                  />
                </label>

                <label>
                  <span className="font-medium">Image count</span>
                  <input
                    type="number"
                    min="0"
                    value={competitor.imageCount}
                    onChange={handleChange(index, "imageCount")}
                    placeholder="8"
                  />
                </label>

                <label className="md:col-span-2">
                  <span className="font-medium">Tags</span>
                  <textarea
                    rows={3}
                    value={competitor.tags}
                    onChange={handleChange(index, "tags")}
                    placeholder="boho decor, neutral wall art"
                  />
                </label>
              </div>
            </fieldset>
          ))}

          <button
            type="button"
            onClick={addCompetitor}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-5 w-5" />
            <span className="font-medium">Add another competitor</span>
          </button>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading} className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Analyzing…" : "Run benchmark"}
          </button>
          <button type="button" onClick={() => setCompetitors([{ ...EMPTY_ENTRY }])} disabled={loading}>
            Reset listings
          </button>
        </div>
      </form>
      {result ? (
        <div className="analysis-result">
          <section className="analysis-scorecard">
            <h3>Market summary</h3>
            <dl>
              <div>
                <dt>Listings analyzed</dt>
                <dd>{result.saturation.total}</dd>
              </div>
              <div>
                <dt>Strong performers</dt>
                <dd>{result.saturation.strong}</dd>
              </div>
              <div>
                <dt>Weak performers</dt>
                <dd>{result.saturation.weak}</dd>
              </div>
              <div>
                <dt>Median price</dt>
                <dd>${(result.priceSummary.quartiles[1] / 100).toFixed(2)}</dd>
              </div>
              <div>
                <dt>Median reviews</dt>
                <dd>{result.reviewSummary.quartiles[1].toFixed(0)}</dd>
              </div>
            </dl>
          </section>
          <section className="analysis-keywords">
            <h3>Shared phrases</h3>
            {result.sharedPhrases.length ? (
              <ul>
                {result.sharedPhrases.map((phrase) => (
                  <li key={phrase}>{phrase}</li>
                ))}
              </ul>
            ) : (
              <p>No overlapping phrases detected.</p>
            )}
          </section>
          <section className="analysis-attributes">
            <h3>Common adjectives</h3>
            {result.commonAdjectives.length ? (
              <ul>
                {result.commonAdjectives.map((adjective) => (
                  <li key={adjective}>{adjective}</li>
                ))}
              </ul>
            ) : (
              <p>Competitor tone data unavailable.</p>
            )}
          </section>
          <section className="analysis-fixes">
            <h3>Tag overlap</h3>
            {result.tagOverlap.length ? (
              <ul>
                {result.tagOverlap.map((entry) => (
                  <li key={entry.tag}>
                    <strong>{entry.tag}</strong>
                    <span>{entry.usage} listings</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No tag similarities observed.</p>
            )}
          </section>
          <section className="analysis-narrative">
            <h3>Insight narrative</h3>
            <p>{result.narrative}</p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
