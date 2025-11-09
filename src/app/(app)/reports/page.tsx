"use client";

import { useCallback, useState } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MarketBrief {
  summary: string;
  top_niches?: Array<{ title: string; delta?: string }>;
  keyword_deltas?: Array<{ keyword: string; change: string }>;
  risk_summary?: string;
}

type ReportPeriod = "weekly" | "monthly";

export default function ReportsPage(): JSX.Element {
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [brief, setBrief] = useState<MarketBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBrief = useCallback(
    async (nextPeriod: ReportPeriod) => {
      setPeriod(nextPeriod);
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/lexybrain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability: "market_brief",
            metadata: {
              cadence: nextPeriod,
            },
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? `Failed to generate report (${response.status})`);
        }

        const payload = await response.json();
        const insight = payload?.insight ?? {};
        setBrief({
          summary: insight.summary ?? "LexyBrain report generated.",
          top_niches: insight.top_niches ?? insight.focus ?? [],
          keyword_deltas: insight.keyword_deltas ?? insight.changes ?? [],
          risk_summary: insight.risk_summary ?? insight.risk ?? null,
        });
      } catch (err) {
        console.error("Failed to generate brief", err);
        setError(err instanceof Error ? err.message : "Unable to generate LexyBrain brief.");
        setBrief(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-none">Reports</h1>
          <p className="mt-2 text-sm text-foreground">Automated LexyBrain briefs for weekly and monthly coverage.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={period === "weekly" ? "accent" : "outline"}
            onClick={() => void runBrief("weekly")}
            disabled={loading && period === "weekly"}
          >
            {loading && period === "weekly" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Weekly Brief
          </Button>
          <Button
            variant={period === "monthly" ? "accent" : "outline"}
            onClick={() => void runBrief("monthly")}
            disabled={loading && period === "monthly"}
          >
            {loading && period === "monthly" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Monthly Brief
          </Button>
        </div>
      </header>

      <section className="space-y-4 rounded-lg border border-border p-6">
        {!brief && !loading && !error && (
          <div className="flex items-center gap-3 text-sm">
            <FileText className="h-5 w-5" />
            Run a brief to see LexyBrain’s market summary.
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating LexyBrain brief…
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {brief && !loading && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold">Summary</h2>
              <p className="mt-2 text-sm leading-relaxed">{brief.summary}</p>
            </div>

            {brief.top_niches && brief.top_niches.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase">Top Niches</h3>
                <ul className="space-y-1 text-sm">
                  {brief.top_niches.map((niche, index) => (
                    <li key={`${niche.title}-${index}`} className="flex justify-between">
                      <span>{niche.title}</span>
                      {niche.delta && <span className="font-medium">{niche.delta}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {brief.keyword_deltas && brief.keyword_deltas.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase">Keyword Deltas</h3>
                <ul className="space-y-1 text-sm">
                  {brief.keyword_deltas.map((row, index) => (
                    <li key={`${row.keyword}-${index}`} className="flex justify-between">
                      <span>{row.keyword}</span>
                      <span className="font-medium">{row.change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {brief.risk_summary && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase">Risk Summary</h3>
                <p className="text-sm leading-relaxed">{brief.risk_summary}</p>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => void runBrief(period)}
              disabled={loading}
              className="inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
