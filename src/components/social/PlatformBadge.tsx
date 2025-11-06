// src/components/social/PlatformBadge.tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Platform = "reddit" | "twitter" | "pinterest" | "tiktok" | "google_trends";

interface PlatformBadgeProps {
  platform: Platform;
  count?: number;
  className?: string;
}

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string; emoji: string }> = {
  reddit: {
    label: "Reddit",
    color: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400",
    emoji: "🔴",
  },
  twitter: {
    label: "Twitter",
    color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400",
    emoji: "🐦",
  },
  pinterest: {
    label: "Pinterest",
    color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400",
    emoji: "📌",
  },
  tiktok: {
    label: "TikTok",
    color: "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/30 dark:text-pink-400",
    emoji: "🎵",
  },
  google_trends: {
    label: "Google Trends",
    color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400",
    emoji: "📈",
  },
};

export function PlatformBadge({ platform, count, className }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform] || {
    label: platform,
    color: "bg-gray-100 text-gray-800 border-gray-300",
    emoji: "🔍",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium",
        config.color,
        className
      )}
    >
      <span className="mr-1">{config.emoji}</span>
      {config.label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 font-semibold">({count})</span>
      )}
    </Badge>
  );
}
