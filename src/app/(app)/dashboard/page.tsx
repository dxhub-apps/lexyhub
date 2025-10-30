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

const DATA: Metric[] = [
  {
    area: "Supabase",
    status: "configured",
    owner: "Data",
    notes: "Project scaffolded with pgvector",
  },
  {
    area: "CI/CD",
    status: "configured",
    owner: "Platform",
    notes: "Lint, test, typecheck, build",
  },
  {
    area: "Analytics",
    status: "configured",
    owner: "Product",
    notes: "Vercel Analytics wired",
  },
  {
    area: "Secrets",
    status: "pending",
    owner: "Security",
    notes: "Add service role and OpenAI keys via docs",
  },
];

export default function DashboardPage() {
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
    data: DATA,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { push } = useToast();
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const response = await fetch("/api/usage/summary");
        if (!response.ok) {
          throw new Error(`Usage summary failed (${response.status})`);
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
        </tbody>
      </table>
    </div>
  );
}
