"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, MessageSquare, Plus, Trash2, Menu, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RagResponse } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    id: string;
    type: string;
    label: string;
    score: number;
  }>;
  timestamp: Date;
}

interface Thread {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  message_count: number;
}

export default function AskLexyBrainPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch threads on mount
  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    setIsLoadingThreads(true);
    try {
      const response = await fetch("/api/lexybrain/rag/threads");
      if (response.ok) {
        const data = await response.json();
        setThreads(data.threads || []);
      }
    } catch (err) {
      console.error("Failed to fetch threads:", err);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const loadThread = async (id: string) => {
    try {
      const response = await fetch(`/api/lexybrain/rag/threads/${id}`);
      if (!response.ok) throw new Error("Failed to load thread");

      const data = await response.json();
      setThreadId(id);
      setMessages(data.messages || []);
      setError(null);

      // Close sidebar on mobile after selecting
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    } catch (err) {
      console.error("Failed to load thread:", err);
      setError("Failed to load conversation");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/lexybrain/rag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId: threadId,
          message: input,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data: RagResponse = await response.json();

      // Update threadId if this was the first message
      if (!threadId) {
        setThreadId(data.threadId);
        // Refresh threads list to show new thread
        fetchThreads();
      }

      const assistantMessage: Message = {
        id: data.messageId,
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
      console.error("RAG request failed:", err);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setThreadId(null);
    setError(null);
    textareaRef.current?.focus();
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div
        className={cn(
          "border-r bg-background transition-all duration-300",
          isSidebarOpen ? "w-64" : "w-0",
          "lg:relative absolute inset-y-0 left-0 z-40 lg:z-0"
        )}
      >
        <div className={cn("flex h-full flex-col", !isSidebarOpen && "hidden")}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Recent Chats</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Threads List */}
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              {isLoadingThreads ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : threads.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => loadThread(thread.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      threadId === thread.id && "bg-accent"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">
                          {thread.title || "New conversation"}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatRelativeTime(thread.last_message_at)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* New Chat Button (Bottom of Sidebar) */}
          <div className="border-t p-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-background px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Ask LexyBrain</h1>
              <p className="text-sm text-muted-foreground">
                Your AI marketplace intelligence assistant
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:flex"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
          <div className="mx-auto max-w-3xl space-y-4 py-4">
            {messages.length === 0 && !isLoading && (
              <div className="flex h-full flex-col items-center justify-center space-y-4 py-12">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900">
                  <MessageSquare className="h-10 w-10 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-semibold">How can I help you today?</h2>
                  <p className="mt-2 text-muted-foreground">
                    Ask me about market trends, keywords, competitors, or any marketplace insights
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 w-full max-w-2xl mt-8">
                  {[
                    "What are trending keywords in vintage jewelry?",
                    "Show me market brief for handmade candles",
                    "Who are my competitors in the pet niche?",
                    "Explain this keyword: boho wedding decor",
                  ].map((suggestion, i) => (
                    <Card
                      key={i}
                      className="cursor-pointer p-4 transition-colors hover:bg-accent"
                      onClick={() => setInput(suggestion)}
                    >
                      <p className="text-sm">{suggestion}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] space-y-2 ${
                    message.role === "user"
                      ? "rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-primary-foreground"
                      : "space-y-3"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600">
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-sm font-medium">LexyBrain</span>
                    </div>
                  )}
                  <div
                    className={`${
                      message.role === "user"
                        ? "text-sm"
                        : "rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm prose prose-sm dark:prose-invert max-w-none"
                    }`}
                  >
                    {message.role === "user" ? (
                      message.content
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h2: ({ children }) => (
                            <h2 className="text-base font-semibold mt-4 mb-2 first:mt-0 text-foreground">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-semibold mt-3 mb-2 text-foreground">
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => (
                            <p className="mb-3 last:mb-0 text-foreground leading-relaxed">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="my-2 space-y-1 list-disc list-inside">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="my-2 space-y-1 list-decimal list-inside">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="text-foreground leading-relaxed">
                              {children}
                            </li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">
                              {children}
                            </strong>
                          ),
                          code: ({ children }) => (
                            <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Sources ({message.sources.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {message.sources.slice(0, 5).map((source) => (
                          <Badge
                            key={source.id}
                            variant="secondary"
                            className="gap-1 text-xs"
                          >
                            <span className="capitalize">{source.type}</span>
                            <Separator orientation="vertical" className="h-3" />
                            <span className="max-w-[150px] truncate">
                              {source.label}
                            </span>
                            <span className="text-muted-foreground">
                              {(source.score * 100).toFixed(0)}%
                            </span>
                          </Badge>
                        ))}
                        {message.sources.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{message.sources.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-sm font-medium">LexyBrain</span>
                  </div>
                  <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        Thinking...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t bg-background px-4 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask LexyBrain anything about marketplace trends, keywords, or insights..."
                className="min-h-[60px] max-h-[200px] resize-none"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-[60px] w-[60px] rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
