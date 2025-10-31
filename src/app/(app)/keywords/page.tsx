"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import KeywordSparkline from "@/components/keywords/KeywordSparkline";
import { useToast } from "@/components/ui/ToastProvider";

type PlanTier = "free" | "growth" | "scale";

type KeywordResult = {
  id?: string;
  term: string;
  source: string;
  market: string;
  similarity: number;
  ai_opportunity_score?: number | null;
  trend_momentum?: number | null;
  freshness_ts?: string | null;
  method?: string | null;
  extras?: Record<string, unknown> | null;
  compositeScore?: number;
};

type SearchResponse = {
  query: string;
  market: string;
  source: string;
  plan: PlanTier;
  sources: string[];
  results: KeywordResult[];
  insights?: {
    summary: string;
    generatedAt: string;
    model: string;
  };
};

type TagOptimizerResult = {
  tags: string[];
  reasoning: string;
  confidence: number;
  model: string;
};

type DataLineageSummary = {
  plan: PlanTier;
  sources: string[];
  freshest: string;
  recordCount: number;
};

export default function KeywordsPage(): JSX.Element {
  const [query, setQuery] = useState("handmade jewelry");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [insights, setInsights] = useState<SearchResponse["insights"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>("growth");
  const [responsePlan, setResponsePlan] = useState<PlanTier>("growth");
  const [sourceFilters, setSourceFilters] = useState<string[]>(["synthetic", "amazon"]);
  const [responseSources, setResponseSources] = useState<string[]>(["synthetic", "amazon"]);

  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<TagOptimizerResult | null>(null);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordResult | null>(null);

  const { push } = useToast();

  const availableSources = useMemo(() => {
    if (selectedPlan === "free") {
      return ["synthetic"];
    }
    return ["synthetic", "amazon"];
  }, [selectedPlan]);

  const toggleSource = useCallback(
    (_event: React.MouseEvent<HTMLElement>, value: string | null) => {
      if (!value) {
        return;
      }
      setSourceFilters((current) => {
        const normalized = value.toLowerCase();
        if (current.includes(normalized)) {
          if (current.length === 1) {
            return current;
          }
          return current.filter((item) => item !== normalized);
        }
        return Array.from(new Set([...current, normalized]));
      });
    },
    [],
  );

  useEffect(() => {
    setSourceFilters((current) => {
      const normalized = current.filter((item) => availableSources.includes(item));
      if (normalized.length === 0) {
        return availableSources;
      }
      return normalized;
    });
  }, [availableSources]);

  const performSearch = useCallback(
    async (term: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/keywords/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: term,
            market: "us",
            limit: 25,
            plan: selectedPlan,
            sources: sourceFilters,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Keyword search failed (${response.status})`);
        }

        const payload = (await response.json()) as SearchResponse;
        setResults(payload.results ?? []);
        setInsights(payload.insights ?? null);
        setLastQuery(payload.query ?? term);
        setResponsePlan(payload.plan ?? selectedPlan);
        setResponseSources(payload.sources ?? sourceFilters);
      } catch (err) {
        console.error("Failed to execute keyword search", err);
        setError(err instanceof Error ? err.message : "Unexpected error occurred");
      } finally {
        setLoading(false);
      }
    },
    [selectedPlan, sourceFilters],
  );

  const handleWatchlist = useCallback(
    async (keyword: KeywordResult) => {
      try {
        const response = await fetch("/api/watchlists/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywordId: keyword.id, watchlistName: "Lexy Tracking" }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Unable to add keyword (${response.status})`);
        }
        push({
          title: "Added to watchlist",
          description: `"${keyword.term}" is now monitored.`,
          tone: "success",
        });
      } catch (err) {
        console.error("Failed to add keyword to watchlist", err);
        push({
          title: "Watchlist error",
          description: err instanceof Error ? err.message : "Unexpected error",
          tone: "error",
        });
      }
    },
    [push],
  );

  const handleOptimize = useCallback(
    async (keyword: KeywordResult) => {
      setSelectedKeyword(keyword);
      setOptimizerOpen(true);
      setOptimizerLoading(true);
      setOptimizerResult(null);
      setOptimizerError(null);
      try {
        const response = await fetch("/api/ai/tag-optimizer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywordId: keyword.id,
            listingTitle: keyword.term,
            market: keyword.market,
            currentTags: keyword.extras?.["tags"] as string[] | undefined,
            goals: ["visibility", "conversion"],
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Optimizer request failed (${response.status})`);
        }

        const payload = (await response.json()) as TagOptimizerResult;
        setOptimizerResult(payload);
      } catch (err) {
        console.error("Failed to optimize tags", err);
        setOptimizerError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setOptimizerLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (bootstrapped) {
      return;
    }
    setBootstrapped(true);
    void performSearch(query);
  }, [bootstrapped, performSearch, query]);

  const complianceNotes = useMemo(() => {
    if (!results.length) {
      return "We refresh your results whenever new data arrives and keep track of where each idea began.";
    }

    const uniqueSources = (responseSources.length
      ? responseSources
      : Array.from(new Set(results.map((item) => item.source)))).join(", ");
    const freshest = results[0]?.freshness_ts
      ? new Date(results[0]?.freshness_ts).toLocaleString()
      : "Not yet synced";

    return `Plan: ${responsePlan}. Source(s): ${uniqueSources || "synthetic"}. Freshness: ${freshest}. Retrieval method adjusts per provider to maintain accuracy.`;
  }, [responsePlan, responseSources, results]);

  const dataLineage = useMemo<DataLineageSummary>(() => {
    const freshest = results.reduce<string | null>((latest, record) => {
      if (!record.freshness_ts) {
        return latest;
      }
      const timestamp = record.freshness_ts;
      if (!latest) {
        return timestamp;
      }
      return new Date(timestamp).getTime() > new Date(latest).getTime() ? timestamp : latest;
    }, null);

    const summary: DataLineageSummary = {
      plan: responsePlan,
      sources: responseSources.length ? responseSources : ["synthetic"],
      freshest: freshest ? new Date(freshest).toLocaleString() : "Not yet synced",
      recordCount: results.length,
    };

    return summary;
  }, [responsePlan, responseSources, results]);

  const sparklinePoints = useMemo(() => {
    const deriveValue = (keyword: KeywordResult): number | null => {
      if (typeof keyword.compositeScore === "number" && Number.isFinite(keyword.compositeScore)) {
        return Math.max(0, Math.min(1, keyword.compositeScore));
      }
      if (typeof keyword.trend_momentum === "number" && Number.isFinite(keyword.trend_momentum)) {
        return Math.max(0, Math.min(1, keyword.trend_momentum));
      }
      if (typeof keyword.ai_opportunity_score === "number" && Number.isFinite(keyword.ai_opportunity_score)) {
        return Math.max(0, Math.min(1, keyword.ai_opportunity_score));
      }
      if (Number.isFinite(keyword.similarity)) {
        return Math.max(0, Math.min(1, keyword.similarity));
      }
      return null;
    };

    const parseTimestamp = (value: string | null | undefined): number => {
      if (!value) {
        return 0;
      }
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    return results
      .map((keyword) => {
        const value = deriveValue(keyword);
        if (value == null) {
          return null;
        }
        return {
          value,
          label: keyword.term,
          timestamp: keyword.freshness_ts ?? null,
          order: parseTimestamp(keyword.freshness_ts),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.order - b.order)
      .map(({ value, label, timestamp }) => ({ value, label, timestamp }))
      .slice(-24);
  }, [results]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void performSearch(query);
    },
    [performSearch, query],
  );

  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title="Keyword Intelligence"
          subheader="Explore synthetic demand signals and surface high-propensity commerce keywords."
        />
        <CardContent>
          <Stack component="form" spacing={2} direction={{ xs: "column", md: "row" }} onSubmit={handleSubmit}>
            <TextField
              label="Search keywords"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. boho nursery decor"
              fullWidth
              disabled={loading}
            />
            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? "Searching…" : "Search"}
            </Button>
          </Stack>
          <Grid container spacing={2} sx={{ mt: 2 }} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="plan-tier-label">Plan tier</InputLabel>
                <Select
                  labelId="plan-tier-label"
                  id="plan-tier"
                  value={selectedPlan}
                  label="Plan tier"
                  onChange={(event) => setSelectedPlan(event.target.value as PlanTier)}
                  disabled={loading}
                >
                  <MenuItem value="free">Free</MenuItem>
                  <MenuItem value="growth">Growth</MenuItem>
                  <MenuItem value="scale">Scale</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Sources
              </Typography>
              <ToggleButtonGroup
                value={sourceFilters}
                onChange={toggleSource}
                size="small"
                color="primary"
              >
                {availableSources.map((source) => (
                  <ToggleButton key={source} value={source} disabled={loading && !sourceFilters.includes(source)}>
                    {source}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Grid>
            <Grid item xs={12} md={3} sx={{ textAlign: { xs: "left", md: "right" } }}>
              <Button
                variant="outlined"
                onClick={() => void performSearch(query)}
                disabled={loading}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : null}

      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: "100%" }}>
            <CardHeader
              title="Results"
              subheader={`Query: ${lastQuery || query} · ${results.length} matches`}
            />
            <CardContent>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Term</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Similarity</TableCell>
                      <TableCell>Composite</TableCell>
                      <TableCell>AI Opportunity</TableCell>
                      <TableCell>Trend Momentum</TableCell>
                      <TableCell>Freshness</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((keyword) => (
                      <TableRow key={`${keyword.term}-${keyword.market}`} hover>
                        <TableCell>
                          <Stack spacing={0.5}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {keyword.term}
                            </Typography>
                            {keyword.extras && keyword.extras["category"] ? (
                              <Chip
                                label={String(keyword.extras["category"])}
                                size="small"
                                color="secondary"
                                variant="outlined"
                              />
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip label={keyword.source} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{(keyword.similarity * 100).toFixed(1)}%</TableCell>
                        <TableCell>
                          {typeof keyword.compositeScore === "number"
                            ? `${(keyword.compositeScore * 100).toFixed(1)}%`
                            : "—"}
                        </TableCell>
                        <TableCell>{keyword.ai_opportunity_score?.toFixed(2) ?? "—"}</TableCell>
                        <TableCell>{keyword.trend_momentum?.toFixed(2) ?? "—"}</TableCell>
                        <TableCell>
                          {keyword.freshness_ts
                            ? new Date(keyword.freshness_ts).toLocaleDateString()
                            : "Pending"}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleWatchlist(keyword)}
                            >
                              Watchlist
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => void handleOptimize(keyword)}
                            >
                              Optimize
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!results.length && !loading ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                          <Typography variant="body2" color="text.secondary">
                            No keywords yet. Run a search to populate this table.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Stack spacing={3} sx={{ height: "100%" }}>
            <Card>
              <CardHeader title="Helpful Highlights" subheader={insights?.model ?? "AI summary"} />
              <CardContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {insights?.summary ?? "Run a search to see helpful keyword tips."}
                </Typography>
                <KeywordSparkline points={sparklinePoints} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
                  Last updated: {insights?.generatedAt ? new Date(insights.generatedAt).toLocaleString() : "Not available"}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Update Notes" />
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {complianceNotes}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Data Info" />
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Plan
                    </Typography>
                    <Typography variant="body2">{dataLineage.plan}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Sources
                    </Typography>
                    <Typography variant="body2">{dataLineage.sources.join(", ")}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Freshest Sync
                    </Typography>
                    <Typography variant="body2">{dataLineage.freshest}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Records
                    </Typography>
                    <Typography variant="body2">{dataLineage.recordCount}</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
            <Card sx={{ flexGrow: 1 }}>
              <CardHeader title="Quick Tips" />
              <CardContent>
                <Stack component="ul" spacing={1.5} sx={{ pl: 2 }}>
                  <Typography component="li" variant="body2">
                    Check your keyword list often so it stays up to date.
                  </Typography>
                  <Typography component="li" variant="body2">
                    Refresh your sources regularly to keep marketplace news fresh.
                  </Typography>
                  <Typography component="li" variant="body2">
                    Add important terms to your watchlist to keep an eye on them.
                  </Typography>
                </Stack>
                <Button component={Link} href="/docs" sx={{ mt: 2 }}>
                  Visit documentation
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Dialog open={optimizerOpen} onClose={() => setOptimizerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Tag Optimizer</DialogTitle>
        <DialogContent>
          {selectedKeyword ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Keyword context: <strong>{selectedKeyword.term}</strong> ({selectedKeyword.market})
            </Typography>
          ) : null}
          {optimizerLoading ? <Typography>Generating AI suggestions…</Typography> : null}
          {optimizerError ? <Alert severity="error">{optimizerError}</Alert> : null}
          {optimizerResult ? (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Suggested Tags <Typography component="span" variant="caption">({optimizerResult.model})</Typography>
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                  {optimizerResult.tags.map((tag) => (
                    <Chip key={tag} label={tag} variant="outlined" />
                  ))}
                </Stack>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {optimizerResult.reasoning}
              </Typography>
              <Typography variant="body2">
                Confidence: {(optimizerResult.confidence * 100).toFixed(0)}%
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOptimizerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
