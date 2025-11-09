"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { trackAnalyticsEvent, AnalyticsEvents } from "@/lib/analytics/tracking";
import { Loader2 } from "lucide-react";

type FeedbackType = "bug" | "idea" | "question" | "other";
type ImpactLevel = "low" | "medium" | "high";

type FeedbackModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const pathname = usePathname();
  const { toast } = useToast();

  const [type, setType] = useState<FeedbackType>("idea");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [impact, setImpact] = useState<ImpactLevel>("medium");
  const [includeContext, setIncludeContext] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() && !title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide either a title or message",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          title: title.trim() || undefined,
          message: message.trim() || undefined,
          impact,
          pageUrl: typeof window !== "undefined" ? window.location.href : pathname,
          appSection: pathname,
          includeContext,
          metadata: {
            screen: typeof window !== "undefined"
              ? {
                  width: window.screen.width,
                  height: window.screen.height,
                }
              : undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit feedback");
      }

      // Track analytics
      trackAnalyticsEvent(AnalyticsEvents.FEEDBACK_SUBMITTED, {
        type,
        impact,
        path: pathname,
        has_title: !!title.trim(),
        has_message: !!message.trim(),
      });

      toast({
        title: "Feedback Sent!",
        description: "Thank you for helping us improve LexyHub.",
      });

      // Reset form and close modal
      setType("idea");
      setTitle("");
      setMessage("");
      setImpact("medium");
      setIncludeContext(true);
      onOpenChange(false);
    } catch (error) {
      console.error("Feedback submission error:", error);
      toast({
        title: "Submission Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setType("idea");
    setTitle("");
    setMessage("");
    setImpact("medium");
    setIncludeContext(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Help us improve LexyHub by sharing your feedback, ideas, or
              reporting issues.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Feedback Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as FeedbackType)}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="idea">Feature Idea</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="Short summary of your feedback"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Describe your feedback in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={2000}
                required={!title.trim()}
              />
              <p className="text-xs text-muted-foreground">
                {message.length}/2000 characters
              </p>
            </div>

            {/* Impact Level */}
            <div className="space-y-2">
              <Label htmlFor="impact">Impact</Label>
              <Select
                value={impact}
                onValueChange={(value) => setImpact(value as ImpactLevel)}
              >
                <SelectTrigger id="impact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Nice to have</SelectItem>
                  <SelectItem value="medium">Medium - Important</SelectItem>
                  <SelectItem value="high">
                    High - Critical issue or valuable feature
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Include Context Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeContext"
                checked={includeContext}
                onCheckedChange={(checked) =>
                  setIncludeContext(checked === true)
                }
              />
              <Label
                htmlFor="includeContext"
                className="text-sm font-normal cursor-pointer"
              >
                Include technical information (browser, page URL, screen size)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Feedback"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
