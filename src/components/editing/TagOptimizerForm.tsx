"use client";

import { ChangeEvent, FormEvent, useState } from "react";

import { useToast } from "@/components/ui/ToastProvider";
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
  const { push } = useToast();

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
      push({
        title: "Tag health updated",
        description: "See which tags deserve upgrades and replacements.",
        tone: "success",
      });
    } catch (error) {
      console.error("Tag optimizer request failed", error);
      push({
        title: "Unable to score tags",
        description: error instanceof Error ? error.message : "Unknown error",
        tone: "error",
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

  return (
    <section className="surface-card form-card">
      <header>
        <h2>Tag health meter</h2>
        <p>Audit duplicated or low-demand tags, then unlock higher-performing substitutions backed by Lexy keyword intelligence.</p>
      </header>
      <form onSubmit={handleSubmit} className="form-grid" autoComplete="off">
        <label>
          Listing ID (optional)
          <input value={listingId} onChange={(event) => setListingId(event.target.value)} placeholder="UUID from synced listing" />
        </label>
        <label>
          Tags
          <textarea
            rows={6}
            required
            value={tags}
            onChange={handleTagsChange}
            placeholder="Use commas or new lines between tags"
          />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={loading}>
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
                <dd>{(result.healthScore * 100).toFixed(0)}%</dd>
              </div>
              <div>
                <dt>Duplicates</dt>
                <dd>{result.duplicates.length}</dd>
              </div>
              <div>
                <dt>Low volume tags</dt>
                <dd>{result.lowVolumeTags.length}</dd>
              </div>
            </dl>
          </section>
          <section className="analysis-attributes">
            <h3>Diagnostics</h3>
            {result.diagnostics.length ? (
              <ul>
                {result.diagnostics.map((diagnostic) => (
                  <li key={diagnostic.tag}>
                    <strong>{diagnostic.tag}</strong>
                    <span>{diagnostic.message}</span>
                    <span className={`analysis-pill analysis-pill--${diagnostic.status}`}>{diagnostic.status}</span>
                    {diagnostic.suggestion ? <em>Try: {diagnostic.suggestion}</em> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No diagnostics were generated.</p>
            )}
          </section>
          <section className="analysis-fixes">
            <h3>Recommendations</h3>
            {result.recommendations.add.length || result.recommendations.replace.length ? (
              <ul>
                {result.recommendations.add.map((tag) => (
                  <li key={`add-${tag}`}>
                    <strong>Add</strong>
                    <span>{tag}</span>
                  </li>
                ))}
                {result.recommendations.replace.map((entry) => (
                  <li key={`${entry.from}-${entry.to}`}>
                    <strong>Replace {entry.from}</strong>
                    <span>{entry.to}</span>
                    <em>{entry.reason}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Your tag mix is already optimized.</p>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
