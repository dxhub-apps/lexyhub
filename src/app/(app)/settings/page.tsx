"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { useToast } from "@/components/ui/ToastProvider";

type Metric = {
  area: string;
  status: "configured" | "pending";
  owner: string;
  notes: string;
};

type StatusBadgeProps = {
  status: Metric["status"];
};

function StatusBadge({ status }: StatusBadgeProps) {
  const label = status === "configured" ? "Configured" : "Pending";
  return <span className={`status-badge status-badge--${status}`}>{label}</span>;
}

export default function SettingsPage(): JSX.Element {
  const { push } = useToast();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const columns = useMemo<ColumnDef<Metric>[]>(
    () => [
      {
        header: "Area",
        accessorKey: "area",
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ getValue }) => {
          const value = getValue<Metric["status"]>();
          return <StatusBadge status={value} />;
        },
      },
      {
        header: "Owner",
        accessorKey: "owner",
      },
      {
        header: "Notes",
        accessorKey: "notes",
      },
    ],
    [],
  );

  const table = useReactTable({
    data: metrics,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    let active = true;
    setMetricsLoading(true);
    fetch("/api/dashboard/metrics")
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Metric load failed (${response.status})`);
        }
        return response.json();
      })
      .then((payload: { metrics: Metric[] }) => {
        if (active) {
          setMetrics(payload.metrics ?? []);
        }
      })
      .catch((error) => {
        console.error("Failed to load operations metrics", error);
        push({
          title: "Metrics unavailable",
          description: error instanceof Error ? error.message : "Unknown error",
          tone: "error",
        });
      })
      .finally(() => {
        if (active) {
          setMetricsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [push]);

  const configuredCount = metrics.filter((metric) => metric.status === "configured").length;
  const pendingCount = metrics.filter((metric) => metric.status === "pending").length;

  return (
    <div className="settings-page">
      <section className="surface-card form-card">
        <h1>Environment settings</h1>
        <p className="insights-muted">
          Manage provider credentials, integration secrets, and readiness tasks for your production workspace.
        </p>
        <div className="form-grid">
          <label>
            Supabase URL
            <input type="url" placeholder="https://project.supabase.co" autoComplete="off" />
          </label>
          <label>
            Supabase service role key
            <input type="password" placeholder="••••••••••" autoComplete="off" />
          </label>
          <label>
            Analytics webhook URL
            <input type="url" placeholder="https://hooks.lexyhub.ai/ingest" />
          </label>
          <label>
            Alert email
            <input type="email" placeholder="ops@lexyhub.ai" />
          </label>
        </div>
        <div className="form-actions">
          <button type="button">Save changes</button>
          <button type="button">Reset credentials</button>
        </div>
      </section>

      <section className="surface-card form-card">
        <h2>Docs quick links</h2>
        <ul>
          <li>
            <a
              href="https://github.com/lexyhub/lexyhub/blob/main/docs/implementation-roadmap.md"
              target="_blank"
              rel="noreferrer"
            >
              Implementation roadmap
            </a>
          </li>
          <li>
            <a href="https://supabase.com/docs" target="_blank" rel="noreferrer">
              Supabase docs
            </a>
          </li>
        </ul>
      </section>

      <section className="surface-card form-card settings-data-sources">
        <div className="dashboard-section-header">
          <h2>Connect your data sources</h2>
          <span className="dashboard-kpi-helper">{configuredCount} configured · {pendingCount} pending</span>
        </div>
        <div className="dashboard-hero-meta">
          <span>Marketplace ingestion · {configuredCount ? "Active" : "Connect"}</span>
          <span>Commerce feeds · {pendingCount ? "Pending" : "Configured"}</span>
          <span>Watchlist sync · Always-on</span>
        </div>
        <p className="dashboard-kpi-helper">
          Connect marketplaces, catalog feeds, and partner APIs to unlock trend scoring and watchlist automation.
        </p>
      </section>

      <section className="surface-card dashboard-card dashboard-table settings-operations-status">
        <div className="dashboard-section-header">
          <h2>Operations status</h2>
          <span>Status across watchlists, connectors, and alerts</span>
        </div>
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {!metrics.length && !metricsLoading ? (
              <tr>
                <td colSpan={4} className="dashboard-table-empty">
                  Connect your data sources to start seeing live metrics here.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
