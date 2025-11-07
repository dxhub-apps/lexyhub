"use client";

export const dynamic = 'force-dynamic';

import { Brain, FileText, Radar, DollarSign, AlertTriangle, Network, Sparkles } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InsightGenerator } from "@/components/lexybrain/InsightGenerator";
import { QuotaDisplay } from "@/components/lexybrain/QuotaDisplay";

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
                  AI-Powered
                </Badge>
              </div>
              <CardDescription className="text-base">
                Powered by Llama-3-8B, LexyBrain transforms your keyword data into actionable market intelligence.
                Get personalized insights, discover opportunities, and make data-driven decisions to grow your business.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Insights
          </TabsTrigger>
          <TabsTrigger value="features">
            <Brain className="h-4 w-4 mr-2" />
            Features
          </TabsTrigger>
          <TabsTrigger value="guide">
            <FileText className="h-4 w-4 mr-2" />
            User Guide
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <InsightGenerator />
            </div>
            <div>
              <QuotaDisplay />
            </div>
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-6">

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
        </TabsContent>

        {/* User Guide Tab */}
        <TabsContent value="guide" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Complete LexyBrain User Guide</CardTitle>
              <CardDescription>
                Step-by-step instructions to maximize your LexyBrain insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick Start */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge>Quick Start</Badge>
                </h3>
                <ol className="space-y-4 text-sm">
                  <li className="flex gap-3">
                    <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">1</Badge>
                    <div>
                      <strong className="block mb-1">Navigate to the Generate tab</strong>
                      <span className="text-muted-foreground">
                        Click the &quot;Generate Insights&quot; tab at the top of this page to access the interactive form.
                      </span>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">2</Badge>
                    <div>
                      <strong className="block mb-1">Choose your insight type</strong>
                      <span className="text-muted-foreground">
                        Select from Market Brief, Radar, Ads, or Risks based on what you want to analyze.
                      </span>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">3</Badge>
                    <div>
                      <strong className="block mb-1">Enter your market and keywords</strong>
                      <span className="text-muted-foreground">
                        Type your marketplace (e.g., &quot;etsy&quot;, &quot;amazon&quot;) and comma-separated niche keywords.
                      </span>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">4</Badge>
                    <div>
                      <strong className="block mb-1">Click Generate</strong>
                      <span className="text-muted-foreground">
                        Wait 5-15 seconds for the AI to analyze your data and return insights.
                      </span>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">5</Badge>
                    <div>
                      <strong className="block mb-1">Review and act on results</strong>
                      <span className="text-muted-foreground">
                        Read the AI-generated insights and implement the recommended actions.
                      </span>
                    </div>
                  </li>
                </ol>
              </div>

              {/* Insight Type Details */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3">When to Use Each Insight Type</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <FileText className="h-5 w-5 text-blue-600 mt-1 shrink-0" />
                    <div>
                      <strong className="block mb-1">Market Brief</strong>
                      <p className="text-sm text-muted-foreground mb-2">
                        Use when you need a comprehensive overview of your niche, including opportunities, risks, and strategic recommendations.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Best for:</strong> New niche exploration, quarterly planning, market entry decisions
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Radar className="h-5 w-5 text-green-600 mt-1 shrink-0" />
                    <div>
                      <strong className="block mb-1">Opportunity Radar</strong>
                      <p className="text-sm text-muted-foreground mb-2">
                        Use when you want detailed scoring for specific keywords across demand, momentum, competition, novelty, and profit.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Best for:</strong> Keyword prioritization, portfolio optimization, trend spotting
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <DollarSign className="h-5 w-5 text-yellow-600 mt-1 shrink-0" />
                    <div>
                      <strong className="block mb-1">Ad Insight</strong>
                      <p className="text-sm text-muted-foreground mb-2">
                        Use when you need to allocate your advertising budget across keywords with CPC and click estimates.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Best for:</strong> Ad campaign planning, budget optimization, ROI forecasting
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-1 shrink-0" />
                    <div>
                      <strong className="block mb-1">Risk Sentinel</strong>
                      <p className="text-sm text-muted-foreground mb-2">
                        Use when you want to identify and mitigate risks in your current keywords or planned niche.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Best for:</strong> Risk management, trend monitoring, defensive strategy
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Best Practices */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3">Best Practices</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>Be specific with keywords:</strong> Instead of &quot;jewelry&quot;, use &quot;handmade silver rings&quot; or &quot;vintage gemstone necklaces&quot;</li>
                  <li>• <strong>Start with Market Brief:</strong> Get the big picture before diving into specific insights</li>
                  <li>• <strong>Check quota regularly:</strong> Keep an eye on your monthly quota in the right sidebar</li>
                  <li>• <strong>Cache is your friend:</strong> Results are cached for 6-24h, so re-running the same query won&apos;t use quota</li>
                  <li>• <strong>Combine with Watchlist:</strong> Add promising keywords from insights to your Watchlist for ongoing monitoring</li>
                  <li>• <strong>Run Risk Sentinel monthly:</strong> Regular risk checks help you stay ahead of market changes</li>
                  <li>• <strong>Use Ad Insight before campaigns:</strong> Plan your budget allocation before launching ads</li>
                </ul>
              </div>

              {/* Troubleshooting */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3">Troubleshooting</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="block mb-1 text-foreground">Error: &quot;Quota exceeded&quot;</strong>
                    <p className="text-muted-foreground">
                      You&apos;ve reached your monthly quota. Either wait until next month, or upgrade your plan for more quota.
                    </p>
                  </div>
                  <div>
                    <strong className="block mb-1 text-foreground">Error: &quot;Generation failed&quot;</strong>
                    <p className="text-muted-foreground">
                      The AI model encountered an error. Try again with different keywords or contact support if the issue persists.
                    </p>
                  </div>
                  <div>
                    <strong className="block mb-1 text-foreground">Results seem generic</strong>
                    <p className="text-muted-foreground">
                      Add more specific niche keywords to get more targeted insights. The AI works best with 3-10 specific terms.
                    </p>
                  </div>
                  <div>
                    <strong className="block mb-1 text-foreground">Slow response time</strong>
                    <p className="text-muted-foreground">
                      First-time generation takes 5-15 seconds. Subsequent requests for the same parameters are instant (cached).
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Tips */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3">Advanced Tips</h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div>
                    <strong className="block mb-1 text-foreground">Seasonal Analysis</strong>
                    <p>
                      Run Market Briefs quarterly to catch seasonal trends and adjust your strategy accordingly.
                    </p>
                  </div>
                  <div>
                    <strong className="block mb-1 text-foreground">Budget Allocation</strong>
                    <p>
                      For Ad Insight, start with your planned monthly budget divided by 30 to get daily budget, then adjust based on recommendations.
                    </p>
                  </div>
                  <div>
                    <strong className="block mb-1 text-foreground">Competitive Research</strong>
                    <p>
                      Use Opportunity Radar with competitor keywords to understand why they&apos;re succeeding and find gaps.
                    </p>
                  </div>
                  <div>
                    <strong className="block mb-1 text-foreground">Portfolio Diversification</strong>
                    <p>
                      Run Risk Sentinel on all your active keywords monthly. Diversify away from high-risk keywords.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
