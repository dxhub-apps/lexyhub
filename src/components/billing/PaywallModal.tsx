"use client";

import { AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type PaywallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotaKey: "searches" | "ai_opportunities" | "niches";
  used: number;
  limit: number;
  currentPlan: string;
};

const QUOTA_LABELS: Record<string, string> = {
  searches: "Searches",
  ai_opportunities: "AI Opportunities",
  niches: "Niches",
};

const RECOMMENDED_PLAN: Record<string, { name: string; price: string; benefit: string }> = {
  free: {
    name: "Basic",
    price: "$7/month",
    benefit: "100 searches + 10 niches + 999 AI opportunities",
  },
  basic: {
    name: "Pro",
    price: "$19/month",
    benefit: "Unlimited searches, niches, and AI opportunities",
  },
  spark: {
    name: "Pro",
    price: "$19/month",
    benefit: "Unlimited searches, niches, and AI opportunities",
  },
  scale: {
    name: "Pro",
    price: "$19/month",
    benefit: "Unlimited searches, niches, and AI opportunities",
  },
};

export function PaywallModal({
  open,
  onOpenChange,
  quotaKey,
  used,
  limit,
  currentPlan,
}: PaywallModalProps): JSX.Element {
  const quotaLabel = QUOTA_LABELS[quotaKey] ?? quotaKey;
  const recommendation = RECOMMENDED_PLAN[currentPlan] ?? RECOMMENDED_PLAN["free"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
            <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <DialogTitle className="text-center">Quota Limit Reached</DialogTitle>
          <DialogDescription className="text-center">
            You've used{" "}
            <Badge variant="outline" className="font-mono">
              {used}/{limit === -1 ? "∞" : limit}
            </Badge>{" "}
            {quotaLabel.toLowerCase()} this month.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 rounded-lg border bg-muted/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h4 className="font-semibold">Upgrade to {recommendation.name}</h4>
          </div>
          <p className="mb-2 text-sm text-muted-foreground">{recommendation.benefit}</p>
          <p className="text-lg font-bold text-primary">{recommendation.price}</p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild className="w-full">
            <Link href="/pricing">
              View Plans <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/profile">Manage Subscription</Link>
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
