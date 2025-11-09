"use client";

import { Sparkles, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface FreePlusIndicatorProps {
  daysRemaining: number;
  expiresAt: string;
  totalDays?: number;
}

export function FreePlusIndicator({
  daysRemaining,
  expiresAt,
  totalDays = 30,
}: FreePlusIndicatorProps): JSX.Element {
  const percentageRemaining = Math.round((daysRemaining / totalDays) * 100);
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card className="border-2 border-accent bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Free+ Extension Boost
          </CardTitle>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Active
          </Badge>
        </div>
        <CardDescription>
          Enjoying 2.5x higher limits thanks to the LexyHub Chrome Extension
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Time Remaining
            </span>
            <span className="font-semibold">
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
            </span>
          </div>
          <Progress value={percentageRemaining} className="h-2" />
          <p className="mt-1 text-xs text-muted-foreground">
            Expires on {expiryDate}
          </p>
        </div>

        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="mb-2 font-medium">Your boosted limits:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• 25 searches per month (vs 10)</li>
            <li>• 3 niche projects (vs 1)</li>
            <li>• 25 AI opportunities (vs 10)</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Want even more? <a href="/pricing" className="text-primary underline">Upgrade to Basic or Pro</a> for unlimited access.
        </p>
      </CardContent>
    </Card>
  );
}

export function FreePlusExpiredNotice(): JSX.Element {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          Free+ Extension Boost Expired
        </CardTitle>
        <CardDescription>
          Your 30-day extension boost has ended
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          You&apos;re back to the standard Free plan limits. Want to continue with higher limits?
        </p>
        <a
          href="/pricing"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          View Upgrade Options
        </a>
      </CardContent>
    </Card>
  );
}
