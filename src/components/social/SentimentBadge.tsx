// src/components/social/SentimentBadge.tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SmilePlus, Meh, Frown } from "lucide-react";

interface SentimentBadgeProps {
  sentiment: number; // -1 to 1 range
  showLabel?: boolean;
  className?: string;
}

type SentimentType = "positive" | "neutral" | "negative";

function getSentimentType(sentiment: number): SentimentType {
  if (sentiment > 0.2) return "positive";
  if (sentiment < -0.2) return "negative";
  return "neutral";
}

const SENTIMENT_CONFIG: Record<
  SentimentType,
  {
    label: string;
    color: string;
    icon: typeof SmilePlus;
  }
> = {
  positive: {
    label: "Positive",
    color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400",
    icon: SmilePlus,
  },
  neutral: {
    label: "Neutral",
    color: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700/30 dark:text-gray-400",
    icon: Meh,
  },
  negative: {
    label: "Negative",
    color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400",
    icon: Frown,
  },
};

export function SentimentBadge({
  sentiment,
  showLabel = true,
  className,
}: SentimentBadgeProps) {
  const type = getSentimentType(sentiment);
  const config = SENTIMENT_CONFIG[type];
  const Icon = config.icon;
  const percentage = Math.round(sentiment * 100);

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium gap-1",
        config.color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {showLabel && config.label}
      {showLabel && (
        <span className="ml-0.5 text-[10px] opacity-75">
          ({percentage > 0 ? "+" : ""}{percentage}%)
        </span>
      )}
    </Badge>
  );
}
