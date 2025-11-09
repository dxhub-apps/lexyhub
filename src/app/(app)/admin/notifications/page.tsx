"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Edit, Trash2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Notification = {
  id: string;
  title: string;
  body: string;
  category: string;
  severity: string;
  status: string;
  kind: string;
  cta_text?: string;
  cta_url?: string;
  created_at: string;
  published_at?: string;
};

type NotificationFormData = {
  title: string;
  body: string;
  category: string;
  severity: string;
  kind: string;
  cta_text?: string;
  cta_url?: string;
};

const EMPTY_FORM: NotificationFormData = {
  title: "",
  body: "",
  category: "system",
  severity: "info",
  kind: "inapp",
  cta_text: "",
  cta_url: "",
};

export default function AdminNotificationsPage(): JSX.Element {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NotificationFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/notifications");
      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }

      const data = (await response.json()) as { notifications: Notification[] };
      setNotifications(data.notifications ?? []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEdit = (notification: Notification) => {
    setEditingId(notification.id);
    setFormData({
      title: notification.title,
      body: notification.body,
      category: notification.category,
      severity: notification.severity,
      kind: notification.kind,
      cta_text: notification.cta_text ?? "",
      cta_url: notification.cta_url ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.body) {
      toast({
        title: "Validation Error",
        description: "Title and body are required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId
        ? `/api/admin/notifications/${editingId}`
        : "/api/admin/notifications";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error ?? "Failed to save notification");
      }

      toast({
        title: "Success",
        description: `Notification ${editingId ? "updated" : "created"} successfully`,
      });

      setDialogOpen(false);
      void loadNotifications();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save notification",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/notifications/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete notification");
      }

      toast({
        title: "Success",
        description: "Notification deleted successfully",
      });

      void loadNotifications();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete notification",
        variant: "destructive",
      });
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/notifications/${id}/publish`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to publish notification");
      }

      toast({
        title: "Success",
        description: "Notification published successfully",
      });

      void loadNotifications();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to publish notification",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "warning";
      case "success":
        return "success";
      default:
        return "secondary";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications Management</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage system notifications for users
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Notification
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No notifications yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card key={notification.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{notification.title}</CardTitle>
                      <Badge variant={getSeverityColor(notification.severity)}>
                        {notification.severity}
                      </Badge>
                      <Badge variant="outline">{notification.category}</Badge>
                      <Badge variant="outline">{notification.kind}</Badge>
                      {notification.status === "live" && (
                        <Badge variant="default">Live</Badge>
                      )}
                      {notification.status === "draft" && (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </div>
                    <CardDescription>{notification.body}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {notification.status === "draft" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handlePublish(notification.id)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Publish
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(notification)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(notification.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Notification" : "Create Notification"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the notification details below"
                : "Fill in the details to create a new notification"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Notification title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Notification message"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="keyword">Keyword</SelectItem>
                    <SelectItem value="watchlist">Watchlist</SelectItem>
                    <SelectItem value="ai">AI</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value) => setFormData({ ...formData, severity: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kind">Type</Label>
                <Select
                  value={formData.kind}
                  onValueChange={(value) => setFormData({ ...formData, kind: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inapp">In-App</SelectItem>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta_text">Call to Action Text (optional)</Label>
              <Input
                id="cta_text"
                value={formData.cta_text}
                onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                placeholder="Learn More"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta_url">Call to Action URL (optional)</Label>
              <Input
                id="cta_url"
                value={formData.cta_url}
                onChange={(e) => setFormData({ ...formData, cta_url: e.target.value })}
                placeholder="/help"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
