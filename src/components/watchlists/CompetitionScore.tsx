"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type CompetitionScoreProps = {
  score: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
};

export function CompetitionScore({
  score,
  size = "md",
  showLabel = true,
}: CompetitionScoreProps): JSX.Element {
  // Determine color based on score (lower is better)
  const getColor = (score: number): string => {
    if (score >= 80) return "bg-red-600";
    if (score >= 60) return "bg-orange-500";
    if (score >= 40) return "bg-yellow-500";
    if (score >= 20) return "bg-lime-500";
    return "bg-green-600";
  };

  const getLabel = (score: number): string => {
    if (score >= 80) return "Very High";
    if (score >= 60) return "High";
    if (score >= 40) return "Moderate";
    if (score >= 20) return "Low";
    return "Very Low";
  };

  const getTextColor = (score: number): string => {
    if (score >= 80) return "text-red-600";
    if (score >= 60) return "text-orange-600";
    if (score >= 40) return "text-yellow-600";
    if (score >= 20) return "text-lime-600";
    return "text-green-600";
  };

  const heights = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between gap-2">
        {showLabel && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Competition:</span>
            <Badge variant="outline" className={`text-xs ${getTextColor(score)}`}>
              {getLabel(score)}
            </Badge>
          </div>
        )}
        <span className={`text-xs font-semibold ${getTextColor(score)} ml-auto`}>
          {score}%
        </span>
      </div>
      <Progress
        value={score}
        className={`${heights[size]} ${getColor(score)}`}
      />
    </div>
  );
}

export default CompetitionScore;
