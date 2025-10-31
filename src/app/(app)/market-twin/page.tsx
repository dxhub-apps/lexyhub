"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItem,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

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
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title="AI Market Twin"
          subheader="Compare your baseline Etsy listings against hypothetical upgrades to predict visibility shifts."
          action={<Chip label="Live simulation" color="success" variant="outlined" />}
        />
      </Card>

      <Grid container spacing={3} alignItems="flex-start">
        <Grid item xs={12} lg={7}>
          <Card>
            <CardHeader title="Simulation wizard" subheader="Select a baseline listing and tweak the scenario." />
            <CardContent>
              <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
                <FormControl fullWidth>
                  <InputLabel id="baseline-listing-label">Baseline listing</InputLabel>
                  <Select
                    labelId="baseline-listing-label"
                    value={selectedListingId ?? ""}
                    label="Baseline listing"
                    onChange={(event) => setSelectedListingId(event.target.value || null)}
                    disabled={loading || listings.length === 0}
                  >
                    <MenuItem value="" disabled>
                      {loading ? "Loading listings…" : "Select a listing"}
                    </MenuItem>
                    {listings.map((listing) => (
                      <MenuItem key={listing.id} value={listing.id}>
                        {listing.title} — {listing.shopName ?? "Etsy shop"}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Scenario title"
                  value={scenarioTitle}
                  onChange={(event) => setScenarioTitle(event.target.value)}
                  placeholder="Improved SEO title"
                  fullWidth
                />
                <TextField
                  label="Scenario price (USD)"
                  type="number"
                  inputProps={{ step: 0.01 }}
                  value={scenarioPrice}
                  onChange={(event) => setScenarioPrice(event.target.value)}
                  placeholder="29.99"
                  fullWidth
                />
                <TextField
                  label="Scenario tags"
                  value={scenarioTags}
                  onChange={(event) => setScenarioTags(event.target.value)}
                  placeholder="handmade, gift, trending"
                  multiline
                  minRows={3}
                  fullWidth
                />
                <TextField
                  label="Goals"
                  value={goals}
                  onChange={(event) => setGoals(event.target.value)}
                  placeholder="Increase visibility;Improve conversion"
                  fullWidth
                />
                <TextField
                  label="Description tweaks"
                  value={scenarioDescription}
                  onChange={(event) => setScenarioDescription(event.target.value)}
                  placeholder="Highlight faster shipping, new bundles, or creative variations."
                  multiline
                  minRows={4}
                  fullWidth
                />
                <Button type="submit" variant="contained" size="large" disabled={submitting}>
                  {submitting ? "Running simulation…" : "Run Market Twin"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Stack spacing={3}>
            <Card>
              <CardHeader title="Baseline snapshot" />
              <CardContent>
                {activeListing ? (
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {activeListing.title}
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Shop
                        </Typography>
                        <Typography variant="body2">{activeListing.shopName ?? "Etsy"}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Typography variant="body2">{activeListing.status}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Price
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(activeListing.priceCents, activeListing.currency)}
                        </Typography>
                      </Stack>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Tags
                        </Typography>
                        <Typography variant="body2">
                          {activeListing.tags.length ? activeListing.tags.join(", ") : "No tags"}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Signals
                        </Typography>
                        <Typography variant="body2">
                          {activeListing.stats
                            ? `${activeListing.stats.views} views · ${activeListing.stats.favorites} favorites`
                            : "No stats yet"}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                ) : (
                  <Alert severity="info">Select a listing to inspect baseline metrics.</Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Recent simulations" />
              <CardContent>
                {history.length === 0 ? (
                  <Alert severity="info">No simulations recorded yet.</Alert>
                ) : (
                  <List sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {history.map((record) => {
                      const timestamp = record.createdAt ?? record.created_at;
                      const label = timestamp ? new Date(timestamp).toLocaleString() : "Pending";
                      return (
                        <ListItem
                          key={record.id ?? record.createdAt ?? label}
                          sx={{
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            alignItems: "flex-start",
                            flexDirection: "column",
                            gap: 1,
                          }}
                        >
                          <Stack spacing={0.5} sx={{ width: "100%" }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {record.baseline?.title ?? record.scenario_input?.scenarioTitle ?? "Scenario"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {label}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {record.result?.explanation ??
                              record.extras?.explanation ??
                              "Analysis pending. Check back shortly."}
                          </Typography>
                          <Divider flexItem sx={{ my: 1 }} />
                          <Stack direction="row" spacing={2} sx={{ width: "100%" }}>
                            <Typography variant="caption" color="text.secondary">
                              Visibility: {formatPercent(record.result?.predictedVisibility ?? record.predicted_visibility)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Confidence: {formatPercent(record.result?.confidence ?? record.confidence)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Semantic gap: {formatPercent(record.result?.semanticGap ?? record.extras?.semanticGap)}
                            </Typography>
                          </Stack>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
