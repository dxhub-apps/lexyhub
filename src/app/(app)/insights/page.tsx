"use client";

export const dynamic = 'force-dynamic';

import { Brain, FileText, Radar, DollarSign, AlertTriangle, Network } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function InsightsPage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Card className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-start gap-3">
            <Brain className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-3xl font-bold">LexyBrain AI Insights</CardTitle>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                  New
                </Badge>
              </div>
              <CardDescription className="text-base">
                Powered by advanced AI, LexyBrain transforms your keyword data into actionable market intelligence.
                Get personalized insights, discover opportunities, and make data-driven decisions to grow your business.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            LexyBrain analyzes millions of data points to provide you with comprehensive market analysis,
            risk assessments, and strategic recommendations tailored to your niche.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/billing">
                Upgrade for More Insights
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="https://docs.lexyhub.com/lexybrain" target="_blank" rel="noopener noreferrer">
                Learn More
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Insight Types */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">AI-Powered Analysis</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Market Brief */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
              <CardTitle>Market Brief</CardTitle>
              <CardDescription>
                Comprehensive market analysis with opportunities, risks, and actionable recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• High-level market summary</li>
                <li>• Top 5 keyword opportunities</li>
                <li>• Risk assessment</li>
                <li>• Strategic action items</li>
                <li>• Confidence scoring</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                24h cache • 2 briefs/month (Free)
              </Badge>
            </CardContent>
          </Card>

          {/* Opportunity Radar */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Radar className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
              <CardTitle>Opportunity Radar</CardTitle>
              <CardDescription>
                Multi-dimensional keyword scoring across demand, momentum, competition, and profit potential
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• 5-dimension scoring system</li>
                <li>• Demand & momentum analysis</li>
                <li>• Competition assessment</li>
                <li>• Novelty & profit scores</li>
                <li>• Expert commentary</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                24h cache • 20 calls/month (Free)
              </Badge>
            </CardContent>
          </Card>

          {/* Ad Insight */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <DollarSign className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mb-2" />
              <CardTitle>Ad Insight</CardTitle>
              <CardDescription>
                Smart advertising budget allocation with CPC estimates and click predictions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Budget split recommendations</li>
                <li>• Expected CPC per keyword</li>
                <li>• Daily click estimates</li>
                <li>• ROI optimization tips</li>
                <li>• Seasonal adjustments</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                6h cache • 20 calls/month (Free)
              </Badge>
            </CardContent>
          </Card>

          {/* Risk Sentinel */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400 mb-2" />
              <CardTitle>Risk Sentinel</CardTitle>
              <CardDescription>
                Proactive risk detection with severity assessment and mitigation strategies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Market saturation alerts</li>
                <li>• Declining trend warnings</li>
                <li>• Severity classification</li>
                <li>• Evidence-based insights</li>
                <li>• Actionable mitigation steps</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                12h cache • 20 calls/month (Free)
              </Badge>
            </CardContent>
          </Card>

          {/* Keyword Graph */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Network className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-2" />
              <CardTitle>Neural Map</CardTitle>
              <CardDescription>
                Interactive keyword similarity graph powered by AI vector embeddings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Vector-based similarity</li>
                <li>• Interactive visualization</li>
                <li>• Discover related niches</li>
                <li>• Expansion opportunities</li>
                <li>• Multi-level exploration</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                Real-time • Unlimited (All plans)
              </Badge>
            </CardContent>
          </Card>

          {/* Coming Soon */}
          <Card className="hover:shadow-lg transition-shadow opacity-75">
            <CardHeader>
              <Brain className="h-8 w-8 text-gray-400 mb-2" />
              <CardTitle className="flex items-center gap-2">
                More AI Features
                <Badge variant="outline" className="text-xs">Coming Soon</Badge>
              </CardTitle>
              <CardDescription>
                Additional AI-powered features in development
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Seasonal forecasting</li>
                <li>• Competitor tracking</li>
                <li>• Listing optimizer</li>
                <li>• Market simulator</li>
                <li>• Trend alerts</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How LexyBrain Works</CardTitle>
          <CardDescription>
            Powered by Llama-3-8B and trained on millions of marketplace data points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold">
                1
              </div>
              <h3 className="font-semibold">Select Market</h3>
              <p className="text-sm text-muted-foreground">
                Choose your target marketplace and input your niche keywords
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold">
                2
              </div>
              <h3 className="font-semibold">AI Analysis</h3>
              <p className="text-sm text-muted-foreground">
                LexyBrain processes keyword metrics, trends, and competition data
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-bold">
                3
              </div>
              <h3 className="font-semibold">Get Insights</h3>
              <p className="text-sm text-muted-foreground">
                Receive structured, actionable insights in seconds
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 font-bold">
                4
              </div>
              <h3 className="font-semibold">Take Action</h3>
              <p className="text-sm text-muted-foreground">
                Implement recommendations and track results
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started with LexyBrain</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">1</Badge>
              <div>
                <strong className="block mb-1">Add keywords to your Watchlist</strong>
                <span className="text-muted-foreground">
                  Start by adding keywords you&apos;re interested in to your watchlist from the Keywords page.
                </span>
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">2</Badge>
              <div>
                <strong className="block mb-1">Request a Market Brief</strong>
                <span className="text-muted-foreground">
                  Use the API or upcoming UI to generate a comprehensive market analysis for your niche.
                </span>
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">3</Badge>
              <div>
                <strong className="block mb-1">Explore the Neural Map</strong>
                <span className="text-muted-foreground">
                  Visualize keyword relationships and discover new opportunities through the similarity graph.
                </span>
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">4</Badge>
              <div>
                <strong className="block mb-1">Monitor Risks</strong>
                <span className="text-muted-foreground">
                  Run Risk Sentinel regularly to stay ahead of market challenges and adjust your strategy.
                </span>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Plan Information */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle>Upgrade for More AI Insights</CardTitle>
          <CardDescription>
            Get more LexyBrain quota and unlock advanced features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <Badge variant="outline">Free</Badge>
              <p className="text-sm font-semibold">20 AI calls/month</p>
              <p className="text-xs text-muted-foreground">2 market briefs</p>
            </div>
            <div className="space-y-1">
              <Badge variant="outline">Basic</Badge>
              <p className="text-sm font-semibold">200 AI calls/month</p>
              <p className="text-xs text-muted-foreground">20 market briefs</p>
            </div>
            <div className="space-y-1">
              <Badge variant="outline">Pro</Badge>
              <p className="text-sm font-semibold">2,000 AI calls/month</p>
              <p className="text-xs text-muted-foreground">100 market briefs</p>
            </div>
            <div className="space-y-1">
              <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                Growth
              </Badge>
              <p className="text-sm font-semibold">Unlimited AI calls</p>
              <p className="text-xs text-muted-foreground">Unlimited briefs</p>
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <Button asChild>
              <Link href="/billing">View Plans</Link>
            </Button>
            <Button asChild variant="outline">
              <a href="/docs/lexybrain/business.md" target="_blank" rel="noopener noreferrer">
                Read Documentation
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
