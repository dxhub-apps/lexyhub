'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useUser } from '@supabase/auth-helpers-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NotificationFeed } from './NotificationFeed';

export function NotificationBell() {
  const user = useUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/notifications/feed?userId=${user.id}&unread=true&limit=1`);
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // Fetch unread count
    fetchUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, [user?.id, fetchUnreadCount]);

  // Refresh count when popover opens
  useEffect(() => {
    if (isOpen && user?.id) {
      fetchUnreadCount();
    }
  }, [isOpen, user?.id, fetchUnreadCount]);

  if (!user?.id) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="View notifications"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0"
        align="end"
        sideOffset={8}
      >
        <NotificationFeed
          userId={user.id}
          onNotificationRead={() => fetchUnreadCount()}
        />
      </PopoverContent>
    </Popover>
  );
}
