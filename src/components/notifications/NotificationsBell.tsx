"use client";

import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";
import { useSession } from "@supabase/auth-helpers-react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "system" | "billing" | "info";
  read: boolean;
  created_at: string;
};

const FALLBACK_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes fallback
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000; // 2 seconds

export function NotificationsBell(): JSX.Element {
  const session = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Refs to prevent duplicate requests and manage cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRequestInFlightRef = useRef(false);
  const retryCountRef = useRef(0);
  const backoffTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;

    const loadNotifications = async () => {
      // Prevent duplicate simultaneous requests
      if (isRequestInFlightRef.current) {
        console.log('[NotificationsBell] Request already in flight, skipping');
        return;
      }

      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      isRequestInFlightRef.current = true;

      setLoading(true);
      try {
        const response = await fetch(
          `/api/notifications?userId=${encodeURIComponent(userId)}`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          // Handle rate limiting with exponential backoff
          if (response.status === 429) {
            if (retryCountRef.current < MAX_RETRIES) {
              const backoffDelay = INITIAL_BACKOFF_MS * Math.pow(2, retryCountRef.current);
              console.warn(
                `[NotificationsBell] Rate limited, retrying in ${backoffDelay}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`
              );
              retryCountRef.current += 1;

              backoffTimeoutRef.current = setTimeout(() => {
                isRequestInFlightRef.current = false;
                void loadNotifications();
              }, backoffDelay);
              return;
            } else {
              console.error('[NotificationsBell] Max retries reached, giving up');
              retryCountRef.current = 0;
            }
          }
          throw new Error(`Failed to load notifications: ${response.status}`);
        }

        // Reset retry count on successful request
        retryCountRef.current = 0;

        const data = (await response.json()) as { notifications: Notification[] };
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.notifications?.filter((n) => !n.read).length ?? 0);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[NotificationsBell] Request aborted');
        } else {
          console.error('[NotificationsBell] Failed to load notifications', error);
        }
      } finally {
        setLoading(false);
        isRequestInFlightRef.current = false;
      }
    };

    // Initial load
    void loadNotifications();

    // Set up realtime subscription for new notifications
    console.log('[NotificationsBell] Setting up realtime subscription for user:', userId);
    const channel = supabaseBrowser
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_delivery',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[NotificationsBell] New notification received via realtime:', payload);
          // Reload notifications when a new one arrives
          void loadNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notification_delivery',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[NotificationsBell] Notification updated via realtime:', payload);
          // Reload notifications when one is updated (e.g., marked as read)
          void loadNotifications();
        }
      )
      .subscribe((status) => {
        console.log('[NotificationsBell] Realtime subscription status:', status);
      });

    // Fallback polling every 5 minutes in case realtime fails
    const fallbackInterval = setInterval(() => {
      console.log('[NotificationsBell] Running fallback poll');
      void loadNotifications();
    }, FALLBACK_POLL_INTERVAL_MS);

    // Cleanup function
    return () => {
      console.log('[NotificationsBell] Cleaning up subscription');
      clearInterval(fallbackInterval);
      void supabaseBrowser.removeChannel(channel);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (backoffTimeoutRef.current) {
        clearTimeout(backoffTimeoutRef.current);
      }
      isRequestInFlightRef.current = false;
    };
  }, [userId]); // Only depend on userId, not the callback

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const getTypeColor = (type: Notification["type"]) => {
    switch (type) {
      case "system":
        return "text-blue-600";
      case "billing":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.slice(0, 5).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex flex-col items-start p-3 cursor-pointer",
                  !notification.read && "bg-accent/50"
                )}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
                  )}
                </div>
                <p className={cn("text-xs mt-1", getTypeColor(notification.type))}>
                  {notification.type.toUpperCase()} •{" "}
                  {new Date(notification.created_at).toLocaleDateString()}
                </p>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        {notifications.length > 5 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/notifications" className="w-full text-center text-sm">
                View all notifications
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
