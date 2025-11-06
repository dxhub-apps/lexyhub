"use client";

import { useState } from "react";
import { Check, Zap, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PLAN_CONFIGS, getVisiblePlans } from "@/lib/billing/plans";
import { formatPrice, calculateAnnualSavings } from "@/lib/billing/types";
import type { BillingCycle } from "@/lib/billing/types";

type PlanFeature = {
  text: string;
  included: boolean;
};

type PricingPlan = {
  name: string;
  code: "free" | "basic" | "pro";
  price: string;
  annualPrice?: string;
  description: string;
  features: PlanFeature[];
  cta: string;
  popular?: boolean;
  savings?: number;
};

export default function PricingPage(): JSX.Element {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  // Get visible plans from config
  const visiblePlans = getVisiblePlans();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mb-12 text-center">
        <Badge variant="outline" className="mb-4">
          <Zap className="mr-1 h-3 w-3" />
          Pricing
        </Badge>
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Choose Your Plan</h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Start with a free account and upgrade as you grow. All plans include access to our
          powerful keyword research tools.
        </p>

        {/* Billing Cycle Toggle */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <Label
            htmlFor="billing-cycle"
            className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Monthly
          </Label>
          <Switch
            id="billing-cycle"
            checked={billingCycle === 'annual'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
          />
          <Label
            htmlFor="billing-cycle"
            className={`text-sm font-medium ${billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Annual
          </Label>
          {billingCycle === 'annual' && (
            <Badge variant="secondary" className="ml-2">
              <TrendingUp className="mr-1 h-3 w-3" />
              Save ~17%
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {visiblePlans.map((plan) => {
          const priceToShow = billingCycle === 'annual'
            ? plan.price_annual_cents
            : plan.price_monthly_cents;

          const savings = calculateAnnualSavings(
            plan.price_monthly_cents,
            plan.price_annual_cents
          );

          const isPopular = plan.plan_code === 'basic';

          return (
            <Card
              key={plan.plan_code}
              className={`relative flex flex-col transition-all ${
                hoveredPlan === plan.plan_code ? "scale-105 shadow-2xl" : ""
              } ${isPopular ? "border-primary shadow-lg" : ""}`}
              onMouseEnter={() => setHoveredPlan(plan.plan_code)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
                <CardDescription className="text-sm">
                  {plan.plan_code === 'free' && 'Perfect for trying out LexyHub'}
                  {plan.plan_code === 'basic' && 'For sellers growing their business'}
                  {plan.plan_code === 'pro' && 'For serious sellers and agencies'}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {formatPrice(priceToShow, billingCycle === 'annual' ? undefined : billingCycle)}
                  </span>
                  {billingCycle === 'annual' && plan.plan_code !== 'free' && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatPrice(Math.round(priceToShow / 12), 'monthly')} billed annually
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                  asChild
                >
                  <Link href={`/billing?plan=${plan.plan_code}&cycle=${billingCycle}`}>
                    {plan.plan_code === 'free' ? 'Get Started' : `Upgrade to ${plan.display_name}`}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-16 text-center">
        <Card className="inline-block border-2 border-dashed">
          <CardContent className="p-6">
            <h3 className="mb-2 text-lg font-semibold">Need More Power?</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Hitting your limits? Our Growth plan offers unlimited searches, projects, and AI opportunities.
            </p>
            <Button variant="outline" asChild>
              <Link href="mailto:sales@lexyhub.com">Contact Sales for Growth Plan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 text-center text-xs text-muted-foreground">
        <p>All paid plans include a 7-day free trial. No credit card required for Free plan.</p>
        <p className="mt-2">
          Questions?{" "}
          <Link href="/docs" className="underline hover:text-foreground">
            View documentation
          </Link>{" "}
          or{" "}
          <Link href="mailto:support@lexyhub.com" className="underline hover:text-foreground">
            contact support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
