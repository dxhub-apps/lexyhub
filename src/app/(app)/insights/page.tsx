"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { TrendingUp } from "lucide-react";

import IntentGraph from "@/components/insights/IntentGraph";
import TrendRadar from "@/components/insights/TrendRadar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TIMEFRAMES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
];

export default function InsightsPage() {
  const [trendTimeframe, setTrendTimeframe] = useState<string>("7d");
  const [intentTimeframe, setIntentTimeframe] = useState<string>("7d");

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <TrendingUp className="h-6 w-6 text-muted-foreground" />
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold">Commerce Insights</CardTitle>
              <CardDescription className="text-base">
                Explore real-time radar views, purchase intent graphs, and partner analytics to uncover the next products to launch.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Dashboard timeframes sync with your keyword control center so the same toggles apply everywhere.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <TrendRadar
            title="Trend radar"
            timeframe={trendTimeframe}
            timeframeOptions={TIMEFRAMES}
            onTimeframeChange={setTrendTimeframe}
          />
          <p className="mt-4 text-sm text-muted-foreground">Visualise momentum across categories to prioritise roadmap bets.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <IntentGraph
            title="Intent graph"
            timeframe={intentTimeframe}
            timeframeOptions={TIMEFRAMES}
            onTimeframeChange={setIntentTimeframe}
          />
          <p className="mt-4 text-sm text-muted-foreground">Demand and supply delta informs which watchlists to accelerate.</p>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
            <CardTitle>Watchlist momentum</CardTitle>
            <CardDescription>
              Track watchlist adds versus plan capacity to understand operator momentum. Usage quotas enforce AI access fairly across tiers and surface alerts before limits are reached.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Trend radar metrics sync with keyword momentum to highlight the strongest opportunities.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Intent classification automatically populates downstream personalization signals.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>The partner API exposes normalized keywords with managed, rate-limited access keys.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
