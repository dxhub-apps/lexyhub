"use client";

import { AlertTriangle, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { QuotaKey } from "@/lib/billing/enforce";

export interface UsageWarningBannerProps {
  quotaKey: QuotaKey;
  used: number;
  limit: number;
  percentage: number;
  warningLevel: 'warning' | 'critical' | 'blocked';
  currentPlan: string;
  onDismiss?: () => void;
}

export function UsageWarningBanner({
  quotaKey,
  used,
  limit,
  percentage,
  warningLevel,
  currentPlan,
  onDismiss,
}: UsageWarningBannerProps): JSX.Element {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return <></>;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const getQuotaDisplayName = (key: QuotaKey): string => {
    switch (key) {
      case 'searches':
        return 'monthly searches';
      case 'ai_opportunities':
        return 'AI opportunities';
      case 'niches':
        return 'niche projects';
      default:
        return key;
    }
  };

  const getUpgradePlan = (currentPlan: string): string => {
    if (currentPlan === 'free') return 'Basic';
    if (currentPlan === 'basic') return 'Pro';
    return 'Growth';
  };

  const isBlocked = warningLevel === 'blocked';
  const isCritical = warningLevel === 'critical';

  return (
    <Alert
      variant={isBlocked ? "destructive" : "default"}
      className={`relative ${isCritical ? 'border-orange-500 bg-orange-50' : ''}`}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>
          {isBlocked && 'Usage Limit Reached'}
          {isCritical && 'Approaching Usage Limit'}
          {!isBlocked && !isCritical && 'Usage Warning'}
        </span>
        {!isBlocked && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>
              You&apos;ve used <strong>{used}</strong> of <strong>{limit}</strong> {getQuotaDisplayName(quotaKey)}
            </span>
            <span className="font-semibold">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        {isBlocked && (
          <p className="text-sm">
            You&apos;ve reached your {getQuotaDisplayName(quotaKey)} limit for this month.
            Upgrade to {getUpgradePlan(currentPlan)} to continue.
          </p>
        )}

        {isCritical && (
          <p className="text-sm">
            You&apos;re almost at your limit. Consider upgrading to {getUpgradePlan(currentPlan)}{' '}
            for higher limits and more features.
          </p>
        )}

        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href="/pricing">
              <TrendingUp className="mr-2 h-4 w-4" />
              Upgrade to {getUpgradePlan(currentPlan)}
            </Link>
          </Button>
          {!isBlocked && (
            <Button asChild variant="outline" size="sm">
              <Link href="/billing">View Usage Details</Link>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
