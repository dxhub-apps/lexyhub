"use client";

import { useEffect, type ReactNode } from "react";
import { PostHogProvider } from "posthog-js/react";
import posthog from "posthog-js";
import { usePathname, useSearchParams } from "next/navigation";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

let initialized = false;

function ensureInit() {
  if (initialized) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  if (!POSTHOG_KEY) {
    return;
  }
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    autocapture: true,
    persistence: "memory",
  });
  initialized = true;
}

export function LexyPosthogProvider({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    ensureInit();
  }, []);

  useEffect(() => {
    if (!initialized || !POSTHOG_KEY) {
      return;
    }
    const query = searchParams?.toString() ?? "";
    const fallbackUrl = query ? `${pathname}?${query}` : pathname;
    posthog.capture("$pageview", {
      $current_url: typeof window !== "undefined" ? window.location.href : fallbackUrl,
    });
  }, [pathname, searchParams]);

  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
