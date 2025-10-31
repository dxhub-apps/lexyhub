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

type StatusBadgeProps = {
  status: Metric["status"];
};

function StatusBadge({ status }: StatusBadgeProps) {
  const label = status === "configured" ? "Configured" : "Pending";
  return <span className={`status-badge status-badge--${status}`}>{label}</span>;
}

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
        { id: "queries", label: "Daily keyword queries", value: "—", helper: "Waiting for data" },
        { id: "ai", label: "AI suggestions", value: "—", helper: "Waiting for data" },
        { id: "watchlist", label: "Watchlist additions", value: "—", helper: "Waiting for data" },
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

  const planCard = usageCards.find((card) => card.id === "plan");
  const queryCard = usageCards.find((card) => card.id === "queries");
  const aiCard = usageCards.find((card) => card.id === "ai");
  const watchlistCard = usageCards.find((card) => card.id === "watchlist");

  const kpiCards = [planCard, queryCard, aiCard, watchlistCard].filter(
    (card): card is UsageKpi => Boolean(card),
  );

  const configuredCount = metrics.filter((metric) => metric.status === "configured").length;
  const pendingCount = metrics.filter((metric) => metric.status === "pending").length;

  return (
    <div className="dashboard-page">
      <section className="dashboard-card dashboard-hero">
        <div>
          <h1>LexyHub Control Center</h1>
          <p>Momentum-aware quotas and watchlists to keep your operators in sync.</p>
        </div>
        <div className="dashboard-hero-meta">
          <span>Plan · {planCard?.value ?? "Calculating"}</span>
          <span>
            Daily query limit · {usage ? formatNumber.format(usage.limits.dailyQueryLimit) : "—"}
          </span>
          <span>Momentum · {usage?.momentum ?? "Pending sync"}</span>
          <span>Workspace · Core Market</span>
        </div>
      </section>

      <section className="dashboard-kpi-grid">
        {kpiCards.map((card) => {
          const toneClass = card.progress ? ` dashboard-kpi-indicator-${card.progress.tone}` : "";
          return (
            <article key={card.id} className="dashboard-kpi">
              <div className="dashboard-kpi-header">
                <span>{card.label}</span>
                {card.progress ? (
                  <span className={`dashboard-kpi-indicator${toneClass}`}>
                    <span className="dashboard-kpi-indicator-dot" aria-hidden="true" />
                    {card.progress.caption}
                  </span>
                ) : null}
              </div>
              <strong className="dashboard-kpi-value">{card.value}</strong>
              {card.helper ? <p className="dashboard-kpi-helper">{card.helper}</p> : null}
              {card.progress ? (
                <div className="dashboard-kpi-progress" aria-hidden="true">
                  <span style={{ width: `${card.progress.percent}%` }} />
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="dashboard-analytics-grid">
        <article className="dashboard-card">
          <div className="dashboard-section-header">
            <h2>Keyword momentum</h2>
            <div className="dashboard-analytics-legend">
              <span>Today</span>
              <span>·</span>
              <span>Top movers</span>
            </div>
          </div>
          <div className="dashboard-chart-placeholder">Live chart connects once data is provisioned.</div>
          <p className="dashboard-kpi-helper">
            Track volume acceleration and AI opportunity picks to prioritise daily outreach.
          </p>
        </article>
        <article className="dashboard-card">
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
        </article>
      </section>

      <div className="dashboard-operations-grid">
        <section className="dashboard-card dashboard-table">
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
        <aside className="dashboard-card dashboard-sidecard">
          <h2>Next best actions</h2>
          <p>Keep the pipeline moving with the highest leverage tasks for today.</p>
          <div className="dashboard-sidecard-actions">
            <button type="button" className="primary-action">
              Add new keyword set
            </button>
            <button type="button" className="secondary-action">
              Connect marketplace source
            </button>
            <button type="button" className="secondary-action">
              Review AI opportunities
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
