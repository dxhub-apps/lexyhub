"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import type { CrawlerStatus, HealthMetric } from "@/lib/backoffice/status";

function MetricCard({ metric }: { metric: HealthMetric }) {
  const tone: Record<HealthMetric["status"], "success" | "warning" | "error"> = {
    ok: "success",
    warning: "warning",
    critical: "error",
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {metric.category}
            </Typography>
            <Chip label={metric.status.toUpperCase()} color={tone[metric.status]} size="small" variant="outlined" />
          </Stack>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {metric.metric_label}
          </Typography>
          <Typography variant="h5">
            {metric.metric_value ?? "—"}
            {metric.metric_unit === "percent" ? "%" : ""}
          </Typography>
          {metric.delta != null ? (
            <Typography
              variant="body2"
              color={metric.delta >= 0 ? "success.main" : "error.main"}
            >
              {metric.delta >= 0 ? "▲" : "▼"} {Math.abs(metric.delta)}
              {metric.metric_unit === "percent" ? "%" : ""}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.secondary">
            Captured {new Date(metric.captured_at).toLocaleString()}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function CrawlerRow({ crawler }: { crawler: CrawlerStatus }) {
  return (
    <TableRow>
      <TableCell>{crawler.source}</TableCell>
      <TableCell>{crawler.status}</TableCell>
      <TableCell>{crawler.total_records ?? "—"}</TableCell>
      <TableCell>{crawler.last_run_at ? new Date(crawler.last_run_at).toLocaleString() : "—"}</TableCell>
      <TableCell>{crawler.next_run_at ? new Date(crawler.next_run_at).toLocaleString() : "—"}</TableCell>
      <TableCell>{crawler.error_message ?? "—"}</TableCell>
    </TableRow>
  );
}

type RiskSummary = {
  total: number;
  open: number;
  mitigated: number;
  overdue: number;
};

export default function BackofficeOverviewPage(): JSX.Element {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [crawlers, setCrawlers] = useState<CrawlerStatus[]>([]);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/admin/backoffice/overview", {
          headers: { "x-user-role": "admin" },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Overview request failed (${response.status})`);
        }
        const payload = (await response.json()) as {
          metrics: HealthMetric[];
          crawlers: CrawlerStatus[];
          riskSummary: RiskSummary;
        };
        if (!active) return;
        setMetrics(payload.metrics ?? []);
        setCrawlers(payload.crawlers ?? []);
        setRiskSummary(payload.riskSummary ?? null);
      } catch (err) {
        console.error(err);
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(() => metrics.slice(0, 6), [metrics]);

  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title="Backoffice overview"
          subheader="Operational dashboard for administrators."
          action={
            <Button component={Link} href="/admin/backoffice/risk-management" variant="contained" color="primary">
              Manage risk
            </Button>
          }
        />
      </Card>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={2}>
        {cards.map((metric) => (
          <Grid item key={metric.id} xs={12} sm={6} lg={4}>
            <MetricCard metric={metric} />
          </Grid>
        ))}
        {cards.length === 0 ? (
          <Grid item xs={12}>
            <Alert severity="info">No metrics available.</Alert>
          </Grid>
        ) : null}
      </Grid>

      <Card>
        <CardHeader title="Risk posture" />
        <CardContent>
          {riskSummary ? (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Total tracked
                </Typography>
                <Typography variant="h6">{riskSummary.total}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Open
                </Typography>
                <Typography variant="h6">{riskSummary.open}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Mitigated
                </Typography>
                <Typography variant="h6">{riskSummary.mitigated}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Overdue
                </Typography>
                <Typography variant="h6">{riskSummary.overdue}</Typography>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Loading risk summary…
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Crawler status" />
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Source</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Records</TableCell>
                  <TableCell>Last run</TableCell>
                  <TableCell>Next run</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {crawlers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No crawler records yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  crawlers.map((crawler) => <CrawlerRow key={crawler.id} crawler={crawler} />)
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  );
}
