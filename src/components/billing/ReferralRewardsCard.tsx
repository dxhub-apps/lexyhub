"use client";

import { Users, Gift, Copy, Check, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface ReferralReward {
  tier: 'basic' | 'pro';
  expiresAt: string;
}

export interface ReferralProgress {
  current: number;
  next: number;
  percentage: number;
}

export interface NextReward {
  tier: 'basic' | 'pro';
  referralsNeeded: number;
}

export interface ReferralRewardsCardProps {
  referralCode: string;
  referralCount: number;
  activeReward: ReferralReward | null;
  nextReward: NextReward | null;
  progress: ReferralProgress;
}

export function ReferralRewardsCard({
  referralCode,
  referralCount,
  activeReward,
  nextReward,
  progress,
}: ReferralRewardsCardProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const referralLink = `${window.location.origin}?ref=${referralCode}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTierBadgeColor = (tier: 'basic' | 'pro') => {
    return tier === 'pro' ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white';
  };

  const getTierName = (tier: 'basic' | 'pro') => {
    return tier === 'pro' ? 'Pro' : 'Basic';
  };

  const formatExpiryDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Refer to Unlock
          </CardTitle>
          {activeReward && (
            <Badge className={getTierBadgeColor(activeReward.tier)}>
              {getTierName(activeReward.tier)} Active
            </Badge>
          )}
        </div>
        <CardDescription>
          Invite friends and unlock premium features for free!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Reward */}
        {activeReward && (
          <div className="rounded-lg border-2 border-primary bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-primary">
                  {getTierName(activeReward.tier)} Plan Active
                </p>
                <p className="text-xs text-muted-foreground">
                  Expires {formatExpiryDate(activeReward.expiresAt)}
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
          </div>
        )}

        {/* Referral Count & Progress */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              {referralCount} {referralCount === 1 ? 'Referral' : 'Referrals'}
            </span>
            {nextReward && (
              <span className="text-sm text-muted-foreground">
                {nextReward.referralsNeeded} more for {getTierName(nextReward.tier)}
              </span>
            )}
          </div>
          <Progress value={progress.percentage} className="h-2" />
          <p className="mt-1 text-xs text-muted-foreground">
            {progress.current} of {progress.next} referrals
          </p>
        </div>

        {/* Reward Tiers */}
        <div className="space-y-2 rounded-lg bg-muted p-3">
          <p className="text-sm font-medium">Unlock Rewards:</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className={referralCount >= 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                {referralCount >= 1 ? '✅' : '🔒'} 1 referral
              </span>
              <Badge variant="outline" className="text-xs">
                Basic - 3 months
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className={referralCount >= 3 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                {referralCount >= 3 ? '✅' : '🔒'} 3 referrals
              </span>
              <Badge variant="outline" className="text-xs">
                Pro - 3 months
              </Badge>
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <div>
          <label className="mb-2 block text-sm font-medium">Your Referral Link:</label>
          <div className="flex gap-2">
            <div className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm">
              {window.location.origin}?ref={referralCode}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Share with friends to unlock premium features!
          </p>
        </div>

        {/* How it Works */}
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">How it works:</p>
          <ul className="space-y-1">
            <li>• Share your link with friends</li>
            <li>• They sign up using your link</li>
            <li>• You both unlock rewards automatically!</li>
            <li>• Rewards last for 3 months</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
