"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import type { TagOptimizerResult } from "@/lib/tags/optimizer";

type TagOptimizerResponse = {
  result: TagOptimizerResult;
};

function parseTags(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function TagOptimizerForm(): JSX.Element {
  const [listingId, setListingId] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TagOptimizerResult | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        listingId: listingId.trim() ? listingId.trim() : undefined,
        tags: parseTags(tags),
      };
      const response = await fetch("/api/tags/health", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error ?? `Tag health check failed (${response.status})`);
      }
      const json = (await response.json()) as TagOptimizerResponse;
      setResult(json.result);
      toast({
        title: "Tag health updated",
        description: "See which tags deserve upgrades and replacements.",
        variant: "success",
      });
    } catch (error) {
      console.error("Tag optimizer request failed", error);
      toast({
        title: "Unable to score tags",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTagsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setTags(event.target.value);
  };

  const resetForm = () => {
    setListingId("");
    setTags("");
    setResult(null);
  };

  const getStatusIcon = (status: "excellent" | "good" | "caution" | "risky") => {
    switch (status) {
      case "excellent":
      case "good":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "caution":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "risky":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 0.8) return "text-success";
    if (score >= 0.6) return "text-warning";
    return "text-destructive";
  };

  return (
    <section className="surface-card form-card">
      <header>
        <h2>Tag health meter</h2>
        <p>Audit duplicated or low-demand tags, then unlock higher-performing substitutions backed by Lexy keyword intelligence.</p>
      </header>
      <form onSubmit={handleSubmit} className="form-grid" autoComplete="off">
        <div className="space-y-4">
          <label>
            <span className="font-medium flex items-center gap-2">
              Listing ID
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </span>
            <input
              value={listingId}
              onChange={(event) => setListingId(event.target.value)}
              placeholder="UUID from synced listing"
            />
            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>Link to a synced listing for enhanced tag context and recommendations</span>
            </p>
          </label>

          <label>
            <span className="font-medium flex items-center gap-2">
              Tags
              <span className="text-destructive">*</span>
            </span>
            <textarea
              rows={8}
              required
              value={tags}
              onChange={handleTagsChange}
              placeholder="handmade jewelry, boho necklace, gift for her, minimalist design"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>Separate tags with commas or new lines. Paste up to 13 tags for analysis.</span>
            </p>
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading} className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Scoring…" : "Score tag health"}
          </button>
          <button type="button" onClick={resetForm} disabled={loading}>
            Reset
          </button>
        </div>
      </form>
      {result ? (
        <div className="analysis-result">
          <section className="analysis-scorecard">
            <h3>Health overview</h3>
            <dl>
              <div>
                <dt>Health score</dt>
                <dd className={getHealthScoreColor(result.healthScore)}>
                  {(result.healthScore * 100).toFixed(0)}%
                </dd>
              </div>
              <div>
                <dt>Duplicates</dt>
                <dd className={result.duplicates.length > 0 ? "text-destructive" : ""}>
                  {result.duplicates.length}
                </dd>
              </div>
              <div>
                <dt>Low volume tags</dt>
                <dd className={result.lowVolumeTags.length > 0 ? "text-warning" : ""}>
                  {result.lowVolumeTags.length}
                </dd>
              </div>
            </dl>
          </section>
          <section className="analysis-attributes">
            <h3>Diagnostics</h3>
            {result.diagnostics.length ? (
              <ul className="space-y-3">
                {result.diagnostics.map((diagnostic) => (
                  <li key={diagnostic.tag} className="flex flex-col gap-2 p-4 bg-muted/30 rounded-md border-l-4" style={{
                    borderLeftColor: diagnostic.status === "excellent" || diagnostic.status === "good" ? "hsl(var(--success))" :
                                   diagnostic.status === "caution" ? "hsl(var(--warning))" : "hsl(var(--destructive))"
                  }}>
                    <div className="flex items-center justify-between gap-3">
                      <strong className="font-mono text-sm">{diagnostic.tag}</strong>
                      <span className="flex items-center gap-1.5">
                        {getStatusIcon(diagnostic.status)}
                        <span className="text-xs font-medium uppercase tracking-wide">{diagnostic.status}</span>
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">{diagnostic.message}</span>
                    {diagnostic.suggestion ? (
                      <span className="text-sm text-primary font-medium">→ Try: {diagnostic.suggestion}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No diagnostics were generated.</p>
            )}
          </section>
          <section className="analysis-fixes">
            <h3>Recommendations</h3>
            {result.recommendations.add.length || result.recommendations.replace.length ? (
              <ul>
                {result.recommendations.add.map((tag) => (
                  <li key={`add-${tag}`}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      <strong>Add</strong>
                    </div>
                    <span className="font-mono text-sm">{tag}</span>
                  </li>
                ))}
                {result.recommendations.replace.map((entry) => (
                  <li key={`${entry.from}-${entry.to}`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                      <strong>Replace <span className="font-mono">{entry.from}</span></strong>
                    </div>
                    <span className="font-mono text-sm">{entry.to}</span>
                    <span className="text-xs text-muted-foreground">{entry.reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">Your tag mix is already optimized.</p>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
