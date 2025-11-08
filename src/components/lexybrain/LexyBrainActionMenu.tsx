"use client";

import { useState } from "react";
import { FileText, Radar, DollarSign, AlertTriangle, Loader2, Sparkles, ChevronDown, Network } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLexyBrainGenerate } from "@/lib/lexybrain/hooks";
import type { LexyBrainOutputType } from "@/lib/lexybrain-schemas";
import { FeedbackButtonsWithLabel } from "./FeedbackButtons";

type LexyBrainActionMenuProps = {
  keyword: string;
  market?: string;
  variant?: "button" | "dropdown";
  size?: "sm" | "default" | "lg";
};

export function LexyBrainActionMenu({
  keyword,
  market = "etsy",
  variant = "dropdown",
  size = "default",
}: LexyBrainActionMenuProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<LexyBrainOutputType | null>(null);
  const { generate, loading, error, data, metadata, reset } = useLexyBrainGenerate();

  const handleModuleClick = async (moduleType: LexyBrainOutputType) => {
    setActiveModule(moduleType);
    setDialogOpen(true);
    reset();

    // Generate insight for this keyword
    await generate({
      type: moduleType,
      market,
      niche_terms: [keyword],
    });
  };

  const modules = [
    {
      type: "market_brief" as LexyBrainOutputType,
      label: "Market Brief",
      icon: FileText,
      description: "Get market overview and opportunities",
    },
    {
      type: "radar" as LexyBrainOutputType,
      label: "Opportunity Radar",
      icon: Radar,
      description: "Analyze demand, competition, and profit",
    },
    {
      type: "ad_insight" as LexyBrainOutputType,
      label: "Ad Insights",
      icon: DollarSign,
      description: "Optimize ad budget allocation",
    },
    {
      type: "risk" as LexyBrainOutputType,
      label: "Risk Analysis",
      icon: AlertTriangle,
      description: "Identify market risks and threats",
    },
  ];

  if (variant === "button") {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Button
                key={module.type}
                variant="outline"
                size={size}
                onClick={() => handleModuleClick(module.type)}
                disabled={loading}
              >
                <Icon className="mr-2 h-4 w-4" />
                {module.label}
              </Button>
            );
          })}
          <Button variant="outline" size={size} asChild>
            <Link href={`/insights?keyword=${encodeURIComponent(keyword)}&market=${market}`}>
              <Network className="mr-2 h-4 w-4" />
              Neural Map
            </Link>
          </Button>
        </div>
        <ResultDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          moduleType={activeModule}
          loading={loading}
          error={error}
          data={data}
          metadata={metadata}
          keyword={keyword}
        />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} disabled={loading}>
            <Sparkles className="mr-2 h-4 w-4" />
            Run on LexyBrain
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>LexyBrain Modules</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <DropdownMenuItem
                key={module.type}
                onClick={() => handleModuleClick(module.type)}
                className="cursor-pointer"
              >
                <Icon className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">{module.label}</span>
                  <span className="text-xs text-muted-foreground">{module.description}</span>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/insights?keyword=${encodeURIComponent(keyword)}&market=${market}`}>
              <Network className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span className="font-medium">Neural Map</span>
                <span className="text-xs text-muted-foreground">Visualize keyword relationships</span>
              </div>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResultDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        moduleType={activeModule}
        loading={loading}
        error={error}
        data={data}
        metadata={metadata}
        keyword={keyword}
      />
    </>
  );
}

type ResultDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleType: LexyBrainOutputType | null;
  loading: boolean;
  error: string | null;
  data: any;
  metadata?: {
    responseId?: string | null;
    requestId?: string | null;
    latencyMs?: number;
    modelVersion?: string;
  };
  keyword: string;
};

function ResultDialog({
  open,
  onOpenChange,
  moduleType,
  loading,
  error,
  data,
  metadata,
  keyword,
}: ResultDialogProps) {
  const getModuleName = () => {
    switch (moduleType) {
      case "market_brief":
        return "Market Brief";
      case "radar":
        return "Opportunity Radar";
      case "ad_insight":
        return "Ad Insights";
      case "risk":
        return "Risk Analysis";
      default:
        return "LexyBrain Analysis";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            {getModuleName()}
          </DialogTitle>
          <DialogDescription>
            AI-powered insights for <strong>{keyword}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-sm text-muted-foreground">Analyzing with LexyBrain...</p>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {data && !loading && (
            <>
              {moduleType === "market_brief" && <MarketBriefDisplay data={data} responseId={metadata?.responseId} />}
              {moduleType === "radar" && <RadarDisplay data={data} responseId={metadata?.responseId} />}
              {moduleType === "ad_insight" && <AdInsightDisplay data={data} responseId={metadata?.responseId} />}
              {moduleType === "risk" && <RiskDisplay data={data} responseId={metadata?.responseId} />}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Result Display Components
// =====================================================

function MarketBriefDisplay({ data, responseId }: { data: any; responseId?: string | null }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{data.niche}</CardTitle>
              <Badge variant="secondary">Confidence: {Math.round((data.confidence || 0) * 100)}%</Badge>
            </div>
            <FeedbackButtonsWithLabel responseId={responseId} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Summary</h4>
            <p className="text-sm text-muted-foreground">{data.summary}</p>
          </div>

          {data.top_opportunities && data.top_opportunities.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-green-600">Top Opportunities</h4>
              <ul className="space-y-2">
                {data.top_opportunities.map((opp: any, i: number) => (
                  <li key={i} className="text-sm">
                    <strong>{opp.term}:</strong> {opp.why}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.risks && data.risks.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-red-600">Risks</h4>
              <ul className="space-y-2">
                {data.risks.map((risk: any, i: number) => (
                  <li key={i} className="text-sm">
                    <strong>{risk.term}:</strong> {risk.why}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.actions && data.actions.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Recommended Actions</h4>
              <ol className="space-y-1 list-decimal list-inside">
                {data.actions.map((action: string, i: number) => (
                  <li key={i} className="text-sm">
                    {action}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RadarDisplay({ data, responseId }: { data: any; responseId?: string | null }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Opportunity Scores</h3>
        <FeedbackButtonsWithLabel responseId={responseId} />
      </div>
      <div className="space-y-2">
        {data.items &&
          data.items.map((item: any, i: number) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-3">{item.term}</h4>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <ScoreBadge label="Demand" value={item.scores.demand} />
                  <ScoreBadge label="Momentum" value={item.scores.momentum} />
                  <ScoreBadge label="Competition" value={item.scores.competition} inverse />
                  <ScoreBadge label="Novelty" value={item.scores.novelty} />
                  <ScoreBadge label="Profit" value={item.scores.profit} />
                </div>
                <p className="text-sm text-muted-foreground">{item.comment}</p>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}

function AdInsightDisplay({ data, responseId }: { data: any; responseId?: string | null }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Budget Recommendations</h3>
        <FeedbackButtonsWithLabel responseId={responseId} />
      </div>

      {data.budget_split &&
        data.budget_split.map((item: any, i: number) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold">{item.term}</h4>
                <Badge variant="outline">${(item.daily_cents / 100).toFixed(2)}/day</Badge>
              </div>
              <div className="text-sm space-y-1">
                <p>Expected CPC: ${(item.expected_cpc_cents / 100).toFixed(2)}</p>
                <p>Expected Clicks: {item.expected_clicks}/day</p>
              </div>
            </CardContent>
          </Card>
        ))}

      {data.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Strategic Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{data.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RiskDisplay({ data, responseId }: { data: any; responseId?: string | null }) {
  const severityColors = {
    low: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950",
    medium: "text-orange-600 bg-orange-50 dark:bg-orange-950",
    high: "text-red-600 bg-red-50 dark:bg-red-950",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Risk Assessment</h3>
        <FeedbackButtonsWithLabel responseId={responseId} />
      </div>

      <div className="space-y-2">
        {data.alerts && data.alerts.length === 0 && (
          <Alert>
            <AlertDescription>No significant risks detected. Your market looks healthy!</AlertDescription>
          </Alert>
        )}

        {data.alerts &&
          data.alerts.map((alert: any, i: number) => (
            <Card key={i} className={severityColors[alert.severity as keyof typeof severityColors]}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold">{alert.term}</h4>
                  <Badge variant="outline" className="uppercase">
                    {alert.severity}
                  </Badge>
                </div>
                <p className="text-sm font-medium mb-2">{alert.issue}</p>
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Evidence:</strong> {alert.evidence}
                </p>
                <p className="text-sm">
                  <strong>Action:</strong> {alert.action}
                </p>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}

function ScoreBadge({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const score = Math.round(value * 100);
  const displayScore = inverse ? 100 - score : score;
  const color =
    displayScore >= 70
      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      : displayScore >= 40
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";

  return (
    <div className="text-center">
      <div className={`rounded px-2 py-1 ${color} text-xs font-semibold`}>{displayScore}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
