import { getSupabaseServerClient } from "@/lib/supabase-server";

export type RiskAppetite = {
  id: string;
  label: string;
  category: string | null;
  appetite_level: string;
  owner: string | null;
  tolerance: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RiskControl = {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  status: string;
  coverage_area: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type RiskRegisterEntry = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  severity: string;
  likelihood: string;
  impact: string;
  owner: string | null;
  appetite_id: string | null;
  control_id: string | null;
  mitigation: string | null;
  follow_up: string | null;
  raised_by: string | null;
  raised_at: string;
  due_at: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type SupabaseRow<T> = T & Record<string, unknown>;

function resolveClient() {
  return getSupabaseServerClient();
}

export async function listRiskAppetites(): Promise<RiskAppetite[]> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { data, error } = await client
    .from("risk_appetites")
    .select("id,label,category,appetite_level,owner,tolerance,notes,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load risk appetites: ${error.message}`);
  }

  return (data ?? []) as RiskAppetite[];
}

export async function createRiskAppetite(payload: Partial<RiskAppetite>): Promise<RiskAppetite> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const record = {
    label: payload.label,
    category: payload.category ?? null,
    appetite_level: payload.appetite_level ?? "balanced",
    owner: payload.owner ?? null,
    tolerance: payload.tolerance ?? {},
    notes: payload.notes ?? null,
  };

  const { data, error } = await client
    .from("risk_appetites")
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to create risk appetite: ${error.message}`);
  }

  return data as RiskAppetite;
}

export async function updateRiskAppetite(
  id: string,
  payload: Partial<RiskAppetite>,
): Promise<RiskAppetite> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const updates = {
    ...(payload.label !== undefined ? { label: payload.label } : {}),
    ...(payload.category !== undefined ? { category: payload.category } : {}),
    ...(payload.appetite_level !== undefined ? { appetite_level: payload.appetite_level } : {}),
    ...(payload.owner !== undefined ? { owner: payload.owner } : {}),
    ...(payload.tolerance !== undefined ? { tolerance: payload.tolerance } : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    updated_at: new Date().toISOString(),
  } satisfies Partial<SupabaseRow<RiskAppetite>>;

  const { data, error } = await client
    .from("risk_appetites")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to update risk appetite: ${error.message}`);
  }

  return data as RiskAppetite;
}

export async function deleteRiskAppetite(id: string): Promise<void> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { error } = await client.from("risk_appetites").delete().eq("id", id);
  if (error) {
    throw new Error(`Unable to delete risk appetite: ${error.message}`);
  }
}

export async function listRiskControls(): Promise<RiskControl[]> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { data, error } = await client
    .from("risk_controls")
    .select("id,name,description,owner,status,coverage_area,metadata,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load risk controls: ${error.message}`);
  }

  return (data ?? []) as RiskControl[];
}

export async function upsertRiskControl(payload: Partial<RiskControl>): Promise<RiskControl> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const record = {
    id: payload.id ?? undefined,
    name: payload.name,
    description: payload.description ?? null,
    owner: payload.owner ?? null,
    status: payload.status ?? "draft",
    coverage_area: payload.coverage_area ?? null,
    metadata: payload.metadata ?? {},
  };

  const query = client.from("risk_controls");
  const { data, error } = payload.id
    ? await query.update({ ...record, id: undefined }).eq("id", payload.id).select().single()
    : await query.insert(record).select().single();

  if (error) {
    throw new Error(`Unable to persist risk control: ${error.message}`);
  }

  return data as RiskControl;
}

export async function deleteRiskControl(id: string): Promise<void> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { error } = await client.from("risk_controls").delete().eq("id", id);
  if (error) {
    throw new Error(`Unable to delete risk control: ${error.message}`);
  }
}

export async function listRiskRegister(): Promise<RiskRegisterEntry[]> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { data, error } = await client
    .from("risk_register_entries")
    .select(
      "id,title,summary,status,severity,likelihood,impact,owner,appetite_id,control_id,mitigation,follow_up,raised_by,raised_at,due_at,resolved_at,metadata,created_at,updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load risk register: ${error.message}`);
  }

  return (data ?? []) as RiskRegisterEntry[];
}

export async function createRiskEntry(payload: Partial<RiskRegisterEntry>): Promise<RiskRegisterEntry> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const record = {
    title: payload.title,
    summary: payload.summary ?? null,
    status: payload.status ?? "open",
    severity: payload.severity ?? "medium",
    likelihood: payload.likelihood ?? "possible",
    impact: payload.impact ?? "moderate",
    owner: payload.owner ?? null,
    appetite_id: payload.appetite_id ?? null,
    control_id: payload.control_id ?? null,
    mitigation: payload.mitigation ?? null,
    follow_up: payload.follow_up ?? null,
    raised_by: payload.raised_by ?? "system",
    raised_at: payload.raised_at ?? new Date().toISOString(),
    due_at: payload.due_at ?? null,
    resolved_at: payload.resolved_at ?? null,
    metadata: payload.metadata ?? {},
  } satisfies Partial<SupabaseRow<RiskRegisterEntry>>;

  const { data, error } = await client
    .from("risk_register_entries")
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to create risk entry: ${error.message}`);
  }

  return data as RiskRegisterEntry;
}

export async function updateRiskEntry(
  id: string,
  payload: Partial<RiskRegisterEntry>,
): Promise<RiskRegisterEntry> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const updates = {
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.summary !== undefined ? { summary: payload.summary } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.severity !== undefined ? { severity: payload.severity } : {}),
    ...(payload.likelihood !== undefined ? { likelihood: payload.likelihood } : {}),
    ...(payload.impact !== undefined ? { impact: payload.impact } : {}),
    ...(payload.owner !== undefined ? { owner: payload.owner } : {}),
    ...(payload.appetite_id !== undefined ? { appetite_id: payload.appetite_id } : {}),
    ...(payload.control_id !== undefined ? { control_id: payload.control_id } : {}),
    ...(payload.mitigation !== undefined ? { mitigation: payload.mitigation } : {}),
    ...(payload.follow_up !== undefined ? { follow_up: payload.follow_up } : {}),
    ...(payload.raised_by !== undefined ? { raised_by: payload.raised_by } : {}),
    ...(payload.raised_at !== undefined ? { raised_at: payload.raised_at } : {}),
    ...(payload.due_at !== undefined ? { due_at: payload.due_at } : {}),
    ...(payload.resolved_at !== undefined ? { resolved_at: payload.resolved_at } : {}),
    ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
    updated_at: new Date().toISOString(),
  } satisfies Partial<SupabaseRow<RiskRegisterEntry>>;

  const { data, error } = await client
    .from("risk_register_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to update risk entry: ${error.message}`);
  }

  return data as RiskRegisterEntry;
}

export async function deleteRiskEntry(id: string): Promise<void> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { error } = await client.from("risk_register_entries").delete().eq("id", id);
  if (error) {
    throw new Error(`Unable to delete risk entry: ${error.message}`);
  }
}

export async function summarizeRiskRegister(): Promise<{
  total: number;
  open: number;
  mitigated: number;
  overdue: number;
}> {
  const entries = await listRiskRegister();
  const now = Date.now();
  const total = entries.length;
  const open = entries.filter((entry) => entry.status !== "closed").length;
  const mitigated = entries.filter((entry) => entry.status === "mitigated").length;
  const overdue = entries.filter((entry) => {
    if (!entry.due_at || entry.status === "closed") {
      return false;
    }
    return new Date(entry.due_at).getTime() < now;
  }).length;

  return { total, open, mitigated, overdue };
}
