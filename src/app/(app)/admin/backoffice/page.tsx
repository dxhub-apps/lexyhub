"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { CrawlerStatus, HealthMetric } from "@/lib/backoffice/status";

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

function MetricCard({ metric }: { metric: HealthMetric }) {
  const statusColor =
    metric.status === "ok"
      ? "var(--color-kpi-positive)"
      : metric.status === "warning"
        ? "var(--color-kpi-caution)"
        : "var(--color-kpi-critical)";
  return (
    <article className="metric-card">
      <header>
        <span className="metric-category">{metric.category}</span>
        <span className="metric-status" style={{ color: statusColor }}>
          {metric.status.toUpperCase()}
        </span>
      </header>
      <h3>{metric.metric_label}</h3>
      <p className="metric-value">
        {metric.metric_value ?? "—"}
        {metric.metric_unit === "percent" ? "%" : null}
      </p>
      {metric.delta !== null && metric.delta !== undefined ? (
        <p className={`metric-delta ${metric.delta >= 0 ? "positive" : "negative"}`}>
          {metric.delta >= 0 ? "▲" : "▼"} {Math.abs(metric.delta)}
          {metric.metric_unit === "percent" ? "%" : ""}
        </p>
      ) : null}
      <footer>
        <small>Captured {new Date(metric.captured_at).toLocaleString()}</small>
      </footer>
    </article>
  );
}

function CrawlerRow({ crawler }: { crawler: CrawlerStatus }) {
  return (
    <tr>
      <td>{crawler.source}</td>
      <td>{crawler.status}</td>
      <td>{crawler.total_records ?? "—"}</td>
      <td>{crawler.last_run_at ? new Date(crawler.last_run_at).toLocaleString() : "—"}</td>
      <td>{crawler.next_run_at ? new Date(crawler.next_run_at).toLocaleString() : "—"}</td>
      <td>{crawler.error_message ?? "—"}</td>
    </tr>
  );
}

type RiskSummary = {
  total: number;
  open: number;
  mitigated: number;
  overdue: number;
  heatMap: RiskHeatMap | null;
};

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

  return (
    <div className="risk-heatmap">
      <table>
        <thead>
          <tr>
            <th>Severity \ Likelihood</th>
            {heatMap.likelihoodLevels.map((likelihood) => (
              <th key={likelihood}>{formatLabel(likelihood)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatMap.severityLevels.map((severity) => (
            <tr key={severity}>
              <th>{formatLabel(severity)}</th>
              {heatMap.likelihoodLevels.map((likelihood) => {
                const key = `${severity}::${likelihood}`;
                const cell = cellLookup.get(key);
                const hasRisk = Boolean(cell && cell.count > 0);
                const tooltip = cell && cell.titles.length > 0 ? cell.titles.join(", ") : "No open risks";
                return (
                  <td key={key}>
                    <div
                      className={`heatmap-cell severity-${severity}${hasRisk ? " has-risk" : ""}`}
                      title={tooltip}
                    >
                      <span className="heatmap-count">{cell?.count ?? 0}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
    <div className="backoffice-overview">
      <section className="surface-card backoffice-header">
        <div>
          <h1>Backoffice overview</h1>
          <p className="subtitle">Operational dashboard for administrators.</p>
        </div>
        <div className="backoffice-header-actions">
          <Link className="primary-link" href="/admin/backoffice/risk-management">
            Manage risk
          </Link>
          <Link className="secondary-link" href="/admin/backoffice/tasks">
            Plan tasks
          </Link>
          <Link className="secondary-link" href="/admin/feature-flags">
            Feature flags
          </Link>
        </div>
      </section>
      {error ? (
        <article className="surface-card backoffice-card">
          <p className="error">{error}</p>
        </article>
      ) : null}
      <section className="metric-grid">
        {cards.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
        {cards.length === 0 ? <p>No metrics available.</p> : null}
      </section>
      <section className="risk-summary">
        <h2>Risk posture</h2>
        {riskSummary ? (
          <>
            <ul>
              <li>
                <strong>Total tracked:</strong> {riskSummary.total}
              </li>
              <li>
                <strong>Open:</strong> {riskSummary.open}
              </li>
              <li>
                <strong>Mitigated:</strong> {riskSummary.mitigated}
              </li>
              <li>
                <strong>Overdue:</strong> {riskSummary.overdue}
              </li>
            </ul>
            {riskSummary.heatMap ? <RiskHeatMapGrid heatMap={riskSummary.heatMap} /> : null}
          </>
        ) : (
          <p>Loading risk summary…</p>
        )}
      </section>
      <section>
        <h2>Crawler status</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Status</th>
                <th>Records</th>
                <th>Last run</th>
                <th>Next run</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {crawlers.length === 0 ? (
                <tr>
                  <td colSpan={6}>No crawler records yet.</td>
                </tr>
              ) : (
                crawlers.map((crawler) => <CrawlerRow key={crawler.id} crawler={crawler} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
