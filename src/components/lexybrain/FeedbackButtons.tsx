"use client";

/**
 * LexyBrain Feedback Buttons Component
 *
 * Allows users to submit feedback (thumbs up/down) on LexyBrain responses.
 * This feedback is collected for future model fine-tuning.
 */

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// =====================================================
// Types
// =====================================================

type FeedbackType = "positive" | "negative" | null;

interface FeedbackButtonsProps {
  responseId: string | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

// =====================================================
// Component
// =====================================================

export function FeedbackButtons({
  responseId,
  className,
  size = "sm",
  showLabel = false,
}: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Don't show feedback buttons if we don't have a responseId
  if (!responseId) {
    return null;
  }

  const handleFeedback = async (feedbackType: "positive" | "negative") => {
    // If clicking the same feedback, toggle it off
    if (feedback === feedbackType) {
      setFeedback(null);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/lexybrain/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          responseId,
          feedback: feedbackType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit feedback");
      }

      setFeedback(feedbackType);

      toast({
        title: "Thanks for your feedback!",
        description: "Your input helps improve LexyBrain.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to submit feedback:", error);

      toast({
        title: "Failed to submit feedback",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const iconSize = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }[size];

  const buttonSize = {
    sm: "h-7 px-2 text-xs",
    md: "h-8 px-3 text-sm",
    lg: "h-9 px-4 text-base",
  }[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLabel && (
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
      )}

      <div className="flex items-center gap-1">
        <Button
          variant={feedback === "positive" ? "default" : "ghost"}
          size="sm"
          className={cn(
            buttonSize,
            "transition-colors",
            feedback === "positive" && "bg-green-600 hover:bg-green-700"
          )}
          onClick={() => handleFeedback("positive")}
          disabled={isSubmitting}
          title="Helpful"
        >
          <ThumbsUp className={cn(iconSize, feedback === "positive" && "fill-current")} />
        </Button>

        <Button
          variant={feedback === "negative" ? "default" : "ghost"}
          size="sm"
          className={cn(
            buttonSize,
            "transition-colors",
            feedback === "negative" && "bg-red-600 hover:bg-red-700"
          )}
          onClick={() => handleFeedback("negative")}
          disabled={isSubmitting}
          title="Not helpful"
        >
          <ThumbsDown className={cn(iconSize, feedback === "negative" && "fill-current")} />
        </Button>
      </div>
    </div>
  );
}

// =====================================================
// Compact Variant (for inline use)
// =====================================================

export function FeedbackButtonsCompact({
  responseId,
  className,
}: {
  responseId: string | null | undefined;
  className?: string;
}) {
  return (
    <FeedbackButtons
      responseId={responseId}
      className={className}
      size="sm"
      showLabel={false}
    />
  );
}

// =====================================================
// With Label Variant (for standalone use)
// =====================================================

export function FeedbackButtonsWithLabel({
  responseId,
  className,
}: {
  responseId: string | null | undefined;
  className?: string;
}) {
  return (
    <FeedbackButtons
      responseId={responseId}
      className={className}
      size="md"
      showLabel={true}
    />
  );
}
