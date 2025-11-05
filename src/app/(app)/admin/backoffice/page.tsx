"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Settings, Shield, CheckSquare, Flag, Bell, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

import type { CrawlerStatus, HealthMetric } from "@/lib/backoffice/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RiskHeatMapCell = {
  severity: string;
  likelihood: string;
  count: number;
  riskIds: string[];
  titles: string[];
};

type RiskHeatMap = {
  severityLevels: string[];
  likelihoodLevels: string[];
  cells: RiskHeatMapCell[];
};

type RiskSummary = {
  total: number;
  open: number;
  mitigated: number;
  overdue: number;
  heatMap: RiskHeatMap | null;
};

type MetricStatus = "ok" | "warning" | "error";

function MetricCard({ metric }: { metric: HealthMetric }) {
  const statusColors: Record<MetricStatus, string> = {
    ok: "text-green-600",
    warning: "text-yellow-600",
    error: "text-red-600",
  };

  const statusIcons: Record<MetricStatus, React.ReactNode> = {
    ok: <CheckCircle className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    error: <XCircle className="h-4 w-4" />,
  };

  const normalizedStatus = (["ok", "warning", "error"].includes(metric.status)
    ? metric.status
    : "ok") as MetricStatus;
  const statusColor = statusColors[normalizedStatus];
  const statusIcon = statusIcons[normalizedStatus];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline">{metric.category}</Badge>
          <div className={`flex items-center gap-1 ${statusColor}`}>
            {statusIcon}
            <span className="text-xs font-semibold uppercase">{metric.status}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <h3 className="font-semibold">{metric.metric_label}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {metric.metric_value ?? "—"}
            {metric.metric_unit === "percent" ? "%" : ""}
          </span>
          {metric.delta !== null && metric.delta !== undefined && (
            <Badge variant={metric.delta >= 0 ? "default" : "destructive"} className="text-xs">
              {metric.delta >= 0 ? "▲" : "▼"} {Math.abs(metric.delta)}
              {metric.metric_unit === "percent" ? "%" : ""}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Captured {new Date(metric.captured_at).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function formatLabel(value: string): string {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function RiskHeatMapGrid({ heatMap }: { heatMap: RiskHeatMap }) {
  const cellLookup = useMemo(() => {
    const map = new Map<string, RiskHeatMapCell>();
    for (const cell of heatMap.cells) {
      map.set(`${cell.severity}::${cell.likelihood}`, cell);
    }
    return map;
  }, [heatMap]);

  const severityColors: Record<string, string> = {
    critical: "bg-red-600",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-green-500",
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Severity \ Likelihood</TableHead>
            {heatMap.likelihoodLevels.map((likelihood) => (
              <TableHead key={likelihood}>{formatLabel(likelihood)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {heatMap.severityLevels.map((severity) => (
            <TableRow key={severity}>
              <TableCell className="font-medium">{formatLabel(severity)}</TableCell>
              {heatMap.likelihoodLevels.map((likelihood) => {
                const key = `${severity}::${likelihood}`;
                const cell = cellLookup.get(key);
                const hasRisk = Boolean(cell && cell.count > 0);
                const tooltip = cell && cell.titles.length > 0 ? cell.titles.join(", ") : "No open risks";
                return (
                  <TableCell key={key}>
                    <div
                      className={`flex items-center justify-center h-12 w-12 rounded-md ${
                        hasRisk ? severityColors[severity] || "bg-gray-400" : "bg-gray-100"
                      } ${hasRisk ? "text-white font-bold" : "text-gray-400"}`}
                      title={tooltip}
                    >
                      {cell?.count ?? 0}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

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
          riskSummary?: (RiskSummary & { heatMap?: RiskHeatMap | null }) | null;
        };
        if (!active) return;
        setMetrics(payload.metrics ?? []);
        setCrawlers(payload.crawlers ?? []);
        const summary = payload.riskSummary ?? null;
        setRiskSummary(summary ? { ...summary, heatMap: summary.heatMap ?? null } : null);
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
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Settings className="h-6 w-6 text-muted-foreground" />
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold">Backoffice Overview</CardTitle>
                <CardDescription className="text-base">
                  Operational dashboard for administrators
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="default" asChild>
                <Link href="/admin/backoffice/risk-management">
                  <Shield className="mr-2 h-4 w-4" />
                  Manage Risk
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/backoffice/tasks">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Plan Tasks
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/backoffice/notifications">
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/feature-flags">
                  <Flag className="mr-2 h-4 w-4" />
                  Feature Flags
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">Health Metrics</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
          {cards.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">No metrics available.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk Posture</CardTitle>
        </CardHeader>
        <CardContent>
          {riskSummary ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Tracked</p>
                  <p className="text-2xl font-bold">{riskSummary.total}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold text-orange-600">{riskSummary.open}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Mitigated</p>
                  <p className="text-2xl font-bold text-green-600">{riskSummary.mitigated}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{riskSummary.overdue}</p>
                </div>
              </div>
              {riskSummary.heatMap && <RiskHeatMapGrid heatMap={riskSummary.heatMap} />}
            </div>
          ) : (
            <p className="text-muted-foreground">Loading risk summary…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crawler Status</CardTitle>
          <CardDescription>Data ingestion pipeline health</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crawlers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No crawler records yet.
                  </TableCell>
                </TableRow>
              ) : (
                crawlers.map((crawler) => (
                  <TableRow key={crawler.id}>
                    <TableCell className="font-medium">{crawler.source}</TableCell>
                    <TableCell>
                      <Badge variant={crawler.status === "active" ? "default" : "secondary"}>
                        {crawler.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{crawler.total_records ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {crawler.last_run_at ? new Date(crawler.last_run_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {crawler.next_run_at ? new Date(crawler.next_run_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-red-600">{crawler.error_message ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
