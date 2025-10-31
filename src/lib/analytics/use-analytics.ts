"use client";

import { useCallback, useMemo } from "react";
import posthog from "posthog-js";

type AnalyticsProps = Record<string, unknown>;

type IdentifyProps = Record<string, unknown>;

function isEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const client = posthog as typeof posthog & { config?: { token?: string } };
  return Boolean(client?.config?.token);
}

export function useAnalytics() {
  const capture = useCallback((event: string, properties?: AnalyticsProps) => {
    if (!isEnabled()) {
      return;
    }
    posthog.capture(event, properties);
  }, []);

  const identify = useCallback((id: string, properties?: IdentifyProps) => {
    if (!isEnabled()) {
      return;
    }
    posthog.identify(id, properties);
  }, []);

  const reset = useCallback(() => {
    if (!isEnabled()) {
      return;
    }
    posthog.reset();
  }, []);

  const analytics = useMemo(
    () => ({ capture, identify, reset } as const),
    [capture, identify, reset],
  );

  return analytics;
}
