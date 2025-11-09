"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Loader2, User, Brain, Info } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type KeywordDetails = {
  id?: string;
  term: string;
  market: string;
  source: string;
  demand_index?: number | null;
  competition_score?: number | null;
  trend_momentum?: number | null;
  engagement_score?: number | null;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: string[];
};

export function KeywordChatTab({
  keyword,
  userId,
}: {
  keyword: KeywordDetails;
  userId: string | null;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add initial context message
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Hi! I'm LexyBrain, your AI market intelligence assistant. I'm ready to answer questions about &ldquo;${keyword.term}&rdquo; and help you understand this keyword opportunity.\n\nYou can ask me about:\n- Market trends and demand patterns\n- Competition and positioning strategies\n- Risk factors and compliance considerations\n- Product recommendations and next steps\n\nWhat would you like to know?`,
        timestamp: new Date(),
      },
    ]);
  }, [keyword.term]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !userId) {
      if (!userId) {
        toast({
          title: "Sign in required",
          description: "You must be signed in to chat with LexyBrain.",
          variant: "destructive",
        });
      }
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/lexybrain/rag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          message: input.trim(),
          context: {
            keyword: keyword.term,
            market: keyword.market,
            demand_index: keyword.demand_index,
            competition_score: keyword.competition_score,
            trend_momentum: keyword.trend_momentum,
            engagement_score: keyword.engagement_score,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to get response (${response.status})`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || data.response || data.message || "I couldn't generate a response. Please try again.",
        timestamp: new Date(),
        sources: data.sources || data.references || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Failed to get response from LexyBrain", err);
      toast({
        title: "Chat error",
        description: err?.message ?? "Failed to get response from LexyBrain",
        variant: "destructive",
      });

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <div className="space-y-1 flex-1">
              <CardTitle>Ask LexyBrain</CardTitle>
              <CardDescription>
                Chat with AI about &ldquo;{keyword.term}&rdquo; - ask anything about market trends,
                competition, risks, or recommendations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Chat Interface */}
      <Card>
        <CardContent className="p-0">
          {/* Messages */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <Brain className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[80%] rounded-lg p-4 space-y-2",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>

                  {message.sources && message.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">Sources:</span>
                      {message.sources.map((source, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-4 w-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <Brain className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything about this keyword..."
                disabled={loading || !userId}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={loading || !input.trim() || !userId}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {!userId && (
              <Alert className="mt-3">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Sign in to chat with LexyBrain and get personalized insights.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Example Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Example Questions</CardTitle>
          <CardDescription>
            Try asking LexyBrain about these topics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              "What are the main risks with this keyword?",
              "How can I differentiate from competitors?",
              "What's the best time to enter this market?",
              "Are there any compliance concerns?",
              "What related keywords should I target?",
              "How strong is the demand trend?",
            ].map((question, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="justify-start text-left h-auto whitespace-normal"
                onClick={() => setInput(question)}
                disabled={!userId}
              >
                <MessageSquare className="h-3 w-3 mr-2 flex-shrink-0" />
                <span className="text-xs">{question}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
