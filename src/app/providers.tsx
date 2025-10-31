"use client";

import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "@sentry/nextjs";

import { LexyPosthogProvider } from "@/components/providers/PosthogProvider";

function ErrorFallback(): JSX.Element {
  return (
    <div role="alert" className="app-error-fallback">
      <h1>Something went wrong</h1>
      <p>We were unable to render this view. Our team has been notified.</p>
    </div>
  );
}

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <Suspense fallback={null}>
        <LexyPosthogProvider>{children}</LexyPosthogProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
