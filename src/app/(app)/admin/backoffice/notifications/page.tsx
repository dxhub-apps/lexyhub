'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  Loader2,
  Play,
  Pause,
  StopCircle,
  Trash2,
  BarChart3,
  Mail,
  Bell,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  title: string;
  kind: 'banner' | 'inapp' | 'email' | 'mixed';
  severity: 'info' | 'success' | 'warning' | 'critical';
  status: 'draft' | 'scheduled' | 'live' | 'paused' | 'ended';
  category: string;
  show_banner: boolean;
  create_inapp: boolean;
  send_email: boolean;
  schedule_start_at?: string;
  schedule_end_at?: string;
  created_at: string;
};

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-500' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-500' },
  live: { label: 'Live', color: 'bg-green-500' },
  paused: { label: 'Paused', color: 'bg-yellow-500' },
  ended: { label: 'Ended', color: 'bg-gray-500' },
};

const severityConfig = {
  info: { label: 'Info', color: 'bg-blue-500' },
  success: { label: 'Success', color: 'bg-green-500' },
  warning: { label: 'Warning', color: 'bg-yellow-500' },
  critical: { label: 'Critical', color: 'bg-red-500' },
};

export default function NotificationsListPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (kindFilter !== 'all') params.set('kind', kindFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (searchQuery) params.set('q', searchQuery);

      const response = await fetch(`/api/admin/backoffice/notifications?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, kindFilter, severityFilter, searchQuery]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function handlePublish(id: string) {
    if (!confirm('Are you sure you want to publish this notification?')) return;

    try {
      const response = await fetch(`/api/admin/backoffice/notifications/${id}/publish`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchNotifications();
      } else {
        alert('Failed to publish notification');
      }
    } catch (error) {
      console.error('Failed to publish:', error);
      alert('Failed to publish notification');
    }
  }

  async function handlePause(id: string) {
    try {
      const response = await fetch(`/api/admin/backoffice/notifications/${id}/pause`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchNotifications();
      } else {
        alert('Failed to pause notification');
      }
    } catch (error) {
      console.error('Failed to pause:', error);
      alert('Failed to pause notification');
    }
  }

  async function handleEnd(id: string) {
    if (!confirm('Are you sure you want to end this notification? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/backoffice/notifications/${id}/end`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchNotifications();
      } else {
        alert('Failed to end notification');
      }
    } catch (error) {
      console.error('Failed to end:', error);
      alert('Failed to end notification');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    try {
      const response = await fetch(`/api/admin/backoffice/notifications/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove the notification from the UI immediately
        setNotifications(prev => prev.filter(n => n.id !== id));
      } else {
        alert('Failed to delete notification');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete notification');
    }
  }

  function formatDate(dateString?: string) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Manage system notifications, banners, and announcements
          </p>
        </div>
        <Button onClick={() => router.push('/admin/backoffice/notifications/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Notification
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>

        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Kinds</SelectItem>
            <SelectItem value="banner">Banner</SelectItem>
            <SelectItem value="inapp">In-App</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium text-muted-foreground">No notifications found</p>
          <p className="text-sm text-muted-foreground">
            Create your first notification to get started
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell className="font-medium">{notification.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {notification.kind}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('capitalize', severityConfig[notification.severity].color)}>
                      {notification.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('capitalize', statusConfig[notification.status].color)}>
                      {notification.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{notification.category}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {notification.show_banner && (
                        <Badge variant="outline" className="text-xs">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Banner
                        </Badge>
                      )}
                      {notification.create_inapp && (
                        <Badge variant="outline" className="text-xs">
                          <Bell className="mr-1 h-3 w-3" />
                          In-App
                        </Badge>
                      )}
                      {notification.send_email && (
                        <Badge variant="outline" className="text-xs">
                          <Mail className="mr-1 h-3 w-3" />
                          Email
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="space-y-1">
                      {notification.schedule_start_at && (
                        <div>Start: {formatDate(notification.schedule_start_at)}</div>
                      )}
                      {notification.schedule_end_at && (
                        <div>End: {formatDate(notification.schedule_end_at)}</div>
                      )}
                      {!notification.schedule_start_at && !notification.schedule_end_at && (
                        <div className="text-muted-foreground">No schedule</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(notification.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {notification.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePublish(notification.id)}
                          title="Publish"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {notification.status === 'live' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePause(notification.id)}
                          title="Pause"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {(notification.status === 'live' || notification.status === 'paused') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEnd(notification.id)}
                          title="End"
                        >
                          <StopCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/admin/backoffice/notifications/${notification.id}/analytics`)}
                        title="View Analytics"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/admin/backoffice/notifications/${notification.id}`)}
                        title="Edit"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(notification.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
