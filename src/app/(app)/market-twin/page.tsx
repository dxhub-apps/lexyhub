"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/ToastProvider";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

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
  const { push } = useToast();
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
      setLoading(true);
      try {
        const listingResponse = await fetch(`/api/listings?userId=${DEFAULT_USER_ID}`, {
          signal: controller.signal,
        });
        const listingJson = await listingResponse.json();
        setListings(listingJson.listings ?? []);

        const historyResponse = await fetch(`/api/market-twin?userId=${DEFAULT_USER_ID}`, {
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
  }, []);

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
      push({ title: "Select a listing", description: "Choose an Etsy listing to simulate.", tone: "warning" });
      return;
    }
    if (!scenarioTitle.trim()) {
      push({ title: "Scenario title required", description: "Give your hypothetical listing a title.", tone: "warning" });
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
          userId: DEFAULT_USER_ID,
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

      push({
        title: "Simulation ready",
        description: "Market Twin computed new visibility and semantic fit.",
        tone: "success",
      });

      setHistory((records) => [json, ...records].slice(0, 25));
    } catch (error) {
      push({
        title: "Simulation failed",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="market-twin">
      <section className="surface-card market-twin-hero">
        <div>
          <h1>AI Market Twin</h1>
          <p>Compare your baseline Etsy listings against hypothetical upgrades to predict visibility shifts.</p>
        </div>
        <span className="badge">Live Simulation</span>
      </section>

      <section className="market-twin-grid">
        <form className="market-twin-form" onSubmit={handleSubmit}>
          <h2>Simulation wizard</h2>
          <p>Select a baseline listing, tweak the scenario, and generate AI-backed projections.</p>

          <label>
            <span>Baseline listing</span>
            <select
              value={selectedListingId ?? ""}
              onChange={(event) => setSelectedListingId(event.target.value || null)}
              disabled={loading || listings.length === 0}
            >
              <option value="" disabled>
                {loading ? "Loading listings..." : "Select a listing"}
              </option>
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title} — {listing.shopName ?? "Etsy shop"}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Scenario title</span>
            <input value={scenarioTitle} onChange={(event) => setScenarioTitle(event.target.value)} placeholder="Improved SEO title" />
          </label>

          <label>
            <span>Scenario price (USD)</span>
            <input
              type="number"
              step="0.01"
              value={scenarioPrice}
              onChange={(event) => setScenarioPrice(event.target.value)}
              placeholder="29.99"
            />
          </label>

          <label>
            <span>Scenario tags</span>
            <textarea
              rows={3}
              value={scenarioTags}
              onChange={(event) => setScenarioTags(event.target.value)}
              placeholder="handmade, gift, trending"
            />
          </label>

          <label>
            <span>Goals</span>
            <input value={goals} onChange={(event) => setGoals(event.target.value)} placeholder="Increase visibility;Improve conversion" />
          </label>

          <label>
            <span>Description tweaks</span>
            <textarea
              rows={4}
              value={scenarioDescription}
              onChange={(event) => setScenarioDescription(event.target.value)}
              placeholder="Highlight faster shipping, new bundles, or creative variations."
            />
          </label>

          <button type="submit" className="market-twin-primary" disabled={submitting}>
            {submitting ? "Running simulation..." : "Run Market Twin"}
          </button>
        </form>

        <aside className="market-twin-sidebar">
          <h2>Baseline snapshot</h2>
          {activeListing ? (
            <div className="market-twin-baseline">
              <h3>{activeListing.title}</h3>
              <dl>
                <div>
                  <dt>Shop</dt>
                  <dd>{activeListing.shopName ?? "Etsy"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{activeListing.status}</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>{formatCurrency(activeListing.priceCents, activeListing.currency)}</dd>
                </div>
                <div>
                  <dt>Tags</dt>
                  <dd>{activeListing.tags.length ? activeListing.tags.join(", ") : "No tags"}</dd>
                </div>
                <div>
                  <dt>Signals</dt>
                  <dd>
                    {activeListing.stats ? (
                      <>
                        {activeListing.stats.views} views · {activeListing.stats.favorites} favorites
                      </>
                    ) : (
                      "No stats yet"
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="market-twin-placeholder">Select a listing to inspect baseline metrics.</p>
          )}

          <h2>Recent simulations</h2>
          <ul className="market-twin-history">
            {history.length === 0 && <li className="market-twin-placeholder">No simulations recorded yet.</li>}
            {history.map((record) => {
              const timestamp = record.createdAt ?? record.created_at;
              const label = timestamp ? new Date(timestamp).toLocaleString() : "Pending";
              return (
                <li key={record.id ?? record.createdAt ?? label}>
                  <div>
                    <strong>{record.baseline?.title ?? record.scenario_input?.scenarioTitle ?? "Scenario"}</strong>
                    <span>{label}</span>
                  </div>
                  <p>{record.result?.explanation ?? record.extras?.explanation ?? "Analysis pending. Check back shortly."}</p>
                  <footer>
                    <span>Visibility: {formatPercent(record.result?.predictedVisibility ?? record.predicted_visibility)}</span>
                    <span>Confidence: {formatPercent(record.result?.confidence ?? record.confidence)}</span>
                    <span>Semantic gap: {formatPercent(record.result?.semanticGap ?? record.extras?.semanticGap)}</span>
                  </footer>
                </li>
              );
            })}
          </ul>
        </aside>
      </section>
    </div>
  );
}
