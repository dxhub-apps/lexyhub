/**
 * AI Loading Messages Hook
 *
 * Provides randomized loading messages to reduce user anxiety during long-running AI operations.
 * First and last messages are always fixed, middle messages are randomized.
 */

import { useState, useEffect, useCallback, useMemo } from "react";

// Default messages for LexyBrain AI generation
export const LEXYBRAIN_LOADING_MESSAGES = [
  "Spinning up LexyBrain engine...",
  "Calibrating model temperature...",
  "Parsing latent embeddings...",
  "Loading semantic weights into memory...",
  "Normalizing token distributions...",
  "Running coherence validation pass...",
  "Synchronizing attention layers...",
  "Computing cross-entropy deltas...",
  "Consolidating vector outputs...",
  "Running buyer intent prediction...",
  "Filtering noisy activations...",
  "Aggregating high-confidence signals...",
  "Compressing inference payload...",
  "Verifying entropy thresholds...",
  "Hashing insight cache...",
  "Serializing response tensors...",
  "Benchmarking output consistency...",
  "Injecting domain-specific heuristics...",
  "Performing context optimization...",
  "Finalizing structured response...",
  "Emitting AI signal to frontend...",
];

/**
 * Randomize the middle messages while keeping first and last fixed
 */
function randomizeMessages(messages: string[]): string[] {
  if (messages.length <= 2) {
    return [...messages];
  }

  const first = messages[0];
  const last = messages[messages.length - 1];
  const middle = messages.slice(1, -1);

  // Fisher-Yates shuffle for middle messages
  const shuffled = [...middle];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return [first, ...shuffled, last];
}

export interface UseAILoadingMessagesOptions {
  messages?: string[];
  interval?: number; // milliseconds between message updates
  enabled?: boolean; // whether to cycle through messages
}

export interface UseAILoadingMessagesReturn {
  currentMessage: string;
  allMessages: string[];
  messageIndex: number;
  reset: () => void;
}

/**
 * Hook for displaying randomized loading messages during AI operations
 *
 * @param options - Configuration options
 * @returns Current message, all messages, index, and reset function
 *
 * @example
 * ```tsx
 * const { currentMessage } = useAILoadingMessages({ enabled: isLoading });
 *
 * return (
 *   <Button disabled={isLoading}>
 *     {isLoading ? currentMessage : "Generate Insight"}
 *   </Button>
 * );
 * ```
 */
export function useAILoadingMessages(
  options: UseAILoadingMessagesOptions = {}
): UseAILoadingMessagesReturn {
  const {
    messages = LEXYBRAIN_LOADING_MESSAGES,
    interval = 2000,
    enabled = true,
  } = options;

  // Randomize messages once when hook is initialized or messages change
  const randomizedMessages = useMemo(() => randomizeMessages(messages), [messages]);

  const [messageIndex, setMessageIndex] = useState(0);

  // Reset to first message
  const reset = useCallback(() => {
    setMessageIndex(0);
  }, []);

  // Cycle through messages when enabled
  useEffect(() => {
    if (!enabled || randomizedMessages.length === 0) {
      return;
    }

    const timer = setInterval(() => {
      setMessageIndex((prev) => {
        // Stop at last message instead of looping
        if (prev >= randomizedMessages.length - 1) {
          return prev;
        }
        return prev + 1;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [enabled, interval, randomizedMessages.length]);

  // Reset when enabled changes to false
  useEffect(() => {
    if (!enabled) {
      reset();
    }
  }, [enabled, reset]);

  const currentMessage = randomizedMessages[messageIndex] || randomizedMessages[0] || "";

  return {
    currentMessage,
    allMessages: randomizedMessages,
    messageIndex,
    reset,
  };
}

/**
 * Simple utility to get a randomized message list
 * Useful when you just need a shuffled array without the hook
 */
export function getRandomizedMessages(messages: string[] = LEXYBRAIN_LOADING_MESSAGES): string[] {
  return randomizeMessages(messages);
}
