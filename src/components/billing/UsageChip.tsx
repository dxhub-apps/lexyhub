import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export type UsageChipProps = {
  label: string;
  used: number;
  limit: number;
  className?: string;
};

export function UsageChip({ label, used, limit, className = "" }: UsageChipProps): JSX.Element {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
  const variant = percentage >= 90 ? "destructive" : percentage >= 70 ? "default" : "secondary";

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={isUnlimited ? "outline" : variant} className="font-mono text-xs">
          {used}/{isUnlimited ? "∞" : limit}
        </Badge>
      </div>
      {!isUnlimited && (
        <Progress value={percentage} className="h-2" />
      )}
    </div>
  );
}
