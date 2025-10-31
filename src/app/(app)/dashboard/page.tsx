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

type UsageSummary = {
  plan: string;
  momentum: string;
  limits: {
    dailyQueryLimit: number;
    aiSuggestionLimit: number;
    watchlistLimit: number;
    watchlistItemCapacity: number;
  };
  usage: Record<string, number>;
};

export default function DashboardPage(): JSX.Element {
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
          const color = value === "configured" ? "#34d399" : "#f87171";
          return (
            <span
              style={{
                color,
                fontWeight: 600,
                textTransform: "capitalize",
                fontSize: "var(--font-size-small)",
              }}
            >
              {value}
            </span>
          );
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

  const { push } = useToast();
  const [usage, setUsage] = useState<UsageSummary | null>(null);

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
        console.error("Failed to load dashboard metrics", error);
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

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const response = await fetch("/api/usage/summary");
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Usage summary failed (${response.status})`);
        }
        const json = (await response.json()) as UsageSummary;
        if (isMounted) {
          setUsage(json);
        }
      } catch (error) {
        console.error("Failed to load usage summary", error);
        push({
          title: "Usage summary unavailable",
          description: error instanceof Error ? error.message : "Unknown error",
          tone: "warning",
        });
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [push]);

  const usageCards = useMemo(() => {
    if (!usage) {
      return [
        { label: "Plan", value: "Loading…" },
        { label: "AI Suggestions", value: "—" },
        { label: "Watchlist Capacity", value: "—" },
      ];
    }

    const aiConsumed = usage.usage?.ai_suggestion ?? 0;
    const aiRemaining = Math.max(usage.limits.aiSuggestionLimit - aiConsumed, 0);
    const watchlistAdds = usage.usage?.watchlist_add ?? 0;

    return [
      { label: "Plan", value: `${usage.plan} · ${usage.momentum}` },
      {
        label: "AI Suggestions",
        value: `${aiConsumed}/${usage.limits.aiSuggestionLimit} used (≅ ${aiRemaining} left)`,
      },
      {
        label: "Watchlist Adds",
        value: `${watchlistAdds}/${usage.limits.watchlistItemCapacity} today`,
      },
    ];
  }, [usage]);

  return (
    <div>
      <div className="metrics-grid">
        {usageCards.map((card) => (
          <div key={card.label} className="metric-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
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
              <td colSpan={4} style={{ textAlign: "center", padding: "1.5rem" }}>
                Metrics will appear once Supabase data is available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
