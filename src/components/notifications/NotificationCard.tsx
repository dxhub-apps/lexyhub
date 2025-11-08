'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { useUser } from '@supabase/auth-helpers-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Banner = {
  id: string;
  title: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  icon?: string;
};

const severityConfig = {
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-l-blue-500',
    textColor: 'text-blue-900 dark:text-blue-100',
    iconColor: 'text-blue-600 dark:text-blue-400',
    buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  success: {
    icon: CheckCircle2,
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-l-green-500',
    textColor: 'text-green-900 dark:text-green-100',
    iconColor: 'text-green-600 dark:text-green-400',
    buttonColor: 'bg-green-600 hover:bg-green-700 text-white',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-l-yellow-500',
    textColor: 'text-yellow-900 dark:text-yellow-100',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    buttonColor: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  },
  critical: {
    icon: AlertCircle,
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-l-red-500',
    textColor: 'text-red-900 dark:text-red-100',
    iconColor: 'text-red-600 dark:text-red-400',
    buttonColor: 'bg-red-600 hover:bg-red-700 text-white',
  },
};

export function NotificationCard() {
  const user = useUser();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  const fetchBanner = useCallback(async () => {
    if (!user?.id) {
      console.log('[NotificationCard] No user ID, skipping banner fetch');
      return;
    }

    try {
      console.log('[NotificationCard] Fetching active banner for user:', user.id);
      const response = await fetch(`/api/notifications/active?userId=${user.id}`);

      if (response.ok) {
        const data = await response.json();
        console.log('[NotificationCard] Banner data received:', data);

        if (data.banner) {
          setBanner(data.banner);
          setIsVisible(true);
          console.log('[NotificationCard] Banner set:', data.banner.title);
        } else {
          setBanner(null);
          console.log('[NotificationCard] No active banner');
        }
      } else {
        console.error('[NotificationCard] Failed to fetch banner, status:', response.status);
      }
    } catch (error) {
      console.error('[NotificationCard] Error fetching active banner:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    fetchBanner();

    // Check for new banners every 5 minutes
    const interval = setInterval(fetchBanner, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id, fetchBanner]);

  async function handleDismiss() {
    if (!banner || !user?.id) return;

    try {
      await fetch('/api/notifications/delivery', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          notification_id: banner.id,
          action: 'dismiss',
        }),
      });
      setIsVisible(false);
    } catch (error) {
      console.error('Failed to dismiss banner:', error);
    }
  }

  async function handleClick() {
    if (!banner || !user?.id) return;

    try {
      await fetch('/api/notifications/delivery', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          notification_id: banner.id,
          action: 'click',
        }),
      });

      if (banner.cta_url) {
        window.location.href = banner.cta_url;
      }
    } catch (error) {
      console.error('Failed to track banner click:', error);
    }
  }

  if (!banner || !isVisible) return null;

  const config = severityConfig[banner.severity];
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        'border-l-4',
        config.borderColor,
        config.bgColor
      )}
      role={banner.severity === 'warning' || banner.severity === 'critical' ? 'alert' : 'status'}
      aria-live={banner.severity === 'critical' ? 'assertive' : 'polite'}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className={cn('text-lg font-semibold', config.textColor)}>
            Notifications
          </CardTitle>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8 hover:bg-black/10 dark:hover:bg-white/10', config.textColor)}
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 pt-0.5">
            {banner.icon ? (
              <span className="text-2xl" aria-hidden="true">
                {banner.icon}
              </span>
            ) : (
              <Icon className={cn('h-6 w-6', config.iconColor)} aria-hidden="true" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className={cn('text-base font-semibold leading-tight mb-1', config.textColor)}>
              {banner.title}
            </h3>
            {banner.body && (
              <p className={cn('text-sm opacity-90 leading-relaxed', config.textColor)}>
                {banner.body}
              </p>
            )}

            {/* CTA Button */}
            {banner.cta_text && (
              <div className="mt-4">
                <Button
                  onClick={handleClick}
                  className={cn('h-9 px-4', config.buttonColor)}
                  size="sm"
                >
                  {banner.cta_text}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
