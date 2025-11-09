"use client";

export const dynamic = 'force-dynamic';

import { Brain, FileText, Radar, DollarSign, AlertTriangle, Network, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InsightGenerator } from "@/components/lexybrain/InsightGenerator";
import { QuotaDisplay } from "@/components/lexybrain/QuotaDisplay";
import { NeuralMap } from "@/components/lexybrain/NeuralMap";
import { XRayDashboard } from "@/components/lexybrain/XRayDashboard";

export default function InsightsPage() {
  const [neuralMapTerm, setNeuralMapTerm] = useState("handmade jewelry");
  const [neuralMapMarket, setNeuralMapMarket] = useState("etsy");
  const [showNeuralMap, setShowNeuralMap] = useState(false);

  // Load persisted search from X-Ray/Generate tabs
  useEffect(() => {
    const stored = localStorage.getItem("lexybrain_last_search");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.keyword) {
          setNeuralMapTerm(parsed.keyword);
          setNeuralMapMarket(parsed.market || "etsy");
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Section - Compact */}
      <Card className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            <CardTitle className="text-xl font-bold">LexyBrain AI Insights</CardTitle>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-xs">
              AI-Powered
            </Badge>
          </div>
          <CardDescription className="text-sm mt-1">
            Complete market intelligence in one click - powered by Llama-3-8B
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="xray" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="xray" className="flex items-center gap-2">
            <Radar className="h-4 w-4" />
            X-Ray
          </TabsTrigger>
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="neural-map" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Neural Map
          </TabsTrigger>
          <TabsTrigger value="features">
            <Brain className="h-4 w-4 mr-2" />
            Features
          </TabsTrigger>
          <TabsTrigger value="guide">
            <FileText className="h-4 w-4 mr-2" />
            Guide
          </TabsTrigger>
        </TabsList>

        {/* X-Ray Tab */}
        <TabsContent value="xray" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <XRayDashboard />
            </div>
            <div>
              <QuotaDisplay />
            </div>
          </div>
        </TabsContent>

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

        {/* Neural Map Tab */}
        <TabsContent value="neural-map" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Keyword Similarity Search</CardTitle>
              <CardDescription>
                Enter a keyword to visualize its semantic connections in the marketplace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label htmlFor="neural-term">Keyword</Label>
                  <Input
                    id="neural-term"
                    placeholder="e.g., handmade jewelry"
                    value={neuralMapTerm}
                    onChange={(e) => setNeuralMapTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setShowNeuralMap(true);
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="neural-market">Market</Label>
                  <Input
                    id="neural-market"
                    placeholder="e.g., etsy"
                    value={neuralMapMarket}
                    onChange={(e) => setNeuralMapMarket(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setShowNeuralMap(true);
                      }
                    }}
                  />
                </div>
              </div>
              <Button
                className="mt-4"
                onClick={() => setShowNeuralMap(true)}
              >
                <Network className="h-4 w-4 mr-2" />
                Generate Neural Map
              </Button>
            </CardContent>
          </Card>

          {showNeuralMap && (
            <NeuralMap
              term={neuralMapTerm}
              market={neuralMapMarket}
              onAddToWatchlist={(term) => {
                // TODO: Implement add to watchlist
                console.log('Add to watchlist:', term);
              }}
              onAnalyzeCluster={(terms) => {
                // TODO: Implement cluster analysis
                console.log('Analyze cluster:', terms);
              }}
            />
          )}
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-6">

          {/* AI Insight Types */}
          <div>
            <h2 className="text-xl font-semibold mb-3">AI-Powered Analysis</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Market Brief */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-1" />
              <CardTitle className="text-base">Market Brief</CardTitle>
              <CardDescription className="text-xs">
                Comprehensive market analysis with opportunities and risks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Market summary & trends</li>
                <li>• Top opportunities</li>
                <li>• Risk assessment</li>
                <li>• Action items</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                24h cache • 2/mo (Free)
              </Badge>
            </CardContent>
          </Card>

          {/* Opportunity Radar */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <Radar className="h-6 w-6 text-green-600 dark:text-green-400 mb-1" />
              <CardTitle className="text-base">Opportunity Radar</CardTitle>
              <CardDescription className="text-xs">
                Multi-dimensional keyword scoring system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Demand & momentum</li>
                <li>• Competition level</li>
                <li>• Novelty & profit scores</li>
                <li>• AI commentary</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                24h cache • 20/mo (Free)
              </Badge>
            </CardContent>
          </Card>

          {/* Ad Insight */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <DollarSign className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mb-1" />
              <CardTitle className="text-base">Ad Insight</CardTitle>
              <CardDescription className="text-xs">
                Smart ad budget allocation with CPC estimates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Budget recommendations</li>
                <li>• CPC estimates</li>
                <li>• Click predictions</li>
                <li>• ROI optimization</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                6h cache • 20/mo (Free)
              </Badge>
            </CardContent>
          </Card>

          {/* Risk Sentinel */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mb-1" />
              <CardTitle className="text-base">Risk Sentinel</CardTitle>
              <CardDescription className="text-xs">
                Proactive risk detection and mitigation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Saturation alerts</li>
                <li>• Trend warnings</li>
                <li>• Severity levels</li>
                <li>• Action plans</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                12h cache • 20/mo (Free)
              </Badge>
            </CardContent>
          </Card>

          {/* Keyword Graph */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <Network className="h-6 w-6 text-purple-600 dark:text-purple-400 mb-1" />
              <CardTitle className="text-base">Neural Map</CardTitle>
              <CardDescription className="text-xs">
                Interactive keyword similarity visualization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Vector similarity</li>
                <li>• Interactive graph</li>
                <li>• Niche discovery</li>
                <li>• Expansion ideas</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                Real-time • Unlimited
              </Badge>
            </CardContent>
          </Card>

          {/* X-Ray */}
          <Card className="hover:shadow-lg transition-shadow border-2 border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <Radar className="h-6 w-6 text-purple-600 dark:text-purple-400 mb-1" />
              <CardTitle className="text-base flex items-center gap-2">
                X-Ray Dashboard
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                  NEW
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Complete market intelligence in one click
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• All insights combined</li>
                <li>• Visual dashboard</li>
                <li>• One-click analysis</li>
                <li>• Persistent results</li>
              </ul>
              <Badge variant="secondary" className="text-xs">
                Uses quota from each feature
              </Badge>
            </CardContent>
          </Card>

          {/* Coming Soon */}
          <Card className="hover:shadow-lg transition-shadow opacity-75">
            <CardHeader className="pb-3">
              <Brain className="h-6 w-6 text-gray-400 mb-1" />
              <CardTitle className="text-base flex items-center gap-2">
                More Features
                <Badge variant="outline" className="text-xs">Soon</Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Additional AI features in development
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Seasonal forecasting</li>
                <li>• Competitor tracking</li>
                <li>• Listing optimizer</li>
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

              {/* Seller Scenarios */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    Seller Scenarios
                  </Badge>
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Real-world examples of how sellers use LexyBrain to grow their business. These scenarios show you exactly what to do in common situations.
                </p>

                <div className="space-y-6">
                  {/* Scenario 1: New Seller */}
                  <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">📦</span>
                        New Seller: Finding Your First Profitable Niche
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <strong className="text-blue-700 dark:text-blue-300">Situation:</strong>
                        <p className="text-muted-foreground">
                          Sarah wants to start selling on Etsy but doesn&apos;t know which products will be profitable.
                        </p>
                      </div>
                      <div>
                        <strong className="text-blue-700 dark:text-blue-300">How to use LexyBrain:</strong>
                        <ol className="list-decimal list-inside space-y-2 text-muted-foreground mt-2">
                          <li>Use <strong>X-Ray Dashboard</strong> with broad keywords like &quot;handmade gifts, personalized items, custom jewelry&quot;</li>
                          <li>Look at the <strong>Market Overview</strong> to understand which category has the best opportunities</li>
                          <li>Check <strong>Opportunity Radar</strong> scores - focus on keywords with high demand (70+) and low competition (30-)</li>
                          <li>Review <strong>Risk Assessment</strong> to avoid saturated markets</li>
                          <li>Use <strong>Neural Map</strong> to discover related niches you hadn&apos;t considered</li>
                        </ol>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-3 rounded border border-blue-200 dark:border-blue-800">
                        <strong className="text-blue-700 dark:text-blue-300">Expected Result:</strong>
                        <p className="text-muted-foreground mt-1">
                          Sarah discovers that &quot;custom pet portraits&quot; has high demand (85) with moderate competition (45), perfect for a beginner. The X-Ray shows 12 related keywords she can target.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Scenario 2: Struggling Seller */}
                  <Card className="border-2 border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-yellow-600 dark:text-yellow-400">📉</span>
                        Struggling Seller: Reviving Declining Sales
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <strong className="text-yellow-700 dark:text-yellow-300">Situation:</strong>
                        <p className="text-muted-foreground">
                          Mike&apos;s sales have dropped 40% in the last 3 months. He sells vintage-style home decor.
                        </p>
                      </div>
                      <div>
                        <strong className="text-yellow-700 dark:text-yellow-300">How to use LexyBrain:</strong>
                        <ol className="list-decimal list-inside space-y-2 text-muted-foreground mt-2">
                          <li>Run <strong>Risk Sentinel</strong> on his current keywords like &quot;vintage wall art, rustic signs, farmhouse decor&quot;</li>
                          <li>Identify which keywords are declining (red alerts) vs. still strong (green/yellow)</li>
                          <li>Use <strong>Market Brief</strong> to see what new trends are emerging in his niche</li>
                          <li>Check <strong>Opportunity Radar</strong> for pivot opportunities within his expertise</li>
                          <li>Use <strong>Neural Map</strong> to find adjacent niches with better momentum</li>
                        </ol>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                        <strong className="text-yellow-700 dark:text-yellow-300">Expected Result:</strong>
                        <p className="text-muted-foreground mt-1">
                          Risk Sentinel shows &quot;farmhouse decor&quot; is saturated (high severity alert). However, &quot;cottagecore aesthetic&quot; and &quot;dark academia decor&quot; are trending with low competition. Mike pivots his designs.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Scenario 3: Scaling Seller */}
                  <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-green-600 dark:text-green-400">📈</span>
                        Growing Seller: Scaling with Smart Ad Spend
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <strong className="text-green-700 dark:text-green-300">Situation:</strong>
                        <p className="text-muted-foreground">
                          Jessica is making consistent sales and wants to invest $500/month in ads to scale up.
                        </p>
                      </div>
                      <div>
                        <strong className="text-green-700 dark:text-green-300">How to use LexyBrain:</strong>
                        <ol className="list-decimal list-inside space-y-2 text-muted-foreground mt-2">
                          <li>Use <strong>X-Ray Dashboard</strong> with her top 10 performing keywords</li>
                          <li>Check <strong>Ad Budget Strategy</strong> to see recommended allocation (enter $16.67 daily budget)</li>
                          <li>Focus ad spend on keywords with high profit scores (70+) in <strong>Opportunity Radar</strong></li>
                          <li>Run <strong>Risk Sentinel</strong> monthly to avoid wasting budget on declining keywords</li>
                          <li>Use <strong>Neural Map</strong> to discover new keyword clusters for expansion</li>
                        </ol>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-3 rounded border border-green-200 dark:border-green-800">
                        <strong className="text-green-700 dark:text-green-300">Expected Result:</strong>
                        <p className="text-muted-foreground mt-1">
                          Ad Insight shows putting 60% of budget on &quot;custom wedding invitations&quot; (CPC: $0.45, 37 clicks/day) will drive the best ROI. She allocates accordingly and sees 3x return.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Scenario 4: Seasonal Seller */}
                  <Card className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-purple-600 dark:text-purple-400">🎄</span>
                        Seasonal Seller: Planning for Holiday Rush
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <strong className="text-purple-700 dark:text-purple-300">Situation:</strong>
                        <p className="text-muted-foreground">
                          It&apos;s August, and David wants to prepare his inventory for the Christmas season.
                        </p>
                      </div>
                      <div>
                        <strong className="text-purple-700 dark:text-purple-300">How to use LexyBrain:</strong>
                        <ol className="list-decimal list-inside space-y-2 text-muted-foreground mt-2">
                          <li>Use <strong>Market Brief</strong> with seasonal keywords like &quot;Christmas gifts, holiday decor, winter accessories&quot;</li>
                          <li>Check <strong>Opportunity Radar</strong> to find which seasonal items have best momentum scores (indicating growing interest)</li>
                          <li>Use <strong>Neural Map</strong> to discover micro-niches (e.g., &quot;Grinch ornaments&quot; vs generic &quot;Christmas ornaments&quot;)</li>
                          <li>Run <strong>Ad Insight</strong> to plan promotional budget for October-November launch</li>
                          <li>Set up monthly <strong>Risk Sentinel</strong> checks to monitor competition levels as season approaches</li>
                        </ol>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-3 rounded border border-purple-200 dark:border-purple-800">
                        <strong className="text-purple-700 dark:text-purple-300">Expected Result:</strong>
                        <p className="text-muted-foreground mt-1">
                          David finds that &quot;personalized family ornaments&quot; has 40% higher momentum than generic ornaments. He focuses production there and captures early-season buyers in September.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Scenario 5: Product Expansion */}
                  <Card className="border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-orange-600 dark:text-orange-400">🎨</span>
                        Expanding Seller: Adding New Product Lines
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <strong className="text-orange-700 dark:text-orange-300">Situation:</strong>
                        <p className="text-muted-foreground">
                          Emma sells digital printables and wants to add 3 new product categories to diversify income.
                        </p>
                      </div>
                      <div>
                        <strong className="text-orange-700 dark:text-orange-300">How to use LexyBrain:</strong>
                        <ol className="list-decimal list-inside space-y-2 text-muted-foreground mt-2">
                          <li>Start with her current best sellers in <strong>Neural Map</strong> to find semantically related products</li>
                          <li>Run <strong>X-Ray Dashboard</strong> on 5-6 potential expansion categories</li>
                          <li>Compare <strong>Opportunity Radar</strong> scores across all options - prioritize high novelty (60+) with medium competition (40-60)</li>
                          <li>Use <strong>Market Brief</strong> on top 2 candidates to understand full landscape</li>
                          <li>Check <strong>Risk Assessment</strong> to avoid categories with high saturation warnings</li>
                        </ol>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-3 rounded border border-orange-200 dark:border-orange-800">
                        <strong className="text-orange-700 dark:text-orange-300">Expected Result:</strong>
                        <p className="text-muted-foreground mt-1">
                          Neural Map reveals that customers buying &quot;budget planner printables&quot; also search for &quot;meal planning templates&quot; and &quot;habit tracker sheets&quot; - both showing high opportunity scores with low risk. Emma expands into both.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Quick Reference Visual Guide */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Visual Quick Reference</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="text-2xl">🟢</span>
                        Green Signals (Good to Go!)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-green-700 dark:text-green-300">70+</span>
                        <span className="text-muted-foreground">Opportunity score - Start here!</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-green-700 dark:text-green-300">80+</span>
                        <span className="text-muted-foreground">Demand score - High buyer interest</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-green-700 dark:text-green-300">30-</span>
                        <span className="text-muted-foreground">Competition - Easy to rank</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-green-700 dark:text-green-300">Low</span>
                        <span className="text-muted-foreground">Risk severity - Safe market</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 border-red-200 dark:border-red-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="text-2xl">🔴</span>
                        Red Flags (Avoid or Pivot!)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-red-700 dark:text-red-300">40-</span>
                        <span className="text-muted-foreground">Opportunity score - Look elsewhere</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-red-700 dark:text-red-300">30-</span>
                        <span className="text-muted-foreground">Demand score - Not enough buyers</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-red-700 dark:text-red-300">70+</span>
                        <span className="text-muted-foreground">Competition - Very crowded market</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-red-700 dark:text-red-300">High</span>
                        <span className="text-muted-foreground">Risk severity - Market declining</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
