import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import { generateStatusReport, type StatusLevel } from "@/lib/status";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<StatusLevel, string> = {
  operational: "Operational",
  warning: "Warning",
  critical: "Critical",
};

function StatusBadge({ status }: { status: StatusLevel }) {
  const color: Record<StatusLevel, "success" | "warning" | "error"> = {
    operational: "success",
    warning: "warning",
    critical: "error",
  };
  return <Chip label={STATUS_LABELS[status]} color={color[status]} variant="outlined" size="small" />;
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
    <Stack spacing={3}>
      <Card>
        <CardHeader title="Platform health" subheader="A compact snapshot of runtime diagnostics, first-party APIs, and service integrations monitored from the server." />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                Overall
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <StatusBadge status={overallStatus} />
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                Last updated
              </Typography>
              <Typography variant="body2">{generatedAt.toLocaleString()}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                Environment
              </Typography>
              <Typography variant="body2">{status.environment}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Runtime snapshot" subheader="Key diagnostics from the current deployment." />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary">
                Node.js
              </Typography>
              <Typography variant="h6">{status.runtime.node}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary">
                Platform
              </Typography>
              <Typography variant="h6">
                {status.runtime.platform} {status.runtime.release}
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary">
                Process uptime
              </Typography>
              <Typography variant="h6">{formatSeconds(status.runtime.uptimeSeconds)}</Typography>
            </Grid>
            {status.runtime.region ? (
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Region
                </Typography>
                <Typography variant="h6">{status.runtime.region}</Typography>
              </Grid>
            ) : null}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="API surface" subheader="Availability of the shipped API handlers." />
        <CardContent>
          <Stack spacing={2}>
            {status.apis.map((api) => (
              <Card key={api.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {api.name}
                    </Typography>
                    <StatusBadge status={api.status} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {api.message}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Service integrations" subheader="External dependencies monitored from the server." />
        <CardContent>
          <Stack spacing={2}>
            {status.services.map((service) => (
              <Card key={service.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {service.name}
                    </Typography>
                    <StatusBadge status={service.status} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {service.message}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Background workers" subheader="Automation endpoints that populate live intelligence data." />
        <CardContent>
          <Stack spacing={2}>
            {status.workers.map((worker) => (
              <Card key={worker.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {worker.name}
                    </Typography>
                    <StatusBadge status={worker.status} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {worker.message}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
