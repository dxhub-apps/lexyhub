"use client";

import { useEffect } from "react";
import { Brain, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLexyBrainQuota } from "@/lib/lexybrain/hooks";

export function QuotaDisplay() {
  const { fetchQuota, loading, quota } = useLexyBrainQuota();

  useEffect(() => {
    fetchQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !quota) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading quota...</div>
        </CardContent>
      </Card>
    );
  }

  if (!quota) {
    return null;
  }

  const quotas = [
    {
      key: "ai_calls",
      label: "AI Calls",
      description: "Radar, Risk, Ad Insights",
      icon: <Brain className="h-4 w-4" />,
      data: quota.ai_calls,
    },
    {
      key: "ai_brief",
      label: "Market Briefs",
      description: "Comprehensive analysis",
      icon: <TrendingUp className="h-4 w-4" />,
      data: quota.ai_brief,
    },
    {
      key: "ai_sim",
      label: "Simulations",
      description: "Market Twin runs",
      icon: <Zap className="h-4 w-4" />,
      data: quota.ai_sim,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          Your LexyBrain Quota
        </CardTitle>
        <CardDescription>
          Current usage for this month
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {quotas.map((item) => {
          const { used, limit, percentage } = item.data;
          const isUnlimited = limit === -1;
          const isWarning = !isUnlimited && percentage >= 80;
          const isCritical = !isUnlimited && percentage >= 90;

          return (
            <div key={item.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {item.icon}
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </div>
                <div className="text-right">
                  {isUnlimited ? (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                      Unlimited
                    </Badge>
                  ) : (
                    <div className="text-sm">
                      <span className={isCritical ? "text-red-600 font-semibold" : isWarning ? "text-yellow-600 font-semibold" : ""}>
                        {used}
                      </span>
                      {" / "}
                      {limit}
                    </div>
                  )}
                </div>
              </div>

              {!isUnlimited && (
                <Progress
                  value={percentage}
                  className={isCritical ? "bg-red-100" : isWarning ? "bg-yellow-100" : "bg-gray-100"}
                />
              )}
            </div>
          );
        })}

        {Object.values(quota).some((q) => q.limit !== -1 && q.percentage >= 80) && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              You&apos;re running low on quota. Upgrade for more AI insights!
            </p>
            <Button asChild className="w-full">
              <Link href="/billing">Upgrade Plan</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
