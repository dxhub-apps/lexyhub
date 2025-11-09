"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { useSession } from "@supabase/auth-helpers-react";
import Link from "next/link";

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

export function NotificationsBell(): JSX.Element {
  const session = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const userId = session?.user?.id;

  const loadNotifications = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }

      const data = (await response.json()) as { notifications: Notification[] };
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.notifications?.filter((n) => !n.read).length ?? 0);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadNotifications();

    // Poll for new notifications every 60 seconds
    const interval = setInterval(() => {
      void loadNotifications();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadNotifications]);

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
