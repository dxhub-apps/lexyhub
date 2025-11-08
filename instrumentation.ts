/**
 * Next.js Instrumentation Hook
 *
 * This file is required for Sentry to work properly with Next.js 14+.
 * It initializes Sentry on the server-side and edge runtime.
 *
 * The instrumentation hook runs once when the Next.js server starts.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */

export async function register() {
  // Initialize Sentry for Node.js server runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  // Initialize Sentry for Edge runtime
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Optional: Error handling for Server Components (Next.js 15+)
 *
 * Uncomment this function to capture errors from nested React Server Components
 * when using Next.js 15 or higher.
 */
/*
export async function onRequestError(
  err: Error,
  request: {
    path: string;
    method: string;
    headers: Headers;
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
    renderSource: string;
  }
) {
  // Import Sentry only when needed
  const Sentry = await import("@sentry/nextjs");

  Sentry.captureException(err, {
    level: "error",
    tags: {
      request_path: request.path,
      request_method: request.method,
      router_kind: context.routerKind,
      route_path: context.routePath,
      route_type: context.routeType,
      render_source: context.renderSource,
    },
  });
}
*/
