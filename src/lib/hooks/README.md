# React Hooks

Custom React hooks for LexyHub.

## useAILoadingMessages

Hook for displaying randomized loading messages during AI operations to reduce user anxiety.

### Features

- **Randomization**: Middle messages are randomized on each initialization
- **Fixed endpoints**: First and last messages always stay in position
- **Auto-cycling**: Messages cycle through at configurable intervals
- **Reusable**: Can be used with custom message arrays

### Basic Usage

```tsx
import { useAILoadingMessages } from "@/lib/hooks/useAILoadingMessages";

function MyComponent() {
  const [loading, setLoading] = useState(false);
  const { currentMessage } = useAILoadingMessages({ enabled: loading });

  return (
    <Button disabled={loading}>
      {loading ? currentMessage : "Generate Insight"}
    </Button>
  );
}
```

### Custom Messages

```tsx
const CUSTOM_MESSAGES = [
  "Starting operation...", // Always first
  "Processing data...",
  "Analyzing results...",
  "Optimizing output...",
  "Completing request...", // Always last
];

const { currentMessage } = useAILoadingMessages({
  messages: CUSTOM_MESSAGES,
  interval: 1500, // 1.5 seconds between messages
  enabled: isLoading,
});
```

### API

```typescript
useAILoadingMessages(options?: {
  messages?: string[];      // Custom messages (default: LEXYBRAIN_LOADING_MESSAGES)
  interval?: number;        // Milliseconds between updates (default: 2000)
  enabled?: boolean;        // Whether to cycle messages (default: true)
}): {
  currentMessage: string;   // Current message to display
  allMessages: string[];    // All randomized messages
  messageIndex: number;     // Current message index
  reset: () => void;        // Reset to first message
}
```

### Default Messages

The hook comes with 21 pre-defined LexyBrain messages:

1. "Spinning up LexyBrain engine..." (always first)
2. 19 randomized technical messages
3. "Emitting AI signal to frontend..." (always last)

### Implementation Details

- Uses **Fisher-Yates shuffle** for unbiased randomization
- Messages are randomized once per hook initialization (useMemo)
- Auto-stops at the last message (doesn't loop)
- Automatically resets when `enabled` becomes false

## useMarketplaces

Hook for fetching available marketplaces.

See component documentation for usage.
