'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationItem } from './NotificationItem';

type NotificationFeedProps = {
  userId: string;
  onNotificationRead?: () => void;
};

type Notification = {
  id: string;
  title: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  icon?: string;
  category: string;
  created_at: string;
  delivery?: {
    state: string;
    first_seen_at?: string;
  };
};

export function NotificationFeed({ userId, onNotificationRead }: NotificationFeedProps) {
  const [activeTab, setActiveTab] = useState<'unread' | 'all'>('unread');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [activeTab, userId]);

  async function fetchNotifications() {
    setIsLoading(true);
    try {
      const unreadParam = activeTab === 'unread' ? '&unread=true' : '';
      const response = await fetch(
        `/api/notifications/feed?userId=${userId}&limit=20${unreadParam}`
      );

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkAllRead() {
    setIsMarkingAllRead(true);
    try {
      const response = await fetch('/api/notifications/delivery', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ mark_all_read: true }),
      });

      if (response.ok) {
        await fetchNotifications();
        onNotificationRead?.();
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setIsMarkingAllRead(false);
    }
  }

  async function handleNotificationClick(notificationId: string, ctaUrl?: string) {
    try {
      // Track the click
      await fetch('/api/notifications/delivery', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          notification_id: notificationId,
          action: 'click',
        }),
      });

      // Refresh the feed
      await fetchNotifications();
      onNotificationRead?.();

      // Navigate if there's a CTA URL
      if (ctaUrl) {
        window.location.href = ctaUrl;
      }
    } catch (error) {
      console.error('Failed to track notification click:', error);
    }
  }

  async function handleMarkAsRead(notificationId: string) {
    try {
      await fetch('/api/notifications/delivery', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          notification_id: notificationId,
          action: 'view',
        }),
      });

      await fetchNotifications();
      onNotificationRead?.();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  const unreadNotifications = notifications.filter(
    (n) => !n.delivery || n.delivery.state === 'pending'
  );

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">Notifications</h3>
        {activeTab === 'unread' && unreadNotifications.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isMarkingAllRead}
            className="h-8 text-xs"
          >
            {isMarkingAllRead ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Marking...
              </>
            ) : (
              <>
                <Check className="mr-1 h-3 w-3" />
                Mark all read
              </>
            )}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'unread' | 'all')}>
        <TabsList className="w-full rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="unread"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Unread
            {unreadNotifications.length > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {unreadNotifications.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="m-0">
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : unreadNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="mb-2 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No unread notifications</p>
                <p className="text-xs text-muted-foreground">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y">
                {unreadNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification.id, notification.cta_url)}
                    onMarkAsRead={() => handleMarkAsRead(notification.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="all" className="m-0">
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="mb-2 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground">
                  You'll see notifications here when they arrive
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification.id, notification.cta_url)}
                    onMarkAsRead={() => handleMarkAsRead(notification.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
