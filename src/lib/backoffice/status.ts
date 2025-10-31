import { getSupabaseServerClient } from "@/lib/supabase-server";

export type HealthMetric = {
  id: string;
  category: string;
  metric_key: string;
  metric_label: string;
  metric_value: number | null;
  metric_unit: string | null;
  status: string;
  delta: number | null;
  trend: string | null;
  captured_at: string;
  extras: Record<string, unknown> | null;
};

export type CrawlerStatus = {
  id: string;
  source: string;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
  total_records: number | null;
  error_message: string | null;
  run_metadata: Record<string, unknown> | null;
  updated_at: string;
};

function resolveClient() {
  return getSupabaseServerClient();
}

export async function listHealthMetrics(): Promise<HealthMetric[]> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { data, error } = await client
    .from("system_health_metrics")
    .select(
      "id,category,metric_key,metric_label,metric_value,metric_unit,status,delta,trend,captured_at,extras",
    )
    .order("captured_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load health metrics: ${error.message}`);
  }

  return (data ?? []) as HealthMetric[];
}

export async function upsertHealthMetric(payload: Partial<HealthMetric>): Promise<HealthMetric> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const record = {
    id: payload.id ?? undefined,
    category: payload.category,
    metric_key: payload.metric_key,
    metric_label: payload.metric_label,
    metric_value: payload.metric_value ?? null,
    metric_unit: payload.metric_unit ?? null,
    status: payload.status ?? "ok",
    delta: payload.delta ?? null,
    trend: payload.trend ?? null,
    captured_at: payload.captured_at ?? new Date().toISOString(),
    extras: payload.extras ?? {},
  };

  const query = client.from("system_health_metrics");
  const { data, error } = payload.id
    ? await query.update({ ...record, id: undefined }).eq("id", payload.id).select().single()
    : await query.insert(record).select().single();

  if (error) {
    throw new Error(`Unable to persist health metric: ${error.message}`);
  }

  return data as HealthMetric;
}

export async function listCrawlerStatuses(): Promise<CrawlerStatus[]> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { data, error } = await client
    .from("crawler_statuses")
    .select("id,source,status,last_run_at,next_run_at,total_records,error_message,run_metadata,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load crawler statuses: ${error.message}`);
  }

  return (data ?? []) as CrawlerStatus[];
}

export async function upsertCrawlerStatus(payload: Partial<CrawlerStatus>): Promise<CrawlerStatus> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const record = {
    id: payload.id ?? undefined,
    source: payload.source,
    status: payload.status ?? "idle",
    last_run_at: payload.last_run_at ?? null,
    next_run_at: payload.next_run_at ?? null,
    total_records: payload.total_records ?? null,
    error_message: payload.error_message ?? null,
    run_metadata: payload.run_metadata ?? {},
    updated_at: payload.updated_at ?? new Date().toISOString(),
  };

  const query = client.from("crawler_statuses");
  const { data, error } = payload.id
    ? await query.update({ ...record, id: undefined }).eq("id", payload.id).select().single()
    : await query.insert(record).select().single();

  if (error) {
    throw new Error(`Unable to persist crawler status: ${error.message}`);
  }

  return data as CrawlerStatus;
}

export async function summarizeBackoffice(): Promise<{
  metrics: HealthMetric[];
  crawlers: CrawlerStatus[];
}> {
  const [metrics, crawlers] = await Promise.all([listHealthMetrics(), listCrawlerStatuses()]);
  return { metrics, crawlers };
}
