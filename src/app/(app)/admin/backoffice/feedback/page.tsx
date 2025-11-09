"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Filter,
  Loader2,
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  Star,
  MoreHorizontal,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type Feedback = {
  id: string;
  user_id: string;
  user_email: string;
  user_plan: string;
  type: "bug" | "idea" | "question" | "other" | "rating";
  title?: string;
  message?: string;
  rating?: number;
  page_url?: string;
  app_section?: string;
  status: "new" | "in_review" | "planned" | "done" | "rejected";
  impact?: "low" | "medium" | "high";
  priority?: "low" | "medium" | "high" | "urgent";
  metadata: Record<string, any>;
  screenshot_url?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  resolved_by?: string;
  internal_note?: string;
};

const typeConfig = {
  bug: { label: "Bug", icon: Bug, color: "bg-red-500" },
  idea: { label: "Idea", icon: Lightbulb, color: "bg-purple-500" },
  question: { label: "Question", icon: HelpCircle, color: "bg-blue-500" },
  other: { label: "Other", icon: MessageSquare, color: "bg-gray-500" },
  rating: { label: "Rating", icon: Star, color: "bg-yellow-500" },
};

const statusConfig = {
  new: { label: "New", color: "bg-blue-500" },
  in_review: { label: "In Review", color: "bg-yellow-500" },
  planned: { label: "Planned", color: "bg-purple-500" },
  done: { label: "Done", color: "bg-green-500" },
  rejected: { label: "Rejected", color: "bg-gray-500" },
};

const impactConfig = {
  low: { label: "Low", color: "text-gray-600" },
  medium: { label: "Medium", color: "text-yellow-600" },
  high: { label: "High", color: "text-red-600" },
};

const priorityConfig = {
  low: { label: "Low", color: "text-gray-600" },
  medium: { label: "Medium", color: "text-yellow-600" },
  high: { label: "High", color: "text-orange-600" },
  urgent: { label: "Urgent", color: "text-red-600" },
};

export default function FeedbackBackofficePage() {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [impactFilter, setImpactFilter] = useState<string>("all");
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (planFilter !== "all") params.set("plan", planFilter);
      if (impactFilter !== "all") params.set("impact", impactFilter);
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(
        `/api/admin/backoffice/feedback?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setFeedback(data.feedback || []);
      } else {
        throw new Error("Failed to fetch feedback");
      }
    } catch (error) {
      console.error("Failed to fetch feedback:", error);
      toast({
        title: "Error",
        description: "Failed to load feedback",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter, planFilter, impactFilter, searchQuery, toast]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleUpdateStatus = async (
    id: string,
    status: Feedback["status"]
  ) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/backoffice/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error("Update failed");

      toast({
        title: "Success",
        description: "Feedback status updated",
      });

      await fetchFeedback();

      // Update selected feedback if it's the same one
      if (selectedFeedback?.id === id) {
        const data = await response.json();
        setSelectedFeedback(data.feedback);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePriority = async (
    id: string,
    priority: Feedback["priority"]
  ) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/backoffice/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });

      if (!response.ok) throw new Error("Update failed");

      toast({
        title: "Success",
        description: "Priority updated",
      });

      await fetchFeedback();

      if (selectedFeedback?.id === id) {
        const data = await response.json();
        setSelectedFeedback(data.feedback);
      }
    } catch (error) {
      console.error("Failed to update priority:", error);
      toast({
        title: "Error",
        description: "Failed to update priority",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveInternalNote = async (id: string, note: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/backoffice/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internal_note: note }),
      });

      if (!response.ok) throw new Error("Update failed");

      toast({
        title: "Success",
        description: "Internal note saved",
      });

      await fetchFeedback();

      if (selectedFeedback?.id === id) {
        const data = await response.json();
        setSelectedFeedback(data.feedback);
      }
    } catch (error) {
      console.error("Failed to save note:", error);
      toast({
        title: "Error",
        description: "Failed to save note",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this feedback?")) return;

    try {
      const response = await fetch(`/api/admin/backoffice/feedback/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Delete failed");

      toast({
        title: "Success",
        description: "Feedback deleted",
      });

      setFeedback((prev) => prev.filter((f) => f.id !== id));
      if (selectedFeedback?.id === id) {
        setSelectedFeedback(null);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({
        title: "Error",
        description: "Failed to delete feedback",
        variant: "destructive",
      });
    }
  };

  function formatDate(dateString?: string) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground">
          Manage user feedback, bug reports, and feature requests
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search feedback..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Impact</Label>
              <Select value={impactFilter} onValueChange={setImpactFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Impact</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Title/Message</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Impact</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : feedback.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <p className="text-muted-foreground">No feedback found</p>
                </TableCell>
              </TableRow>
            ) : (
              feedback.map((item) => {
                const TypeIcon = typeConfig[item.type].icon;
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedFeedback(item)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4" />
                        <span className="text-sm">
                          {typeConfig[item.type].label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="truncate">
                        {item.title || item.message || "No content"}
                      </div>
                      {item.rating && (
                        <div className="flex gap-1 mt-1">
                          {Array.from({ length: item.rating }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-3 w-3 fill-yellow-500 text-yellow-500"
                            />
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.user_email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {item.user_plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-white",
                          statusConfig[item.status].color
                        )}
                      >
                        {statusConfig[item.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.impact ? (
                        <span
                          className={cn(
                            "text-sm font-medium",
                            impactConfig[item.impact].color
                          )}
                        >
                          {impactConfig[item.impact].label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.priority ? (
                        <span
                          className={cn(
                            "text-sm font-medium",
                            priorityConfig[item.priority].color
                          )}
                        >
                          {priorityConfig[item.priority].label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFeedback(item);
                            }}
                          >
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detail Sheet */}
      <Sheet
        open={!!selectedFeedback}
        onOpenChange={(open) => !open && setSelectedFeedback(null)}
      >
        <SheetContent className="sm:max-w-[600px] overflow-y-auto">
          {selectedFeedback && (
            <>
              <SheetHeader>
                <SheetTitle>Feedback Details</SheetTitle>
                <SheetDescription>
                  View and manage feedback submission
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* Type & Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Type
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const TypeIcon = typeConfig[selectedFeedback.type].icon;
                        return <TypeIcon className="h-4 w-4" />;
                      })()}
                      <span>{typeConfig[selectedFeedback.type].label}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <Select
                      value={selectedFeedback.status}
                      onValueChange={(value) =>
                        handleUpdateStatus(
                          selectedFeedback.id,
                          value as Feedback["status"]
                        )
                      }
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Priority & Impact */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Priority
                    </Label>
                    <Select
                      value={selectedFeedback.priority || "low"}
                      onValueChange={(value) =>
                        handleUpdatePriority(
                          selectedFeedback.id,
                          value as Feedback["priority"]
                        )
                      }
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Impact (User Set)
                    </Label>
                    <div className="mt-1 py-2">
                      {selectedFeedback.impact ? (
                        <span
                          className={cn(
                            "font-medium",
                            impactConfig[selectedFeedback.impact].color
                          )}
                        >
                          {impactConfig[selectedFeedback.impact].label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div>
                  <Label className="text-xs text-muted-foreground">User</Label>
                  <div className="mt-1 space-y-1">
                    <p className="text-sm">{selectedFeedback.user_email}</p>
                    <Badge variant="outline" className="capitalize">
                      {selectedFeedback.user_plan} Plan
                    </Badge>
                  </div>
                </div>

                {/* Title */}
                {selectedFeedback.title && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Title
                    </Label>
                    <p className="mt-1">{selectedFeedback.title}</p>
                  </div>
                )}

                {/* Message */}
                {selectedFeedback.message && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Message
                    </Label>
                    <p className="mt-1 whitespace-pre-wrap">
                      {selectedFeedback.message}
                    </p>
                  </div>
                )}

                {/* Rating */}
                {selectedFeedback.rating && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Rating
                    </Label>
                    <div className="flex gap-1 mt-1">
                      {Array.from({ length: selectedFeedback.rating }).map(
                        (_, i) => (
                          <Star
                            key={i}
                            className="h-5 w-5 fill-yellow-500 text-yellow-500"
                          />
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Page URL */}
                {selectedFeedback.page_url && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Page URL
                    </Label>
                    <div className="mt-1 flex items-center gap-2">
                      <a
                        href={selectedFeedback.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selectedFeedback.page_url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Internal Note */}
                <div>
                  <Label htmlFor="internal-note">Internal Note</Label>
                  <Textarea
                    id="internal-note"
                    defaultValue={selectedFeedback.internal_note || ""}
                    placeholder="Add internal notes (not visible to user)..."
                    rows={4}
                    onBlur={(e) => {
                      const note = e.target.value;
                      if (note !== selectedFeedback.internal_note) {
                        handleSaveInternalNote(selectedFeedback.id, note);
                      }
                    }}
                  />
                </div>

                {/* Timestamps */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Created: {formatDate(selectedFeedback.created_at)}</p>
                  <p>Updated: {formatDate(selectedFeedback.updated_at)}</p>
                  {selectedFeedback.resolved_at && (
                    <p>Resolved: {formatDate(selectedFeedback.resolved_at)}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
