"use client";

export const dynamic = 'force-dynamic';

import { TrendingUp, BarChart3, Target, Zap } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function InsightsPage() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <TrendingUp className="h-6 w-6 text-muted-foreground" />
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold">Commerce Insights</CardTitle>
              <CardDescription className="text-base">
                Discover actionable insights from your keyword research and watchlist activity to guide your product strategy.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use insights to understand market opportunities and make data-driven decisions about which products to launch next.
          </p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <BarChart3 className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Keyword Opportunities</CardTitle>
            <CardDescription>
              Analyze keyword performance metrics and discover high-potential search terms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/keywords">
                Explore Keywords
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Target className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Watchlist Analysis</CardTitle>
            <CardDescription>
              Review your tracked keywords and identify trends in your saved opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/watchlists">
                View Watchlists
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Zap className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Market Twin</CardTitle>
            <CardDescription>
              Run simulations to predict product visibility and optimize your listings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/market-twin">
                Run Simulation
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Insights Guide */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use Insights</CardTitle>
          <CardDescription>
            Make the most of LexyHub's intelligence features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">1</Badge>
              <span><strong>Search Keywords:</strong> Use the keyword explorer to discover high-opportunity search terms based on demand, competition, and trend momentum.</span>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">2</Badge>
              <span><strong>Track Opportunities:</strong> Add promising keywords to your watchlist to monitor their performance over time.</span>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">3</Badge>
              <span><strong>Analyze Patterns:</strong> Review the keyword overview to understand market signals and identify emerging trends.</span>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">4</Badge>
              <span><strong>Simulate Success:</strong> Use Market Twin to test different product variations and optimize for maximum visibility.</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Metrics Coming Soon */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Advanced Analytics Coming Soon</CardTitle>
          <CardDescription>
            We're building more powerful insights features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Trending Categories</h4>
              <p className="text-xs text-muted-foreground">
                Identify which product categories are gaining momentum in real-time
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Purchase Intent Signals</h4>
              <p className="text-xs text-muted-foreground">
                Understand buyer intent levels across your tracked keywords
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Competitive Analysis</h4>
              <p className="text-xs text-muted-foreground">
                Compare your opportunities against market competition metrics
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Seasonal Trends</h4>
              <p className="text-xs text-muted-foreground">
                Discover seasonal patterns to time your product launches perfectly
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
