'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useUser } from '@supabase/auth-helpers-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NotificationFeed } from './NotificationFeed';

const POLL_INTERVAL_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000; // 2 seconds

export function NotificationBell() {
  const user = useUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Refs to prevent duplicate requests and manage cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRequestInFlightRef = useRef(false);
  const retryCountRef = useRef(0);
  const backoffTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchUnreadCountRef = useRef<() => Promise<void>>();

  useEffect(() => {
    if (!user?.id) return;

    const fetchUnreadCount = async () => {
      // Prevent duplicate simultaneous requests
      if (isRequestInFlightRef.current) {
        console.log('[NotificationBell] Request already in flight, skipping');
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

      try {
        const response = await fetch(
          `/api/notifications/feed?userId=${user.id}&unread=true&limit=1`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          // Handle rate limiting with exponential backoff
          if (response.status === 429) {
            if (retryCountRef.current < MAX_RETRIES) {
              const backoffDelay = INITIAL_BACKOFF_MS * Math.pow(2, retryCountRef.current);
              console.warn(
                `[NotificationBell] Rate limited, retrying in ${backoffDelay}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`
              );
              retryCountRef.current += 1;

              backoffTimeoutRef.current = setTimeout(() => {
                isRequestInFlightRef.current = false;
                void fetchUnreadCount();
              }, backoffDelay);
              return;
            } else {
              console.error('[NotificationBell] Max retries reached, giving up');
              retryCountRef.current = 0;
            }
          }
          throw new Error(`Failed to fetch unread count: ${response.status}`);
        }

        // Reset retry count on successful request
        retryCountRef.current = 0;

        const data = await response.json();
        setUnreadCount(data.unread_count || 0);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[NotificationBell] Request aborted');
        } else {
          console.error('[NotificationBell] Failed to fetch unread count:', error);
        }
      } finally {
        isRequestInFlightRef.current = false;
      }
    };

    // Store reference for use in popover effect
    fetchUnreadCountRef.current = fetchUnreadCount;

    // Initial fetch
    void fetchUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      void fetchUnreadCount();
    }, POLL_INTERVAL_MS);

    // Cleanup function
    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (backoffTimeoutRef.current) {
        clearTimeout(backoffTimeoutRef.current);
      }
      isRequestInFlightRef.current = false;
    };
  }, [user?.id]); // Only depend on user?.id

  // Refresh count when popover opens
  useEffect(() => {
    if (isOpen && user?.id && fetchUnreadCountRef.current) {
      void fetchUnreadCountRef.current();
    }
  }, [isOpen, user?.id]);

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
          onNotificationRead={() => fetchUnreadCountRef.current?.()}
        />
      </PopoverContent>
    </Popover>
  );
}
