import { generateStatusReport, type StatusLevel } from "@/lib/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<StatusLevel, string> = {
  operational: "Operational",
  warning: "Warning",
  critical: "Critical",
};

const STATUS_ICONS: Record<StatusLevel, React.ReactNode> = {
  operational: <CheckCircle2 className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  critical: <XCircle className="h-4 w-4" />,
};

const STATUS_VARIANTS: Record<StatusLevel, "default" | "secondary" | "destructive" | "outline"> = {
  operational: "default",
  warning: "secondary",
  critical: "destructive",
};

function StatusBadge({ status }: { status: StatusLevel }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className="gap-1.5">
      {STATUS_ICONS[status]}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function getOverallStatus(report: Awaited<ReturnType<typeof generateStatusReport>>): StatusLevel {
  const priority: Record<StatusLevel, number> = {
    operational: 0,
    warning: 1,
    critical: 2,
  };

  const checks = [...report.apis, ...report.services, ...report.workers];

  return checks.reduce<StatusLevel>((current, { status }) => {
    return priority[status] > priority[current] ? status : current;
  }, "operational");
}

function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!hours && !minutes) parts.push(`${remaining}s`);

  return parts.join(" ");
}

export default async function StatusPage() {
  const status = await generateStatusReport();
  const overallStatus = getOverallStatus(status);
  const generatedAt = new Date(status.generatedAt);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Activity className="h-6 w-6 text-muted-foreground" />
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold">Platform Health</CardTitle>
                <CardDescription className="text-base">
                  A compact snapshot of runtime diagnostics, first-party APIs, and service integrations monitored from the server.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Overall Status</span>
              <div>
                <StatusBadge status={overallStatus} />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Last Updated</span>
              <div className="text-sm font-medium">
                <time dateTime={status.generatedAt}>{generatedAt.toLocaleString()}</time>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Environment</span>
              <div className="text-sm font-medium">{status.environment}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runtime Snapshot</CardTitle>
          <CardDescription>Key diagnostics from the current deployment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-md border p-4 space-y-2">
              <span className="text-sm text-muted-foreground">Node.js</span>
              <div className="text-lg font-semibold">{status.runtime.node}</div>
            </div>
            <div className="rounded-md border p-4 space-y-2">
              <span className="text-sm text-muted-foreground">Platform</span>
              <div className="text-lg font-semibold">
                {status.runtime.platform} {status.runtime.release}
              </div>
            </div>
            <div className="rounded-md border p-4 space-y-2">
              <span className="text-sm text-muted-foreground">Process Uptime</span>
              <div className="text-lg font-semibold">{formatSeconds(status.runtime.uptimeSeconds)}</div>
            </div>
            {status.runtime.region && (
              <div className="rounded-md border p-4 space-y-2">
                <span className="text-sm text-muted-foreground">Region</span>
                <div className="text-lg font-semibold">{status.runtime.region}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Surface</CardTitle>
          <CardDescription>Availability of the shipped API handlers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {status.apis.map((api) => (
              <div key={api.id} className="rounded-md border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{api.name}</h3>
                  <StatusBadge status={api.status} />
                </div>
                <p className="text-sm text-muted-foreground">{api.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Integrations</CardTitle>
          <CardDescription>External dependencies monitored from the server</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {status.services.map((service) => (
              <div key={service.id} className="rounded-md border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{service.name}</h3>
                  <StatusBadge status={service.status} />
                </div>
                <p className="text-sm text-muted-foreground">{service.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Background Workers</CardTitle>
          <CardDescription>Automation endpoints that populate live intelligence data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {status.workers.map((worker) => (
              <div key={worker.id} className="rounded-md border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{worker.name}</h3>
                  <StatusBadge status={worker.status} />
                </div>
                <p className="text-sm text-muted-foreground">{worker.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
