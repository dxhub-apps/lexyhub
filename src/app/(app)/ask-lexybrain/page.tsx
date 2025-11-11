"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Format LexyBrain responses in a human-readable way
 * Handles line breaks, bullet points, and structured content
 */
function FormattedMessage({ content }: { content: string }): JSX.Element {
  // Try to detect and parse JSON responses (convert to readable format)
  try {
    const parsed = JSON.parse(content);

    // Handle market_brief format
    if (parsed.niche || parsed.summary || parsed.top_opportunities) {
      return (
        <div className="space-y-3">
          {parsed.niche && (
            <div>
              <strong className="font-semibold">Niche:</strong> {parsed.niche}
            </div>
          )}
          {parsed.summary && (
            <div>
              <strong className="font-semibold">Summary:</strong>
              <p className="mt-1">{parsed.summary}</p>
            </div>
          )}
          {parsed.top_opportunities && parsed.top_opportunities.length > 0 && (
            <div>
              <strong className="font-semibold">Top Opportunities:</strong>
              <ul className="mt-2 space-y-2">
                {parsed.top_opportunities.map((opp: any, i: number) => (
                  <li key={i} className="ml-4">
                    <span className="font-medium text-accent">{opp.term || "Opportunity"}</span>
                    {opp.why && <span className="text-muted-foreground"> — {opp.why}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parsed.risks && parsed.risks.length > 0 && (
            <div>
              <strong className="font-semibold">Risks:</strong>
              <ul className="mt-2 space-y-2">
                {parsed.risks.map((risk: any, i: number) => (
                  <li key={i} className="ml-4">
                    <span className="font-medium text-destructive">{risk.term || "Risk"}</span>
                    {risk.why && <span className="text-muted-foreground"> — {risk.why}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parsed.actions && parsed.actions.length > 0 && (
            <div>
              <strong className="font-semibold">Recommended Actions:</strong>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                {parsed.actions.map((action: string, i: number) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}
          {parsed.confidence !== undefined && (
            <div className="text-sm text-muted-foreground">
              Confidence: {Math.round(parsed.confidence * 100)}%
            </div>
          )}
        </div>
      );
    }

    // Handle keyword_insights format
    if (parsed.keyword_insights || parsed.market_brief) {
      return (
        <div className="space-y-4">
          {parsed.keyword_insights && (
            <div>
              <strong className="font-semibold">Keyword Insights:</strong>
              {parsed.keyword_insights.opportunities && parsed.keyword_insights.opportunities.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-medium">Opportunities:</div>
                  <ul className="mt-1 space-y-2">
                    {parsed.keyword_insights.opportunities.map((opp: any, i: number) => (
                      <li key={i} className="ml-4">
                        <span className="font-medium text-accent">{opp.keyword}</span>
                        {opp.market && <span className="text-xs text-muted-foreground"> ({opp.market})</span>}
                        {opp.metrics && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {opp.metrics.demand_index !== undefined && (
                              <span>Demand: {(opp.metrics.demand_index * 100).toFixed(1)}%</span>
                            )}
                            {opp.metrics.competition_score && opp.metrics.competition_score.similarity !== undefined && (
                              <span className="ml-3">Competition: {opp.metrics.competition_score.similarity}%</span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {parsed.keyword_insights.risks && parsed.keyword_insights.risks.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-medium">Risks:</div>
                  <ul className="mt-1 space-y-1">
                    {parsed.keyword_insights.risks.map((risk: any, i: number) => (
                      <li key={i} className="ml-4 text-destructive">{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {parsed.market_brief && (
            <div>
              <strong className="font-semibold">Market Brief:</strong>
              {parsed.market_brief.opportunities && parsed.market_brief.opportunities.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-medium">Opportunities:</div>
                  <ul className="mt-1 list-disc space-y-1 pl-6">
                    {parsed.market_brief.opportunities.map((opp: string, i: number) => (
                      <li key={i}>{opp}</li>
                    ))}
                  </ul>
                </div>
              )}
              {parsed.market_brief.risks && parsed.market_brief.risks.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-medium">Risks:</div>
                  <ul className="mt-1 list-disc space-y-1 pl-6">
                    {parsed.market_brief.risks.map((risk: string, i: number) => (
                      <li key={i}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Fallback for other JSON: pretty print it
    return <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(parsed, null, 2)}</pre>;
  } catch {
    // Not JSON, format as regular text
  }

  // Format regular text with better readability
  const lines = content.split('\n');

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();

        // Skip empty lines
        if (!trimmedLine) {
          return <div key={index} className="h-2" />;
        }

        // Format bullet points
        if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          return (
            <div key={index} className="ml-4 flex gap-2">
              <span className="text-accent">•</span>
              <span>{trimmedLine.substring(1).trim()}</span>
            </div>
          );
        }

        // Format numbered lists
        if (/^\d+\./.test(trimmedLine)) {
          return (
            <div key={index} className="ml-4">
              {trimmedLine}
            </div>
          );
        }

        // Format headers (lines ending with :)
        if (trimmedLine.endsWith(':') && trimmedLine.length < 100) {
          return (
            <div key={index} className="mt-3 font-semibold first:mt-0">
              {trimmedLine}
            </div>
          );
        }

        // Regular paragraph
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}

export default function AskLexyBrainPage(): JSX.Element {
  const searchParams = useSearchParams();
  const initialKeyword = useMemo(() => searchParams.get("keyword") ?? "", [searchParams]);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialKeyword
      ? [
          {
            id: "intro",
            role: "system",
            content: `Context locked on keyword: ${initialKeyword}`,
          },
        ]
      : []
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: uniqueId(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/lexybrain/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          capability: "keyword_insights",
          context: initialKeyword
            ? {
                keywordTerms: [initialKeyword],
                marketplaces: ["us"],
              }
            : undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error?.message ?? payload.message ?? `Request failed (${response.status})`);
      }

      const payload = await response.json();
      const insightText = Array.isArray(payload?.messages)
        ? payload.messages[payload.messages.length - 1]?.content ?? "LexyBrain responded."
        : payload?.answer ?? payload?.insight?.summary ?? "LexyBrain responded.";

      const assistantMessage: ChatMessage = {
        id: uniqueId(),
        role: "assistant",
        content: String(insightText),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("LexyBrain chat failed", err);
      setError(err instanceof Error ? err.message : "Ask LexyBrain is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }, [input, initialKeyword]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-6">
      <header>
        <h1 className="text-[28px] font-semibold leading-none">Ask LexyBrain</h1>
        <p className="mt-2 text-sm text-foreground">
          Conversational intelligence for any keyword or market question.
        </p>
      </header>

      <section className="flex flex-1 flex-col rounded-lg border border-border bg-background">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto border-b border-border bg-muted/30"
        >
          <div className="space-y-4 px-4 py-6">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                LexyBrain is ready. Provide a keyword or market scenario to begin.
              </p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="space-y-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    {message.role === "assistant" ? "LexyBrain" : message.role === "system" ? "Context" : "You"}
                  </span>
                  <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${
                    message.role === "assistant"
                      ? "border-accent/20 bg-accent/5 text-foreground"
                      : message.role === "system"
                      ? "border-muted-foreground/20 bg-muted/50 text-muted-foreground italic"
                      : "border-border bg-background text-foreground"
                  }`}>
                    <FormattedMessage content={message.content} />
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating answer…
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
          className="flex items-center gap-3 p-4"
        >
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about a keyword, market, or risk"
            className="h-12 flex-1 rounded-lg border border-border bg-background text-base"
            autoFocus
          />
          <Button type="submit" variant="accent" size="sm" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        {error && <p className="px-4 pb-4 text-sm text-destructive">{error}</p>}
      </section>
    </div>
  );
}

function uniqueId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
