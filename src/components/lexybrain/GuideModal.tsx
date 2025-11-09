"use client";

import { FileText, Radar, DollarSign, AlertTriangle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function GuideModal({ open, onClose }: GuideModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <FileText className="h-6 w-6 text-purple-600" />
            LexyBrain User Guide
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-100px)] pr-4">
          <div className="space-y-6">
            {/* Quick Start */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge>Quick Start</Badge>
              </h3>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">1</Badge>
                  <div>
                    <strong className="block mb-1">Enter your keywords</strong>
                    <span className="text-muted-foreground">
                      Type 3-10 specific keywords related to your niche (e.g., &quot;handmade silver rings, vintage necklaces&quot;)
                    </span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">2</Badge>
                  <div>
                    <strong className="block mb-1">Click &quot;Run Complete Analysis&quot;</strong>
                    <span className="text-muted-foreground">
                      Wait 15-30 seconds for AI to analyze market overview, opportunities, ad strategy, and risks
                    </span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">3</Badge>
                  <div>
                    <strong className="block mb-1">Review insights and take action</strong>
                    <span className="text-muted-foreground">
                      Results are saved automatically - you can return anytime without using more quota
                    </span>
                  </div>
                </li>
              </ol>
            </div>

            {/* Understanding Results */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-3">Understanding Your Results</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <FileText className="h-5 w-5 text-blue-600 mt-1 shrink-0" />
                  <div>
                    <strong className="block mb-1">Market Overview</strong>
                    <p className="text-sm text-muted-foreground">
                      Shows the big picture of your niche with top opportunities and recommended actions. Start here to understand if your market is viable.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Radar className="h-5 w-5 text-green-600 mt-1 shrink-0" />
                  <div>
                    <strong className="block mb-1">Opportunity Radar</strong>
                    <p className="text-sm text-muted-foreground">
                      Scores each keyword on 5 dimensions: Demand, Momentum, Competition, Novelty, and Profit. Look for 70+ scores on demand/momentum and below 40 on competition.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <DollarSign className="h-5 w-5 text-yellow-600 mt-1 shrink-0" />
                  <div>
                    <strong className="block mb-1">Ad Budget Strategy</strong>
                    <p className="text-sm text-muted-foreground">
                      Shows average CPC and expected clicks. Focus your ad budget on keywords with high profit scores (70+) for best ROI.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-1 shrink-0" />
                  <div>
                    <strong className="block mb-1">Risk Assessment</strong>
                    <p className="text-sm text-muted-foreground">
                      Identifies saturated markets or declining trends. High-risk keywords need immediate attention - consider pivoting to related niches with less competition.
                    </p>
                  </div>
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
                Real-world examples showing exactly how to use LexyBrain for common situations:
              </p>

              <div className="space-y-4">
                {/* Scenario 1 */}
                <Card className="border-2 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span>📦</span>
                      New Seller: Finding Your First Niche
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    <p className="text-muted-foreground">
                      <strong>Situation:</strong> Sarah wants to start on Etsy but doesn&apos;t know what to sell.
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Strategy:</strong> Run analysis on broad categories (&quot;handmade gifts, custom jewelry, personalized items&quot;). Look for keywords with high demand (70+) and low competition (30-). Check risks to avoid saturated markets. Use Neural Map to find related niches.
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Result:</strong> Discovers &quot;custom pet portraits&quot; has 85 demand with 45 competition - perfect for beginners.
                    </p>
                  </CardContent>
                </Card>

                {/* Scenario 2 */}
                <Card className="border-2 border-yellow-200 dark:border-yellow-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span>📉</span>
                      Declining Sales: Finding What Went Wrong
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    <p className="text-muted-foreground">
                      <strong>Situation:</strong> Mike&apos;s vintage decor sales dropped 40% in 3 months.
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Strategy:</strong> Run Risk Assessment on current keywords. Identify declining keywords vs. still-strong ones. Check Market Overview for emerging trends. Use Neural Map to find adjacent niches.
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Result:</strong> Finds &quot;farmhouse decor&quot; is saturated but &quot;cottagecore aesthetic&quot; is trending with low competition. Mike pivots successfully.
                    </p>
                  </CardContent>
                </Card>

                {/* Scenario 3 */}
                <Card className="border-2 border-green-200 dark:border-green-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span>📈</span>
                      Scaling Up: Smart Ad Spend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    <p className="text-muted-foreground">
                      <strong>Situation:</strong> Jessica wants to invest $500/month in ads to scale.
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Strategy:</strong> Analyze top 10 performing keywords. Check Ad Budget Strategy for CPC and click estimates. Focus on keywords with 70+ profit scores. Monitor with monthly Risk Assessment to avoid wasting budget on declining keywords.
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Result:</strong> Puts 60% of budget on &quot;custom wedding invitations&quot; (CPC $0.45, 37 clicks/day) and sees 3x return.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Visual Quick Reference */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Score Quick Reference</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-2xl">🟢</span>
                      Good Signals
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    <div className="flex gap-2">
                      <span className="font-bold text-green-700">70+</span>
                      <span className="text-muted-foreground">Opportunity - Start here!</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-green-700">80+</span>
                      <span className="text-muted-foreground">Demand - High interest</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-green-700">30-</span>
                      <span className="text-muted-foreground">Competition - Easy to rank</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 border-red-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-2xl">🔴</span>
                      Red Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    <div className="flex gap-2">
                      <span className="font-bold text-red-700">40-</span>
                      <span className="text-muted-foreground">Opportunity - Avoid</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-red-700">30-</span>
                      <span className="text-muted-foreground">Demand - Too low</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-red-700">70+</span>
                      <span className="text-muted-foreground">Competition - Saturated</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Best Practices */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-3">Best Practices</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ <strong>Be specific:</strong> Use &quot;handmade silver rings&quot; instead of &quot;jewelry&quot;</li>
                <li>✓ <strong>Check monthly:</strong> Run Risk Assessment on active keywords to catch declining trends early</li>
                <li>✓ <strong>Results persist:</strong> Your analysis is saved automatically - no need to re-run the same query</li>
                <li>✓ <strong>Use Neural Map:</strong> Discover related niches you hadn&apos;t considered</li>
                <li>✓ <strong>Focus budget:</strong> Spend ads on keywords with 70+ profit scores</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
