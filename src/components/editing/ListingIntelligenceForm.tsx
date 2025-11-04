"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

import { useToast } from "@/components/ui/use-toast";
import type { ListingIntelligenceReport } from "@/lib/listings/intelligence";
import type { NormalizedEtsyListing } from "@/lib/etsy/types";
import type {
  AiSuggestionResult,
  DifficultyScoreResult,
  KeywordExtractionResult,
} from "@/lib/etsy/pipelines";

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
  listing?: NormalizedEtsyListing | null;
  report: ListingIntelligenceReport;
  pipelines?: {
    keywords?: KeywordExtractionResult | null;
    difficulty?: DifficultyScoreResult | null;
    suggestions?: AiSuggestionResult | null;
  };
  fromCache?: boolean;
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
  const [listingUrl, setListingUrl] = useState("");
  const [loadingMode, setLoadingMode] = useState<"form" | "best-sellers" | null>(null);
  const loading = loadingMode !== null;
  const [result, setResult] = useState<ListingIntelligenceResponse | null>(null);
  const [ingestedListing, setIngestedListing] = useState<NormalizedEtsyListing | null>(null);
  const { toast } = useToast();

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
    setLoadingMode("form");
    setResult(null);
    setIngestedListing(null);
    try {
      const trimmedUrl = listingUrl.trim();
      if (!trimmedUrl && !form.title.trim()) {
        toast({
          title: "Listing title required",
          description: "Provide a title or paste an Etsy URL to analyze.",
          variant: "warning",
        });
        setLoadingMode(null);
        return;
      }

      const payload: Record<string, unknown> = {};
      if (trimmedUrl) {
        payload.listingUrl = trimmedUrl;
      }
      if (!trimmedUrl) {
        payload.listing = {
          title: form.title,
          description: form.description,
          tags: parseList(form.tags),
          materials: parseList(form.materials),
          categories: parseList(form.categories),
          priceCents: form.price ? Math.round(Number(form.price) * 100) : null,
          reviews: form.reviews ? Number(form.reviews) : null,
          rating: form.rating ? Number(form.rating) : null,
          salesVolume: form.salesVolume ? Number(form.salesVolume) : null,
        };
      }
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
      setIngestedListing(json.listing ?? null);
      toast({
        title: "Scorecard ready",
        description: "Listing quality analysis completed.",
        variant: "success",
      });
    } catch (error) {
      console.error("Listing intelligence request failed", error);
      toast({
        title: "Unable to score listing",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingMode(null);
    }
  };

  const analyzeBestSeller = async () => {
    if (loading) {
      return;
    }
    setLoadingMode("best-sellers");
    setResult(null);
    setIngestedListing(null);
    try {
      const response = await fetch("/api/listings/intelligence", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ ingestionMode: "best-sellers" }),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error ?? `Best seller analysis failed (${response.status})`);
      }
      const json = (await response.json()) as ListingIntelligenceResponse;
      setResult(json);
      setIngestedListing(json.listing ?? null);
      setListingUrl(json.listing?.url ?? "");
      toast({
        title: "Best seller ready",
        description: "Fetched Etsy best seller insights with no URL required.",
        variant: "success",
      });
    } catch (error) {
      console.error("Best seller ingestion failed", error);
      toast({
        title: "Unable to fetch best seller",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingMode(null);
    }
  };

  const resetForm = () => {
    setForm(INITIAL_FORM_STATE);
    setListingUrl("");
    setResult(null);
    setIngestedListing(null);
  };

  return (
    <section className="surface-card form-card">
      <header>
        <h2>Listing quality score</h2>
        <p>
          Paste a listing draft, provide an Etsy URL, or instantly fetch a top best seller to receive tone, sentiment,
          completeness, and quick fix recommendations.
        </p>
      </header>
      <form onSubmit={handleSubmit} className="form-grid" autoComplete="off">
        <label>
          Etsy listing URL
          <input
            type="url"
            value={listingUrl}
            onChange={(event) => setListingUrl(event.target.value)}
            placeholder="https://www.etsy.com/listing/123456789/example"
          />
        </label>
        <label>
          Title
          <input value={form.title} onChange={handleChange("title")} placeholder="Custom birth flower necklace" />
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
            {loadingMode === "form" ? "Scoring…" : "Run analysis"}
          </button>
          <button type="button" onClick={analyzeBestSeller} disabled={loading}>
            {loadingMode === "best-sellers" ? "Fetching best seller…" : "Analyze Etsy best seller"}
          </button>
          <button type="button" onClick={resetForm} disabled={loading}>
            Clear
          </button>
        </div>
      </form>
      {ingestedListing ? (
        <section className="analysis-context">
          <h3>Ingested listing</h3>
          <dl>
            <div>
              <dt>Title</dt>
              <dd>{ingestedListing.title ?? "Untitled"}</dd>
            </div>
            <div>
              <dt>Shop</dt>
              <dd>{ingestedListing.shop.name ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>
                {ingestedListing.price.amount != null
                  ? `${ingestedListing.price.currency ?? "USD"} ${ingestedListing.price.amount.toFixed(2)}`
                  : "n/a"}
              </dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                {ingestedListing.source === "scrape"
                  ? "Data collected from public page"
                  : "Retrieved from Etsy API"}
                {result?.fromCache ? " (cached)" : null}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
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
                <dd className="analysis-pill">{result.report.variant}</dd>
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
          {result.pipelines?.difficulty ? (
            <section className="analysis-scorecard">
              <h3>Difficulty score</h3>
              <p className="analysis-highlight">{(result.pipelines.difficulty.score * 100).toFixed(0)}%</p>
              <p>{result.pipelines.difficulty.rationale}</p>
            </section>
          ) : null}
          {result.pipelines?.keywords?.keywords?.length ? (
            <section className="analysis-keywords">
              <h3>Extracted keywords</h3>
              <ul>
                {result.pipelines.keywords.keywords.map((keyword) => (
                  <li key={keyword}>{keyword}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {result.pipelines?.suggestions?.suggestions?.length ? (
            <section className="analysis-attributes">
              <h3>AI suggestions</h3>
              <ul>
                {result.pipelines.suggestions.suggestions.map((suggestion, index) => (
                  <li key={`${suggestion}-${index}`}>{suggestion}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
