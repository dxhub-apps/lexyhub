// src/components/social/MomentumIndicator.tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MomentumIndicatorProps {
  momentum: number; // percentage change
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

type MomentumType = "surge" | "cooling" | "stable";

function getMomentumType(momentum: number): MomentumType {
  if (momentum > 15) return "surge";
  if (momentum < -10) return "cooling";
  return "stable";
}

const MOMENTUM_CONFIG: Record<
  MomentumType,
  {
    label: string;
    color: string;
    icon: typeof TrendingUp;
    emoji: string;
  }
> = {
  surge: {
    label: "Surging",
    color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400",
    icon: TrendingUp,
    emoji: "🚀",
  },
  stable: {
    label: "Stable",
    color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400",
    icon: Minus,
    emoji: "📊",
  },
  cooling: {
    label: "Cooling",
    color: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400",
    icon: TrendingDown,
    emoji: "📉",
  },
};

const SIZE_CONFIG = {
  sm: {
    icon: "h-3 w-3",
    text: "text-xs",
    badge: "px-2 py-0.5",
  },
  md: {
    icon: "h-4 w-4",
    text: "text-sm",
    badge: "px-2.5 py-1",
  },
  lg: {
    icon: "h-5 w-5",
    text: "text-base",
    badge: "px-3 py-1.5",
  },
};

export function MomentumIndicator({
  momentum,
  showLabel = true,
  size = "md",
  className,
}: MomentumIndicatorProps) {
  const type = getMomentumType(momentum);
  const config = MOMENTUM_CONFIG[type];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;
  const formatted = momentum > 0 ? `+${momentum.toFixed(1)}%` : `${momentum.toFixed(1)}%`;

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium gap-1.5",
        config.color,
        sizeConfig.text,
        sizeConfig.badge,
        className
      )}
    >
      <span>{config.emoji}</span>
      <Icon className={sizeConfig.icon} />
      {showLabel && <span>{config.label}</span>}
      <span className="font-semibold">{formatted}</span>
    </Badge>
  );
}
