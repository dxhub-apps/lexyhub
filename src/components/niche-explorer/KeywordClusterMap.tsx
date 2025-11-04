"use client";

import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type KeywordCluster = {
  name: string;
  keywords: string[];
  growthRate: number;
  opportunityScore: number;
};

type KeywordClusterMapProps = {
  clusters: KeywordCluster[];
};

export function KeywordClusterMap({ clusters }: KeywordClusterMapProps): JSX.Element {
  const getGrowthIcon = (rate: number) => {
    if (rate > 15) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (rate < -5) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-yellow-600" />;
  };

  const getOpportunityColor = (score: number): string => {
    if (score >= 80) return "bg-green-600";
    if (score >= 60) return "bg-blue-600";
    if (score >= 40) return "bg-yellow-600";
    return "bg-gray-400";
  };

  const getOpportunityTextColor = (score: number): string => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-yellow-600";
    return "text-gray-600";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clusters.map((cluster, index) => (
        <div
          key={index}
          className="border rounded-lg p-4 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-base">{cluster.name}</h4>
              {getGrowthIcon(cluster.growthRate)}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Growth Rate:</span>
                <span className={`font-semibold ${cluster.growthRate > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cluster.growthRate > 0 ? '+' : ''}{cluster.growthRate}%
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Opportunity:</span>
                  <span className={`font-semibold ${getOpportunityTextColor(cluster.opportunityScore)}`}>
                    {cluster.opportunityScore}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getOpportunityColor(cluster.opportunityScore)}`}
                    style={{ width: `${cluster.opportunityScore}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Keywords ({cluster.keywords.length}):</p>
              <div className="flex flex-wrap gap-1.5">
                {cluster.keywords.slice(0, 6).map((keyword, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
                {cluster.keywords.length > 6 && (
                  <Badge variant="outline" className="text-xs">
                    +{cluster.keywords.length - 6} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default KeywordClusterMap;
