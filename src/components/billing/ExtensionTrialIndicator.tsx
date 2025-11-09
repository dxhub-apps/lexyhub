"use client";

import { Sparkles, Clock, Chrome } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface ExtensionTrialIndicatorProps {
  daysRemaining: number;
  expiresAt: string;
  totalDays?: number;
}

export function ExtensionTrialIndicator({
  daysRemaining,
  expiresAt,
  totalDays = 14,
}: ExtensionTrialIndicatorProps): JSX.Element {
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
            <Chrome className="h-5 w-5 text-primary" />
            Extension Pro Trial
          </CardTitle>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Active
          </Badge>
        </div>
        <CardDescription>
          Full Pro access for signing up via the Chrome Extension
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
          <p className="mb-2 font-medium">Your Pro trial includes:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• 500 searches per month</li>
            <li>• 50 niche projects</li>
            <li>• 500 AI opportunities</li>
            <li>• Priority support</li>
            <li>• Advanced analytics</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Love Pro? <a href="/pricing" className="text-primary underline">Upgrade now</a> to keep these features after your trial ends.
        </p>
      </CardContent>
    </Card>
  );
}

export function ExtensionTrialExpiredNotice(): JSX.Element {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          Extension Pro Trial Ended
        </CardTitle>
        <CardDescription>
          Your 14-day Pro trial has expired
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          You&apos;re back to the Free plan. Continue with Pro features by upgrading today!
        </p>
        <a
          href="/pricing"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          View Pro Plan
        </a>
      </CardContent>
    </Card>
  );
}
