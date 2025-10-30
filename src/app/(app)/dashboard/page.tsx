"use client";

import { useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

type Metric = {
  area: string;
  status: "configured" | "pending";
  owner: string;
  notes: string;
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
            <span style={{ color, fontWeight: 600, textTransform: "capitalize" }}>
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

  return (
    <div>
      <div className="metrics-grid">
        <div className="metric-card">
          <span>Supabase</span>
          <strong>pgvector enabled</strong>
        </div>
        <div className="metric-card">
          <span>CI Coverage</span>
          <strong>Build · Test · Lint</strong>
        </div>
        <div className="metric-card">
          <span>Environments</span>
          <strong>.env templates</strong>
        </div>
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
