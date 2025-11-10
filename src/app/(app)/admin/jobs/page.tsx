"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RefreshCw, Play, Activity, AlertCircle, CheckCircle2, Clock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type JobStatus = "success" | "warning" | "error" | "unknown";

type JobDefinition = {
  id: string;
  name: string;
  endpoint: string;
  schedule: string;
  description: string;
  category: string;
  status: JobStatus;
  lastRunTime: string | null;
  lastRunDuration: number | null;
  lastRunStatus: string | null;
  lastRunMetadata: Record<string, unknown> | null;
};

type JobResponse = {
  jobs: JobDefinition[];
  timestamp: string;
};

const statusVariantMap: Record<JobStatus, BadgeProps["variant"]> = {
  success: "success",
  warning: "warning",
  error: "destructive",
  unknown: "secondary",
};

const statusIconMap: Record<JobStatus, JSX.Element> = {
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <Clock className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  unknown: <Activity className="h-4 w-4" />,
};

const CATEGORY_FILTER_OPTIONS = [
  { label: "All Categories", value: "all" },
  { label: "Data Collection", value: "Data Collection" },
  { label: "Metrics", value: "Metrics" },
  { label: "Analytics", value: "Analytics" },
  { label: "AI", value: "AI" },
  { label: "AI Corpus", value: "AI Corpus" },
] as const;

export default function AdminJobsPage(): JSX.Element {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobDefinition | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/jobs/status");

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "Failed to load job statuses");
      }

      const data = (await response.json()) as JobResponse;
      setJobs(data.jobs);
    } catch (error) {
      console.error("Failed to load job statuses", error);
      toast({
        title: "Failed to load job statuses",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleRefresh = () => {
    void loadJobs();
  };

  const handleTriggerJob = async (job: JobDefinition) => {
    setTriggering(job.id);
    try {
      const response = await fetch("/api/admin/jobs/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: job.endpoint,
          parameters: {},
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to trigger job");
      }

      toast({
        title: "Job triggered successfully",
        description: `${job.name} has been started. Refresh to see updated status.`,
      });

      // Refresh job statuses after a short delay
      setTimeout(() => {
        void loadJobs();
      }, 2000);
    } catch (error) {
      console.error("Failed to trigger job", error);
      toast({
        title: "Failed to trigger job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTriggering(null);
    }
  };

  const openDetails = (job: JobDefinition) => {
    setSelectedJob(job);
    setDetailsOpen(true);
  };

  const closeDetails = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
      setSelectedJob(null);
    }
  };

  const filteredJobs = categoryFilter === "all"
    ? jobs
    : jobs.filter(job => job.category === categoryFilter);

  // Group jobs by category
  const jobsByCategory = filteredJobs.reduce((acc, job) => {
    if (!acc[job.category]) {
      acc[job.category] = [];
    }
    acc[job.category].push(job);
    return acc;
  }, {} as Record<string, JobDefinition[]>);

  // Count by status
  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<JobStatus, number>);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-secondary p-2 text-secondary-foreground">
              <Activity className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold">Background Jobs Control Panel</CardTitle>
              <CardDescription className="text-base">
                Monitor and manually trigger background automation jobs for LexyHub.
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Jobs</CardDescription>
                <CardTitle className="text-4xl">{jobs.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Healthy
                </CardDescription>
                <CardTitle className="text-4xl text-green-500">{statusCounts.success || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  Warning
                </CardDescription>
                <CardTitle className="text-4xl text-yellow-500">{statusCounts.warning || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Failed
                </CardDescription>
                <CardTitle className="text-4xl text-red-500">{statusCounts.error || 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Filter by category:</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              <p className="font-medium">No jobs found for the selected category.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(jobsByCategory).map(([category, categoryJobs]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-lg font-semibold">{category}</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Job Name</TableHead>
                          <TableHead className="min-w-[120px]">Status</TableHead>
                          <TableHead className="min-w-[150px]">Schedule</TableHead>
                          <TableHead className="min-w-[180px]">Last Run</TableHead>
                          <TableHead className="min-w-[140px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryJobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="align-top">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{job.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {job.description}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge
                                variant={statusVariantMap[job.status]}
                                className="flex w-fit items-center gap-1 capitalize"
                              >
                                {statusIconMap[job.status]}
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top">
                              <p className="text-sm text-muted-foreground">{job.schedule}</p>
                            </TableCell>
                            <TableCell className="align-top text-sm text-muted-foreground">
                              {job.lastRunTime ? (
                                <div className="space-y-1">
                                  <div>{formatDistanceToNow(new Date(job.lastRunTime), { addSuffix: true })}</div>
                                  {job.lastRunDuration && (
                                    <div className="text-xs">Duration: {(job.lastRunDuration / 1000).toFixed(1)}s</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Never run</span>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleTriggerJob(job)}
                                  disabled={triggering === job.id}
                                >
                                  {triggering === job.id ? (
                                    <>
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      Running...
                                    </>
                                  ) : (
                                    <>
                                      <Play className="mr-1 h-3 w-3" />
                                      Run
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openDetails(job)}
                                >
                                  Details
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={closeDetails}>
        <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-[700px]">
          {selectedJob && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <DialogHeader className="space-y-2">
                <DialogTitle>{selectedJob.name}</DialogTitle>
                <DialogDescription>{selectedJob.description}</DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariantMap[selectedJob.status]} className="flex items-center gap-1">
                    {statusIconMap[selectedJob.status]}
                    Status: {selectedJob.status}
                  </Badge>
                  <Badge variant="outline">{selectedJob.category}</Badge>
                </div>

                <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-muted-foreground">Endpoint</p>
                    <p className="font-mono text-xs">{selectedJob.endpoint}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-muted-foreground">Schedule</p>
                    <p>{selectedJob.schedule}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-muted-foreground">Last Run</p>
                    <p>
                      {selectedJob.lastRunTime
                        ? formatDistanceToNow(new Date(selectedJob.lastRunTime), { addSuffix: true })
                        : "Never"}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-muted-foreground">Last Run Status</p>
                    <p className="capitalize">{selectedJob.lastRunStatus || "N/A"}</p>
                  </div>
                  {selectedJob.lastRunDuration && (
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-muted-foreground">Last Run Duration</p>
                      <p>{(selectedJob.lastRunDuration / 1000).toFixed(2)}s</p>
                    </div>
                  )}
                </div>

                {selectedJob.lastRunMetadata && (
                  <div className="space-y-2 rounded-lg border p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Last Run Metadata
                    </h3>
                    <pre className="overflow-auto rounded bg-secondary p-3 text-xs">
                      {JSON.stringify(selectedJob.lastRunMetadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
