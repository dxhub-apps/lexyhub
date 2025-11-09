"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FeedbackModal } from "./FeedbackModal";

export function TopbarFeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
              aria-label="Send feedback"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Send feedback</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <FeedbackModal open={open} onOpenChange={setOpen} />
    </>
  );
}
