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
          className="flex-1 overflow-y-auto border-b border-border bg-black text-white"
        >
          <div className="space-y-4 px-4 py-6">
            {messages.length === 0 ? (
              <p className="text-sm text-white">
                LexyBrain is ready. Provide a keyword or market scenario to begin.
              </p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="space-y-1">
                  <span className="text-xs font-semibold uppercase">
                    {message.role === "assistant" ? "LexyBrain" : message.role === "system" ? "Context" : "You"}
                  </span>
                  <div className="rounded-lg border border-white bg-black px-3 py-2 text-sm leading-relaxed">
                    {message.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex items-center gap-2 text-sm">
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
