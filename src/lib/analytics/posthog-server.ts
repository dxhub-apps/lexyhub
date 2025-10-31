import { PostHog } from "posthog-node";

import { env } from "../env";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!env.POSTHOG_API_KEY) {
    return null;
  }
  if (!client) {
    client = new PostHog(env.POSTHOG_API_KEY, {
      host: env.POSTHOG_HOST ?? "https://app.posthog.com",
    });
  }
  return client;
}

type CaptureOptions = {
  distinctId?: string;
  properties?: Record<string, unknown>;
};

export async function captureServerEvent(
  event: string,
  options: CaptureOptions = {},
): Promise<void> {
  const instance = getClient();
  if (!instance) {
    return;
  }

  instance.capture({
    event,
    distinctId: options.distinctId ?? "anonymous", 
    properties: options.properties,
  });

  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  const clientWithFlush = instance as PostHog & {
    flushAsync?: () => Promise<void>;
    flush?: (callback: () => void) => void;
  };

  if (typeof clientWithFlush.flushAsync === "function") {
    await clientWithFlush.flushAsync();
    return;
  }

  if (typeof clientWithFlush.flush === "function") {
    await new Promise<void>((resolve) => {
      clientWithFlush.flush?.(() => resolve());
    });
  }
}

export function shutdownPosthog(): Promise<void> {
  const instance = getClient();
  if (!instance) {
    return Promise.resolve();
  }
  const clientWithShutdown = instance as PostHog & {
    shutdownAsync?: () => Promise<void>;
    shutdown?: (timeoutMs?: number) => void;
  };

  if (typeof clientWithShutdown.shutdownAsync === "function") {
    return clientWithShutdown.shutdownAsync();
  }

  if (typeof clientWithShutdown.shutdown === "function") {
    clientWithShutdown.shutdown();
  }

  return Promise.resolve();
}
