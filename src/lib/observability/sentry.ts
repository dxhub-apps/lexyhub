import * as Sentry from "@sentry/nextjs";

export type ObservabilityContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
  user?: {
    id?: string;
    email?: string;
  };
  level?: Sentry.SeverityLevel;
};

function hasClient(): boolean {
  const hub = (Sentry as { getCurrentHub?: () => { getClient?: () => unknown } }).getCurrentHub?.();
  return Boolean(hub?.getClient?.());
}

function applyContext(scope: Sentry.Scope, context?: ObservabilityContext) {
  if (!context) {
    return;
  }

  if (context.tags) {
    scope.setTags(context.tags);
  }

  if (context.extra) {
    scope.setExtras(context.extra);
  }

  if (context.fingerprint) {
    scope.setFingerprint(context.fingerprint);
  }

  if (context.user) {
    scope.setUser(context.user);
  }

  if (context.level) {
    scope.setLevel(context.level);
  }
}

export function captureException(error: unknown, context?: ObservabilityContext): void {
  if (!hasClient()) {
    return;
  }

  Sentry.withScope((scope) => {
    applyContext(scope, context);
    Sentry.captureException(error);
  });
}

export function captureMessage(message: string, context?: ObservabilityContext): void {
  if (!hasClient()) {
    return;
  }

  Sentry.withScope((scope) => {
    applyContext(scope, context);
    Sentry.captureMessage(message);
  });
}

type AsyncHandler<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

type HandlerOptions = {
  name?: string;
  tags?: Record<string, string>;
};

export function withSentryRouteHandler<TArgs extends unknown[], TResult>(
  handler: AsyncHandler<TArgs, TResult>,
  options?: HandlerOptions,
): AsyncHandler<TArgs, TResult> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      captureException(error, {
        tags: {
          ...(options?.tags ?? {}),
          handler: options?.name ?? handler.name ?? "anonymous", 
        },
      });
      throw error;
    }
  };
}
