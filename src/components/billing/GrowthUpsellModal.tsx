"use client";

import { TrendingUp, Check, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_CONFIGS } from "@/lib/billing/plans";

export interface GrowthUpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerId?: string;
  currentPlan: string;
  onDismiss?: () => void;
  onContactSales?: () => void;
}

export function GrowthUpsellModal({
  open,
  onOpenChange,
  triggerId,
  currentPlan,
  onDismiss,
  onContactSales,
}: GrowthUpsellModalProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);

  const handleDismiss = () => {
    onDismiss?.();
    onOpenChange(false);

    // Track dismissal
    if (triggerId) {
      fetch('/api/billing/upsell/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerId }),
      }).catch(console.error);
    }
  };

  const handleContactSales = async () => {
    setIsLoading(true);

    // Track click
    if (triggerId) {
      await fetch('/api/billing/upsell/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerId }),
      }).catch(console.error);
    }

    onContactSales?.();
    setIsLoading(false);
  };

  const growthPlan = PLAN_CONFIGS.growth;
  const currentPlanConfig = PLAN_CONFIGS[currentPlan as keyof typeof PLAN_CONFIGS];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="mb-2 w-fit">
              <Sparkles className="mr-1 h-3 w-3" />
              Exclusive Offer
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogTitle className="text-2xl">
            Ready to scale beyond limits?
          </DialogTitle>
          <DialogDescription>
            You're hitting the ceiling on your {currentPlanConfig?.display_name} plan.
            Our Growth plan is designed for power users like you.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {/* Comparison */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-semibold">Your Current Plan</h4>
              <p className="mb-1 text-2xl font-bold">
                ${(currentPlanConfig?.price_monthly_cents ?? 0) / 100}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span>{currentPlanConfig?.searches_per_month ?? 0} searches/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span>{currentPlanConfig?.niches_max ?? 0} niche projects</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span>{currentPlanConfig?.ai_opportunities_per_month ?? 0} AI opportunities</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
              <h4 className="mb-2 flex items-center gap-2 font-semibold">
                <TrendingUp className="h-4 w-4 text-primary" />
                Growth Plan
              </h4>
              <p className="mb-1 text-2xl font-bold text-primary">
                ${growthPlan.price_monthly_cents / 100}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {growthPlan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Benefits */}
          <div className="rounded-lg bg-muted p-4">
            <h4 className="mb-3 font-semibold">Why Growth customers love it:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span><strong>Never hit limits again</strong> - Unlimited searches, niches, and AI opportunities</span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span><strong>White-glove support</strong> - Direct access to our team via Slack</span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span><strong>Custom integrations</strong> - API access and webhook support</span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span><strong>Team collaboration</strong> - Share insights with your team</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              size="lg"
              onClick={handleContactSales}
              disabled={isLoading}
              asChild
            >
              <Link href="mailto:sales@lexyhub.com?subject=Growth Plan Inquiry">
                Contact Sales Team
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleDismiss}
            >
              Maybe Later
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Growth plan requires consultation. We'll help you determine if it's the right fit.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
