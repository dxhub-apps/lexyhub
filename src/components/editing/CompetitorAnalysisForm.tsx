"use client";

import { ChangeEvent, FormEvent, useState } from "react";

import { useToast } from "@/components/ui/ToastProvider";
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
  const { push } = useToast();

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
      push({
        title: "Competitor analysis ready",
        description: "Benchmarks generated for the selected niche.",
        tone: "success",
      });
    } catch (error) {
      console.error("Competitor analysis request failed", error);
      push({
        title: "Unable to benchmark competitors",
        description: error instanceof Error ? error.message : "Unknown error",
        tone: "error",
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
        <label>
          Keyword or shop name
          <input required value={query} onChange={(event) => setQuery(event.target.value)} placeholder="boho wall art" />
        </label>
        {competitors.map((competitor, index) => (
          <fieldset key={index} className="competitor-fieldset">
            <legend>Listing #{index + 1}</legend>
            <label>
              Title
              <input required value={competitor.title} onChange={handleChange(index, "title")} placeholder="Personalized boho wall art" />
            </label>
            <label>
              Price (USD)
              <input type="number" min="0" step="0.01" value={competitor.price} onChange={handleChange(index, "price")} placeholder="36.00" />
            </label>
            <label>
              Reviews
              <input type="number" min="0" value={competitor.reviews} onChange={handleChange(index, "reviews")} placeholder="540" />
            </label>
            <label>
              Rating
              <input type="number" min="0" max="5" step="0.01" value={competitor.rating} onChange={handleChange(index, "rating")} placeholder="4.8" />
            </label>
            <label>
              Estimated sales
              <input type="number" min="0" value={competitor.salesVolume} onChange={handleChange(index, "salesVolume")} placeholder="1200" />
            </label>
            <label>
              Tags
              <textarea rows={3} value={competitor.tags} onChange={handleChange(index, "tags")} placeholder="boho decor, neutral wall art" />
            </label>
            <label>
              Image count
              <input type="number" min="0" value={competitor.imageCount} onChange={handleChange(index, "imageCount")} placeholder="8" />
            </label>
            <button type="button" className="competitor-remove" onClick={() => removeCompetitor(index)} disabled={competitors.length === 1 || loading}>
              Remove listing
            </button>
          </fieldset>
        ))}
        <div className="competitor-actions">
          <button type="button" onClick={addCompetitor} disabled={loading}>
            Add another competitor
          </button>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={loading}>
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
