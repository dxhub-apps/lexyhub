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

type UsageKpiTone = "positive" | "caution" | "critical";

type UsageKpi = {
  id: string;
  label: string;
  value: string;
  helper?: string;
  progress?: {
    percent: number;
    caption: string;
    tone: UsageKpiTone;
  };
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

  const formatNumber = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 0,
      }),
    [],
  );

  const formatPercent = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "percent",
        maximumFractionDigits: 0,
      }),
    [],
  );

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

  const usageCards = useMemo<UsageKpi[]>(() => {
    if (!usage) {
      return [
        { id: "plan", label: "Plan overview", value: "Loading…" },
        { id: "queries", label: "Daily keyword queries", value: "—" },
        { id: "ai", label: "AI suggestions", value: "—" },
        { id: "watchlist", label: "Watchlist additions", value: "—" },
      ];
    }

    const aiConsumed = usage.usage?.ai_suggestion ?? 0;
    const aiLimit = usage.limits.aiSuggestionLimit;
    const aiPercent = aiLimit > 0 ? Math.min(aiConsumed / aiLimit, 1) : 0;
    const aiRemaining = Math.max(aiLimit - aiConsumed, 0);

    const keywordQueries = usage.usage?.keyword_query ?? 0;
    const queryLimit = usage.limits.dailyQueryLimit;
    const queryPercent = queryLimit > 0 ? Math.min(keywordQueries / queryLimit, 1) : 0;
    const queryRemaining = Math.max(queryLimit - keywordQueries, 0);

    const watchlistAdds = usage.usage?.watchlist_add ?? 0;
    const watchlistLimit = usage.limits.watchlistItemCapacity;
    const watchlistPercent = watchlistLimit > 0 ? Math.min(watchlistAdds / watchlistLimit, 1) : 0;
    const watchlistRemaining = Math.max(watchlistLimit - watchlistAdds, 0);

    const resolveTone = (percent: number): UsageKpiTone => {
      if (percent <= 0.6) {
        return "positive";
      }
      if (percent <= 0.85) {
        return "caution";
      }
      return "critical";
    };

    const formatCaption = (remaining: number, unit: string): string => {
      if (remaining <= 0) {
        return `Limit reached for ${unit}`;
      }
      return `${formatNumber.format(remaining)} ${unit} remaining`;
    };

    return [
      {
        id: "plan",
        label: "Plan overview",
        value: `${usage.plan} · ${usage.momentum}`,
        helper: "Momentum adjusts how quickly your allowances replenish.",
      },
      {
        id: "queries",
        label: "Daily keyword queries",
        value: `${formatNumber.format(keywordQueries)} of ${formatNumber.format(queryLimit)}`,
        helper: `${formatPercent.format(queryPercent)} of today's allowance used`,
        progress: {
          percent: Math.round(queryPercent * 100),
          caption: formatCaption(queryRemaining, "queries"),
          tone: resolveTone(queryPercent),
        },
      },
      {
        id: "ai",
        label: "AI suggestions",
        value: `${formatNumber.format(aiConsumed)} of ${formatNumber.format(aiLimit)}`,
        helper: `${formatPercent.format(aiPercent)} of today's allowance used`,
        progress: {
          percent: Math.round(aiPercent * 100),
          caption: formatCaption(aiRemaining, "suggestions"),
          tone: resolveTone(aiPercent),
        },
      },
      {
        id: "watchlist",
        label: "Watchlist additions",
        value: `${formatNumber.format(watchlistAdds)} of ${formatNumber.format(watchlistLimit)}`,
        helper: `${formatPercent.format(watchlistPercent)} of today's allowance used`,
        progress: {
          percent: Math.round(watchlistPercent * 100),
          caption: formatCaption(watchlistRemaining, "spots"),
          tone: resolveTone(watchlistPercent),
        },
      },
    ];
  }, [formatNumber, formatPercent, usage]);

  return (
    <div>
      <div className="metrics-grid">
        {usageCards.map((card) => (
          <div key={card.id} className="metric-card">
            <span className="metric-card__label">{card.label}</span>
            <strong className="metric-card__value">{card.value}</strong>
            {card.helper ? <p className="metric-card__helper">{card.helper}</p> : null}
            {card.progress ? (
              <>
                <div className={`metric-card__progress metric-card__progress--${card.progress.tone}`}>
                  <div style={{ width: `${card.progress.percent}%` }} />
                </div>
                <span className="metric-card__caption">{card.progress.caption}</span>
              </>
            ) : null}
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
                Connect your data sources to start seeing live metrics here.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
