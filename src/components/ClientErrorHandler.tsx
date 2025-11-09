"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Global client-side error handler component
 * Sets up listeners for unhandled errors and promise rejections in the browser
 *
 * Add this to your root layout to capture all client-side errors
 */
export function ClientErrorHandler() {
  useEffect(() => {
    // Handle global uncaught errors
    const handleError = (event: ErrorEvent) => {
      console.error("Global error caught:", event.error);

      Sentry.captureException(event.error, {
        tags: {
          errorType: "uncaughtError",
          source: "window.onerror",
        },
        contexts: {
          event: {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        },
        level: "error",
      });
    };

    // Handle unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);

      Sentry.captureException(event.reason, {
        tags: {
          errorType: "unhandledRejection",
          source: "window.onunhandledrejection",
        },
        level: "error",
      });
    };

    // Add event listeners
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    // Cleanup
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // This component doesn't render anything
  return null;
}
