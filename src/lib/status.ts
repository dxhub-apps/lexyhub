import { headers } from "next/headers";
import os from "os";

import { env } from "./env";
import { getSupabaseServerClient } from "./supabase-server";

type StatusLevel = "operational" | "warning" | "critical";

type StatusMessage = {
  id: string;
  name: string;
  status: StatusLevel;
  message: string;
  details?: Record<string, unknown>;
};

type VariableStatus = {
  key: string;
  label: string;
  status: StatusLevel;
  message: string;
  preview: string;
  optional: boolean;
};

type StatusReport = {
  generatedAt: string;
  runtime: {
    node: string;
    platform: string;
    release: string;
    uptimeSeconds: number;
    region?: string;
  };
  environment: string;
  variables: VariableStatus[];
  apis: StatusMessage[];
  services: StatusMessage[];
  workers: StatusMessage[];
};

function maskValue(value: string | undefined | null): string {
  if (!value) {
    return "not set";
  }
  if (value.length <= 4) {
    return "••••";
  }
  return `${value.slice(0, 3)}…${value.slice(-3)}`;
}

const VARIABLE_DEFINITIONS: Array<{
  key: string;
  label: string;
  optional?: boolean;
  mask?: boolean;
  defaultValue?: string;
}> = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    label: "Supabase Project URL",
    optional: true,
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    label: "Supabase Anonymous Key",
    optional: true,
    mask: true,
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    label: "Supabase Service Role Key",
    optional: true,
    mask: true,
  },
  {
    key: "LEXYHUB_JWT_SECRET",
    label: "LexyHub JWT Secret",
    optional: false,
    mask: true,
    defaultValue: "change-me-change-me",
  },
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    optional: true,
    mask: true,
  },
];

function resolveVariableStatus(def: (typeof VARIABLE_DEFINITIONS)[number]): VariableStatus {
  const raw = process.env[def.key];
  const isPresent = typeof raw === "string" && raw.length > 0;
  const isDefault = isPresent && def.defaultValue && raw === def.defaultValue;

  let status: StatusLevel;
  let message: string;

  if (!isPresent) {
    status = def.optional ? "warning" : "critical";
    message = def.optional
      ? "Variable is not configured"
      : "Variable is required but missing";
  } else if (isDefault) {
    status = "warning";
    message = "Variable is using the fallback development value";
  } else {
    status = "operational";
    message = "Variable is configured";
  }

  return {
    key: def.key,
    label: def.label,
    status,
    message,
    preview: def.mask ? maskValue(raw) : raw ?? "not set",
    optional: Boolean(def.optional),
  };
}

async function checkDatabaseHealth(): Promise<StatusMessage> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return {
      id: "database",
      name: "Supabase Database",
      status: "warning",
      message: "Supabase credentials are not fully configured.",
    };
  }

  try {
    const { error } = await supabase
      .from("keywords")
      .select("id", { head: true, count: "exact" });

    if (error) {
      return {
        id: "database",
        name: "Supabase Database",
        status: "warning",
        message: `Connection established but query failed: ${error.message}`,
      };
    }

    return {
      id: "database",
      name: "Supabase Database",
      status: "operational",
      message: "Database connection successful",
    };
  } catch (error) {
    return {
      id: "database",
      name: "Supabase Database",
      status: "critical",
      message:
        error instanceof Error
          ? `Failed to reach Supabase: ${error.message}`
          : "Failed to reach Supabase due to an unknown error",
    };
  }
}

async function checkOpenAI(): Promise<StatusMessage> {
  const key = env.OPENAI_API_KEY;

  if (!key) {
    return {
      id: "openai",
      name: "OpenAI API",
      status: "warning",
      message: "OpenAI API key is not configured.",
    };
  }

  return {
    id: "openai",
    name: "OpenAI API",
    status: "operational",
    message: "API key detected. External status checks run at request time.",
  };
}

async function checkApiModule<T>(
  id: string,
  name: string,
  loader: () => Promise<T>,
  requiredMethods: Array<keyof T>,
): Promise<StatusMessage> {
  try {
    const apiModule = await loader();
    const missing = requiredMethods.filter(
      (method) => typeof (apiModule as Record<string, unknown>)[method as string] !== "function",
    );

    if (missing.length > 0) {
      return {
        id,
        name,
        status: "warning",
        message: `Missing handler implementations: ${missing.join(", ")}`,
      };
    }

    return {
      id,
      name,
      status: "operational",
      message: `Handlers available: ${requiredMethods.join(", ")}`,
    };
  } catch (error) {
    return {
      id,
      name,
      status: "critical",
      message:
        error instanceof Error
          ? `Unable to load API module: ${error.message}`
          : "Unable to load API module due to an unknown error",
    };
  }
}

export async function generateStatusReport(): Promise<StatusReport> {
  let runtimeHeaders: Headers | null = null;

  try {
    runtimeHeaders = headers();
  } catch (error) {
    runtimeHeaders = null;
  }

  const [
    database,
    openai,
    listingsApi,
    keywordsApi,
    embeddingWorker,
    trendAggregationWorker,
    intentClassificationWorker,
    clusterRebuildWorker,
  ] = await Promise.all([
    checkDatabaseHealth(),
    checkOpenAI(),
    checkApiModule(
      "listings-api",
      "Listings API",
      () => import("@/app/api/listings/route"),
      ["GET"],
    ),
    checkApiModule(
      "keywords-api",
      "Keyword Search API",
      () => import("@/app/api/keywords/search/route"),
      ["POST"],
    ),
    checkApiModule(
      "embed-missing-worker",
      "Embedding Backfill Worker",
      () => import("@/app/api/jobs/embed-missing/route"),
      ["POST"],
    ),
    checkApiModule(
      "trend-aggregation-worker",
      "Trend Aggregation Worker",
      () => import("@/app/api/jobs/trend-aggregation/route"),
      ["POST"],
    ),
    checkApiModule(
      "intent-classify-worker",
      "Intent Classification Worker",
      () => import("@/app/api/jobs/intent-classify/route"),
      ["POST"],
    ),
    checkApiModule(
      "rebuild-clusters-worker",
      "Cluster Rebuild Worker",
      () => import("@/app/api/jobs/rebuild-clusters/route"),
      ["POST"],
    ),
  ]);

  const region =
    runtimeHeaders?.get("x-vercel-ip-country") ?? runtimeHeaders?.get("x-vercel-region");

  return {
    generatedAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: os.platform(),
      release: os.release(),
      uptimeSeconds: Math.round(process.uptime()),
      region: region ?? undefined,
    },
    environment: process.env.NODE_ENV ?? "development",
    variables: VARIABLE_DEFINITIONS.map(resolveVariableStatus),
    apis: [listingsApi, keywordsApi],
    services: [database, openai],
    workers: [embeddingWorker, trendAggregationWorker, intentClassificationWorker, clusterRebuildWorker],
  };
}

export type { StatusReport, StatusMessage, StatusLevel, VariableStatus };
