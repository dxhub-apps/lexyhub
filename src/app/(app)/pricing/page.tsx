"use client";

import { useState } from "react";
import { Check, Zap } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PlanFeature = {
  text: string;
  included: boolean;
};

type PricingPlan = {
  name: string;
  code: "free" | "basic" | "pro";
  price: string;
  description: string;
  features: PlanFeature[];
  cta: string;
  popular?: boolean;
};

const PLANS: PricingPlan[] = [
  {
    name: "Free",
    code: "free",
    price: "$0",
    description: "Perfect for trying out LexyHub",
    features: [
      { text: "10 searches per month", included: true },
      { text: "1 niche maximum", included: true },
      { text: "2 AI opportunities per month", included: true },
      { text: "Basic keyword insights", included: true },
      { text: "Community support", included: true },
      { text: "Advanced analytics", included: false },
      { text: "Priority support", included: false },
    ],
    cta: "Get Started",
  },
  {
    name: "Basic",
    code: "basic",
    price: "$7",
    description: "For sellers growing their business",
    features: [
      { text: "100 searches per month", included: true },
      { text: "10 niches maximum", included: true },
      { text: "999 AI opportunities per month", included: true },
      { text: "Advanced keyword insights", included: true },
      { text: "Trend analysis", included: true },
      { text: "Email support", included: true },
      { text: "Priority support", included: false },
    ],
    cta: "Upgrade to Basic",
    popular: true,
  },
  {
    name: "Pro",
    code: "pro",
    price: "$19",
    description: "For serious sellers and agencies",
    features: [
      { text: "Unlimited searches", included: true },
      { text: "Unlimited niches", included: true },
      { text: "Unlimited AI opportunities", included: true },
      { text: "Advanced analytics dashboard", included: true },
      { text: "Market Twin simulator", included: true },
      { text: "Priority support", included: true },
      { text: "API access", included: true },
    ],
    cta: "Upgrade to Pro",
  },
];

export default function PricingPage(): JSX.Element {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

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
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.code}
            className={`relative flex flex-col transition-all ${
              hoveredPlan === plan.code ? "scale-105 shadow-2xl" : ""
            } ${plan.popular ? "border-primary shadow-lg" : ""}`}
            onMouseEnter={() => setHoveredPlan(plan.code)}
            onMouseLeave={() => setHoveredPlan(null)}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription className="text-sm">{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.code !== "free" && (
                  <span className="ml-2 text-muted-foreground">/month</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check
                      className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                        feature.included ? "text-primary" : "text-muted-foreground/30"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        feature.included ? "text-foreground" : "text-muted-foreground line-through"
                      }`}
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
                asChild
              >
                <Link href="/profile">{plan.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Card className="inline-block border-2 border-dashed">
          <CardContent className="p-6">
            <h3 className="mb-2 text-lg font-semibold">Need More?</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Looking for enterprise features, custom integrations, or white-label solutions?
            </p>
            <Button variant="outline" asChild>
              <Link href="mailto:sales@lexyhub.com">Ask about Growth+</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 text-center text-xs text-muted-foreground">
        <p>All plans include a 7-day free trial. No credit card required.</p>
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
