"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Settings2, ExternalLink, Database, CheckCircle2, Clock } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
  const Icon = status === "configured" ? CheckCircle2 : Clock;
  return (
    <Badge variant={status === "configured" ? "default" : "secondary"} className="gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export default function SettingsPage(): JSX.Element {
  const { toast } = useToast();
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
        toast({
          title: "Metrics unavailable",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
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
  }, [toast]);

  const configuredCount = metrics.filter((metric) => metric.status === "configured").length;
  const pendingCount = metrics.filter((metric) => metric.status === "pending").length;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Settings2 className="h-6 w-6 text-muted-foreground" />
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold">Environment settings</CardTitle>
              <CardDescription className="text-base">
                Manage provider credentials, integration secrets, and readiness tasks for your production workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supabase-url">Supabase URL</Label>
              <Input
                id="supabase-url"
                type="url"
                placeholder="https://project.supabase.co"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabase-key">Supabase service role key</Label>
              <Input
                id="supabase-key"
                type="password"
                placeholder="••••••••••"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Analytics webhook URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://hooks.lexyhub.ai/ingest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-email">Alert email</Label>
              <Input
                id="alert-email"
                type="email"
                placeholder="ops@lexyhub.ai"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>Save changes</Button>
            <Button variant="outline">Reset credentials</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Docs quick links</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>
              <a
                href="https://github.com/lexyhub/lexyhub/blob/main/docs/implementation-roadmap.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                Implementation roadmap
                <ExternalLink className="h-4 w-4" />
              </a>
            </li>
            <li>
              <a
                href="https://supabase.com/docs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                Supabase docs
                <ExternalLink className="h-4 w-4" />
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Connect your data sources</CardTitle>
            </div>
            <div className="text-sm text-muted-foreground">
              {configuredCount} configured · {pendingCount} pending
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Marketplace ingestion</span>
              <span className="text-sm font-medium">{configuredCount ? "Active" : "Connect"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Commerce feeds</span>
              <span className="text-sm font-medium">{pendingCount ? "Pending" : "Configured"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Watchlist sync</span>
              <span className="text-sm font-medium">Always-on</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Connect marketplaces, catalog feeds, and partner APIs to unlock trend scoring and watchlist automation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operations status</CardTitle>
          <CardDescription>Status across watchlists, connectors, and alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b bg-muted/50">
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-4 py-3 text-left text-sm font-medium">
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
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {!metrics.length && !metricsLoading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Connect your data sources to start seeing live metrics here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
