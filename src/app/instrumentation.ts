import * as Sentry from "@sentry/nextjs";

import { buildSentryOptions } from "../../sentry.options";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(buildSentryOptions("edge"));
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(buildSentryOptions("server"));
    // @ts-expect-error Sentry's OTEL shim ships without type declarations.
    await import("@sentry/nextjs/otel");
  }
}
