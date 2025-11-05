'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, TrendingUp, MousePointer, XCircle, Mail, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type NotificationMetrics = {
  notification_id: string;
  impressions: number;
  clicks: number;
  dismissals: number;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  ctr: number;
  dismiss_rate: number;
  open_rate: number;
};

export default function NotificationAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const notificationId = params.id as string;

  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/backoffice/notifications/${notificationId}/metrics`
      );

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [notificationId]);

  useEffect(() => {
    if (notificationId) {
      fetchMetrics();
    }
  }, [notificationId, fetchMetrics]);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="container py-8">
        <div className="text-center py-12">
          <p className="text-lg font-medium text-muted-foreground">
            Failed to load metrics
          </p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Impressions',
      value: metrics.impressions.toLocaleString(),
      icon: Eye,
      description: 'Total views across all channels',
    },
    {
      title: 'Click-Through Rate',
      value: `${metrics.ctr.toFixed(2)}%`,
      icon: MousePointer,
      description: `${metrics.clicks} clicks out of ${metrics.impressions} impressions`,
    },
    {
      title: 'Dismiss Rate',
      value: `${metrics.dismiss_rate.toFixed(2)}%`,
      icon: XCircle,
      description: `${metrics.dismissals} dismissals out of ${metrics.impressions} impressions`,
    },
    {
      title: 'Emails Sent',
      value: metrics.emails_sent.toLocaleString(),
      icon: Mail,
      description: 'Total emails delivered',
    },
    {
      title: 'Email Open Rate',
      value: `${metrics.open_rate.toFixed(2)}%`,
      icon: TrendingUp,
      description: `${metrics.emails_opened} opened out of ${metrics.emails_sent} sent`,
    },
    {
      title: 'Email Click Rate',
      value: metrics.emails_sent > 0
        ? `${((metrics.emails_clicked / metrics.emails_sent) * 100).toFixed(2)}%`
        : 'N/A',
      icon: MousePointer,
      description: `${metrics.emails_clicked} clicked out of ${metrics.emails_sent} sent`,
    },
  ];

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Notification Analytics</h1>
        <p className="text-muted-foreground">
          Performance metrics and engagement statistics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
          <CardDescription>
            Overall notification effectiveness and engagement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Engagement</span>
              <span className="text-muted-foreground">
                {metrics.impressions > 0
                  ? `${(((metrics.clicks + metrics.emails_clicked) / metrics.impressions) * 100).toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total Interactions</span>
              <span className="text-muted-foreground">
                {(metrics.clicks + metrics.dismissals + metrics.emails_clicked).toLocaleString()}
              </span>
            </div>
          </div>

          {metrics.ctr >= 8 && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-4">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                ✓ Excellent Performance
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                This notification exceeds the 8% CTR target
              </p>
            </div>
          )}

          {metrics.dismiss_rate > 15 && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 p-4">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                ⚠ High Dismiss Rate
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Consider revising the notification content or targeting
              </p>
            </div>
          )}

          {metrics.emails_sent > 0 && metrics.open_rate >= 40 && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                ✓ Strong Email Performance
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Email open rate meets the 40% target
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
