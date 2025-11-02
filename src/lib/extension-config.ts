import { env } from "./env";

type ExtensionConfig = {
  apiBaseUrl: string;
  allowUserTelemetryDefault: boolean;
};

function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }

  return false;
}

export function getExtensionConfig(): ExtensionConfig {
  return {
    apiBaseUrl: env.BROWSER_EXTENSION_API_BASE_URL ?? "",
    allowUserTelemetryDefault: coerceBoolean(env.BROWSER_EXTENSION_ALLOW_USER_TELEMETRY_DEFAULT),
  };
}
