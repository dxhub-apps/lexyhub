"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RefreshCw, MessageCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "New", value: "new" },
  { label: "Open", value: "open" },
  { label: "Acknowledged", value: "acknowledged" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
] as const;

const TYPE_OPTIONS = [
  { label: "All types", value: "all" },
  { label: "Bug report", value: "bug" },
  { label: "Feature idea", value: "idea" },
  { label: "Question", value: "question" },
  { label: "Other", value: "other" },
] as const;

const IMPACT_OPTIONS = [
  { label: "All impact levels", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
] as const;

const PRIORITY_OPTIONS = [
  { label: "All priorities", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
] as const;

type FeedbackItem = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_plan: string | null;
  type: string | null;
  title: string | null;
  message: string | null;
  rating: number | null;
  page_url: string | null;
  app_section: string | null;
  status: string | null;
  impact: string | null;
  priority: string | null;
  metadata: Record<string, unknown> | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  internal_note: string | null;
};

type FeedbackResponse = {
  feedback: FeedbackItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const statusVariantMap: Record<string, BadgeProps["variant"]> = {
  new: "warning",
  open: "warning",
  acknowledged: "secondary",
  in_progress: "warning",
  resolved: "success",
  closed: "secondary",
};

const impactVariantMap: Record<string, BadgeProps["variant"]> = {
  low: "secondary",
  medium: "warning",
  high: "destructive",
};

const priorityVariantMap: Record<string, BadgeProps["variant"]> = {
  low: "secondary",
  medium: "warning",
  high: "destructive",
  urgent: "destructive",
};

export default function AdminFeedbackPage(): JSX.Element {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [pagination, setPagination] = useState<FeedbackResponse["pagination"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("all");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_OPTIONS)[number]["value"]>("all");
  const [impactFilter, setImpactFilter] = useState<(typeof IMPACT_OPTIONS)[number]["value"]>("all");
  const [priorityFilter, setPriorityFilter] = useState<(typeof PRIORITY_OPTIONS)[number]["value"]>("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);

  const hasMore = useMemo(() => {
    if (!pagination) return false;
    return pagination.page < pagination.totalPages;
  }, [pagination]);

  const loadFeedback = useCallback(
    async (pageToLoad = 1, append = false) => {
      const params = new URLSearchParams();
      params.set("limit", "25");
      params.set("page", pageToLoad.toString());

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (typeFilter !== "all") {
        params.set("type", typeFilter);
      }
      if (impactFilter !== "all") {
        params.set("impact", impactFilter);
      }
      if (priorityFilter !== "all") {
        params.set("priority", priorityFilter);
      }

      if (pageToLoad === 1 && !append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await fetch(`/api/admin/backoffice/feedback?${params.toString()}`);

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? "Failed to load feedback");
        }

        const data = (await response.json()) as FeedbackResponse;
        setFeedback((previous) => (append ? [...previous, ...data.feedback] : data.feedback));
        setPagination(data.pagination);
        setCurrentPage(data.pagination.page);
      } catch (error) {
        console.error("Failed to load feedback", error);
        toast({
          title: "Failed to load feedback",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [impactFilter, priorityFilter, statusFilter, toast, typeFilter],
  );

  useEffect(() => {
    setCurrentPage(1);
    void loadFeedback(1, false);
  }, [impactFilter, loadFeedback, priorityFilter, statusFilter, typeFilter]);

  const handleRefresh = () => {
    setCurrentPage(1);
    void loadFeedback(1, false);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    void loadFeedback(currentPage + 1, true);
  };

  const openDetails = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    setDetailsOpen(true);
  };

  const closeDetails = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
      setSelectedFeedback(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-secondary p-2 text-secondary-foreground">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold">User Feedback</CardTitle>
              <CardDescription className="text-base">
                Review feedback submissions, feature ideas, and reported issues from LexyHub users.
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as (typeof STATUS_OPTIONS)[number]["value"])
              }
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as (typeof TYPE_OPTIONS)[number]["value"])
              }
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={impactFilter}
              onValueChange={(value) =>
                setImpactFilter(value as (typeof IMPACT_OPTIONS)[number]["value"])
              }
            >
              <SelectTrigger id="impact">
                <SelectValue placeholder="Filter by impact" />
              </SelectTrigger>
              <SelectContent>
                {IMPACT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter}
              onValueChange={(value) =>
                setPriorityFilter(value as (typeof PRIORITY_OPTIONS)[number]["value"])
              }
            >
              <SelectTrigger id="priority">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => (
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
          ) : feedback.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              <p className="font-medium">No feedback found for the selected filters.</p>
              <p className="text-sm">Try adjusting the filters or check back later for new submissions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Summary</TableHead>
                      <TableHead className="min-w-[120px]">Type</TableHead>
                      <TableHead className="min-w-[120px]">Impact</TableHead>
                      <TableHead className="min-w-[120px]">Priority</TableHead>
                      <TableHead className="min-w-[120px]">Status</TableHead>
                      <TableHead className="min-w-[180px]">Submitted</TableHead>
                      <TableHead className="min-w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedback.map((item) => {
                      const status = item.status ?? "new";
                      const impact = item.impact ?? "medium";
                      const priority = item.priority ?? "medium";

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                {item.title?.trim() || "Untitled feedback"}
                              </p>
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {item.message?.trim() || "No message provided."}
                              </p>
                              <div className="text-xs text-muted-foreground">
                                {item.user_email ? `From ${item.user_email}` : "Anonymous user"}
                                {item.user_plan ? ` · Plan: ${item.user_plan}` : ""}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant="outline" className="capitalize">
                              {item.type ?? "unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant={impactVariantMap[impact] ?? "secondary"} className="capitalize">
                              {impact}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant={priorityVariantMap[priority] ?? "secondary"} className="capitalize">
                              {priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant={statusVariantMap[status] ?? "secondary"} className="capitalize">
                              {status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top text-sm text-muted-foreground">
                            <div>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</div>
                            {item.app_section && <div className="text-xs">{item.app_section}</div>}
                          </TableCell>
                          <TableCell className="align-top">
                            <Button variant="secondary" size="sm" onClick={() => openDetails(item)}>
                              View details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {hasMore && (
                <div className="flex justify-center">
                  <Button onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={closeDetails}>
        <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-[700px]">
          {selectedFeedback && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <DialogHeader className="space-y-2">
                <DialogTitle>{selectedFeedback.title?.trim() || "Untitled feedback"}</DialogTitle>
                <DialogDescription>
                  Submitted {formatDistanceToNow(new Date(selectedFeedback.created_at), { addSuffix: true })}
                  {selectedFeedback.user_email ? ` by ${selectedFeedback.user_email}` : " by an anonymous user"}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    {selectedFeedback.type ?? "unknown"}
                  </Badge>
                  {selectedFeedback.impact && (
                    <Badge variant={impactVariantMap[selectedFeedback.impact] ?? "secondary"} className="capitalize">
                      Impact: {selectedFeedback.impact}
                    </Badge>
                  )}
                  {selectedFeedback.priority && (
                    <Badge variant={priorityVariantMap[selectedFeedback.priority] ?? "secondary"} className="capitalize">
                      Priority: {selectedFeedback.priority}
                    </Badge>
                  )}
                  {selectedFeedback.status && (
                    <Badge variant={statusVariantMap[selectedFeedback.status] ?? "secondary"} className="capitalize">
                      Status: {selectedFeedback.status.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 rounded-lg border p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Message
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {selectedFeedback.message?.trim() || "No message provided."}
                  </p>
                </div>

                <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-muted-foreground">User plan</p>
                    <p>{selectedFeedback.user_plan ?? "Unknown"}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-muted-foreground">App section</p>
                    <p>{selectedFeedback.app_section ?? "Unknown"}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-muted-foreground">Page URL</p>
                    {selectedFeedback.page_url ? (
                      <Link
                        href={selectedFeedback.page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline"
                      >
                        {selectedFeedback.page_url}
                      </Link>
                    ) : (
                      <p>Not provided</p>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-muted-foreground">Last updated</p>
                    <p>
                      {selectedFeedback.updated_at
                        ? formatDistanceToNow(new Date(selectedFeedback.updated_at), { addSuffix: true })
                        : "Not updated"}
                    </p>
                  </div>
                </div>

                {selectedFeedback.metadata && (
                  <div className="space-y-2 rounded-lg border p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Metadata
                    </h3>
                    <pre className="overflow-auto rounded bg-secondary p-3 text-xs">
                      {JSON.stringify(selectedFeedback.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedFeedback.screenshot_url && (
                  <div className="space-y-2 rounded-lg border p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Screenshot
                    </h3>
                    <Link
                      href={selectedFeedback.screenshot_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline"
                    >
                      View attached screenshot
                    </Link>
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
