"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

import { useToast } from "@/components/ui/ToastProvider";
import type { ListingIntelligenceReport } from "@/lib/listings/intelligence";

type ListingFormState = {
  title: string;
  description: string;
  tags: string;
  materials: string;
  categories: string;
  price: string;
  reviews: string;
  rating: string;
  salesVolume: string;
};

type ListingIntelligenceResponse = {
  listingId: string | null;
  report: ListingIntelligenceReport;
};

const INITIAL_FORM_STATE: ListingFormState = {
  title: "",
  description: "",
  tags: "",
  materials: "",
  categories: "",
  price: "",
  reviews: "",
  rating: "",
  salesVolume: "",
};

function parseList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function ListingIntelligenceForm(): JSX.Element {
  const [form, setForm] = useState<ListingFormState>(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ListingIntelligenceResponse | null>(null);
  const { push } = useToast();

  const keywordLeaders = useMemo(() => {
    if (!result?.report.keywordDensity.length) {
      return [];
    }
    return result.report.keywordDensity.slice(0, 5);
  }, [result]);

  const handleChange = (field: keyof ListingFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        listing: {
          title: form.title,
          description: form.description,
          tags: parseList(form.tags),
          materials: parseList(form.materials),
          categories: parseList(form.categories),
          priceCents: form.price ? Math.round(Number(form.price) * 100) : null,
          reviews: form.reviews ? Number(form.reviews) : null,
          rating: form.rating ? Number(form.rating) : null,
          salesVolume: form.salesVolume ? Number(form.salesVolume) : null,
        },
      };
      const response = await fetch("/api/listings/intelligence", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error ?? `Listing analysis failed (${response.status})`);
      }
      const json = (await response.json()) as ListingIntelligenceResponse;
      setResult(json);
      push({
        title: "Scorecard ready",
        description: "Listing quality analysis completed.",
        tone: "success",
      });
    } catch (error) {
      console.error("Listing intelligence request failed", error);
      push({
        title: "Unable to score listing",
        description: error instanceof Error ? error.message : "Unknown error",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(INITIAL_FORM_STATE);
    setResult(null);
  };

  return (
    <section className="surface-card form-card">
      <header>
        <h2>Listing quality score</h2>
        <p>Paste a listing draft or synced product to receive tone, sentiment, completeness, and quick fix recommendations.</p>
      </header>
      <form onSubmit={handleSubmit} className="form-grid" autoComplete="off">
        <label>
          Title
          <input required value={form.title} onChange={handleChange("title")} placeholder="Custom birth flower necklace" />
        </label>
        <label>
          Tags
          <textarea
            rows={3}
            value={form.tags}
            onChange={handleChange("tags")}
            placeholder="gift for mom, minimalist jewelry, birth flower"
          />
        </label>
        <label>
          Materials
          <input value={form.materials} onChange={handleChange("materials")} placeholder="14k gold fill, freshwater pearl" />
        </label>
        <label>
          Categories
          <input value={form.categories} onChange={handleChange("categories")} placeholder="Jewelry, Necklaces" />
        </label>
        <label>
          Description
          <textarea
            rows={6}
            value={form.description}
            onChange={handleChange("description")}
            placeholder="Share the story, materials, and sizing guidance for this listing."
          />
        </label>
        <label>
          Price (USD)
          <input type="number" min="0" step="0.01" value={form.price} onChange={handleChange("price")} placeholder="48.00" />
        </label>
        <label>
          Reviews
          <input type="number" min="0" value={form.reviews} onChange={handleChange("reviews")} placeholder="120" />
        </label>
        <label>
          Rating
          <input type="number" min="0" max="5" step="0.01" value={form.rating} onChange={handleChange("rating")} placeholder="4.9" />
        </label>
        <label>
          Sales volume
          <input type="number" min="0" value={form.salesVolume} onChange={handleChange("salesVolume")} placeholder="320" />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? "Scoring…" : "Run analysis"}
          </button>
          <button type="button" onClick={resetForm} disabled={loading}>
            Clear
          </button>
        </div>
      </form>
      {result ? (
        <div className="analysis-result">
          <section className="analysis-scorecard">
            <h3>Score breakdown</h3>
            <dl>
              <div>
                <dt>Quality score</dt>
                <dd>{(result.report.qualityScore * 100).toFixed(0)}%</dd>
              </div>
              <div>
                <dt>Completeness</dt>
                <dd>{(result.report.completeness * 100).toFixed(0)}%</dd>
              </div>
              <div>
                <dt>Sentiment</dt>
                <dd>{(result.report.sentiment * 50 + 50).toFixed(0)} / 100</dd>
              </div>
              <div>
                <dt>Readability</dt>
                <dd>{(result.report.readability * 100).toFixed(0)}%</dd>
              </div>
              <div>
                <dt>Intent</dt>
                <dd className="analysis-pill">{result.report.intent}</dd>
              </div>
              <div>
                <dt>Tone</dt>
                <dd className="analysis-pill">{result.report.tone}</dd>
              </div>
            </dl>
          </section>
          <section className="analysis-keywords">
            <h3>Keyword density leaders</h3>
            {keywordLeaders.length ? (
              <ul>
                {keywordLeaders.map((entry) => (
                  <li key={entry.keyword}>
                    <strong>{entry.keyword}</strong>
                    <span>{(entry.density * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No meaningful keywords detected.</p>
            )}
          </section>
          <section className="analysis-attributes">
            <h3>Missing attributes</h3>
            {result.report.missingAttributes.length ? (
              <ul>
                {result.report.missingAttributes.map((attribute) => (
                  <li key={attribute}>{attribute}</li>
                ))}
              </ul>
            ) : (
              <p>Great job! No gaps detected.</p>
            )}
          </section>
          <section className="analysis-fixes">
            <h3>Quick fixes</h3>
            {result.report.quickFixes.length ? (
              <ul>
                {result.report.quickFixes.map((fix) => (
                  <li key={fix.id}>
                    <strong>{fix.title}</strong>
                    <span>{fix.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Your listing already checks every box.</p>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
