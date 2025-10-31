type Target = "client" | "server" | "edge";

export type SentryInitOptions = {
  dsn?: string;
  enabled: boolean;
  environment?: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  normalizeDepth: number;
  replaysOnErrorSampleRate: number;
  replaysSessionSampleRate: number;
  [key: string]: unknown;
};

type SampleRateEnv = {
  traces?: string;
  profiles?: string;
};

function parseSampleRate(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function resolveSampleRates(env: SampleRateEnv, fallback: { traces: number; profiles: number }) {
  return {
    tracesSampleRate: parseSampleRate(env.traces, fallback.traces),
    profilesSampleRate: parseSampleRate(env.profiles, fallback.profiles),
  };
}

function resolveEnvironment(): string | undefined {
  return (
    process.env.SENTRY_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    undefined
  );
}

export function buildSentryOptions(target: Target): SentryInitOptions {
  const publicDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const serverDsn = process.env.SENTRY_DSN;

  const dsn = target === "client" ? publicDsn || serverDsn : serverDsn || publicDsn;

  const rateEnv: SampleRateEnv = {
    traces:
      process.env.SENTRY_TRACES_SAMPLE_RATE ||
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    profiles:
      process.env.SENTRY_PROFILES_SAMPLE_RATE ||
      process.env.NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE,
  };

  const baseRates = resolveSampleRates(rateEnv, {
    traces: process.env.NODE_ENV === "production" ? 0.2 : 1,
    profiles: process.env.NODE_ENV === "production" ? 0.05 : 0,
  });

  const options: SentryInitOptions = {
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    environment: resolveEnvironment(),
    tracesSampleRate: baseRates.tracesSampleRate,
    profilesSampleRate: baseRates.profilesSampleRate,
    normalizeDepth: 7,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
  };

  return options;
}
