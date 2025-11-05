'use client';

import {
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

type NotificationItemProps = {
  notification: {
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
  onClick: () => void;
  onMarkAsRead: () => void;
};

const severityConfig = {
  info: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
  },
  success: {
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
  },
  critical: {
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
  },
};

export function NotificationItem({ notification, onClick, onMarkAsRead }: NotificationItemProps) {
  const isUnread = !notification.delivery || notification.delivery.state === 'pending';
  const config = severityConfig[notification.severity];
  const Icon = config.icon;

  const timeAgo = formatTimeAgo(notification.created_at);

  return (
    <div
      className={cn(
        'group relative cursor-pointer px-4 py-3 transition-colors hover:bg-accent',
        isUnread && 'bg-accent/50'
      )}
      onClick={onClick}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <Circle className="h-2 w-2 fill-primary text-primary" />
        </div>
      )}

      <div className="flex gap-3 pl-4">
        {/* Icon */}
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', config.bgColor)}>
          {notification.icon ? (
            <span className="text-lg">{notification.icon}</span>
          ) : (
            <Icon className={cn('h-4 w-4', config.color)} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-tight">{notification.title}</p>
          </div>

          {notification.body && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {notification.body}
            </p>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            {notification.category && (
              <>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {notification.category}
                </span>
              </>
            )}
          </div>

          {notification.cta_text && notification.cta_url && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {notification.cta_text}
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Mark as read button (only show for unread on hover) */}
        {isUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead();
            }}
          >
            Mark read
          </Button>
        )}
      </div>
    </div>
  );
}
