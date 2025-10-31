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
    const now = new Date().toISOString();
    return [
      {
        id: "demo-risk-appetite",
        label: "Default eCommerce",
        category: "Marketplace",
        appetite_level: "balanced",
        owner: "Operations",
        tolerance: { slaMinutes: 30, allowedViolations: 1 },
        notes: "Development fallback record when Supabase is not configured.",
        created_at: now,
        updated_at: now,
      },
      {
        id: "demo-risk-appetite-operations",
        label: "Fulfillment Continuity",
        category: "Logistics",
        appetite_level: "conservative",
        owner: "Operations",
        tolerance: { maxDailyDelayedOrders: 20 },
        notes: "Tracks tolerance for carrier and warehouse slowdowns.",
        created_at: now,
        updated_at: now,
      },
      {
        id: "demo-risk-appetite-security",
        label: "Customer Data Protection",
        category: "Security",
        appetite_level: "minimal",
        owner: "Security",
        tolerance: { allowedIncidentsPerQuarter: 0 },
        notes: "Sets baseline expectations for safeguarding customer data.",
        created_at: now,
        updated_at: now,
      },
      {
        id: "demo-risk-appetite-growth",
        label: "Revenue Operations",
        category: "Commercial",
        appetite_level: "balanced",
        owner: "Revenue",
        tolerance: { maxCheckoutErrorRate: 0.01 },
        notes: "Captures tolerance for growth experiments that impact checkout.",
        created_at: now,
        updated_at: now,
      },
    ];
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
    const now = new Date().toISOString();
    return [
      {
        id: "demo-risk-control",
        name: "Manual Etsy QA",
        description: "Placeholder control when Supabase is unavailable.",
        owner: "Risk",
        status: "draft",
        coverage_area: "Scraping",
        metadata: { cadence: "weekly" },
        created_at: now,
        updated_at: now,
      },
      {
        id: "demo-risk-control-fulfillment",
        name: "Carrier SLA Monitoring",
        description: "Review carrier performance dashboards and escalate breaches.",
        owner: "Operations",
        status: "active",
        coverage_area: "Logistics",
        metadata: { cadence: "daily", tooling: "Project44" },
        created_at: now,
        updated_at: now,
      },
      {
        id: "demo-risk-control-security",
        name: "Security Log Triage",
        description: "SOC reviews credential stuffing alerts and blocks offending IPs.",
        owner: "Security",
        status: "active",
        coverage_area: "Authentication",
        metadata: { cadence: "hourly", playbook: "SOC-07" },
        created_at: now,
        updated_at: now,
      },
      {
        id: "demo-risk-control-checkout",
        name: "Payment Gateway Failover",
        description: "Automatically reroute to backup gateway on error rate spikes.",
        owner: "Engineering",
        status: "active",
        coverage_area: "Checkout",
        metadata: { cadence: "continuous", coverage: "Stripe & Adyen" },
        created_at: now,
        updated_at: now,
      },
    ];
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
    const now = new Date();
    const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const iso = (date: Date) => date.toISOString();
    const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);
    return [
      {
        id: "demo-risk-entry-fulfillment-delays",
        title: "Carrier delays across West Coast",
        summary:
          "UPS and USPS lanes into the Bay Area are trending 36 hours behind SLA, risking late deliveries and churn.",
        status: "open",
        severity: "high",
        likelihood: "likely",
        impact: "major",
        owner: "Operations",
        appetite_id: "demo-risk-appetite-operations",
        control_id: "demo-risk-control-fulfillment",
        mitigation: "Shift volume to FedEx and notify customers of revised delivery windows.",
        follow_up: "Confirm new pickup commitments with carriers and monitor backlog burn-down daily.",
        raised_by: "system",
        raised_at: iso(daysFromNow(-10)),
        due_at: isoOrNull(daysFromNow(-1)),
        resolved_at: null,
        metadata: { fallback: true, category: "Fulfillment" },
        created_at: iso(daysFromNow(-10)),
        updated_at: iso(daysFromNow(-1)),
      },
      {
        id: "demo-risk-entry-payment-gateway",
        title: "Checkout payment gateway latency",
        summary: "Stripe primary region experiencing intermittent timeouts causing elevated checkout abandonment.",
        status: "mitigated",
        severity: "medium",
        likelihood: "possible",
        impact: "moderate",
        owner: "Engineering",
        appetite_id: "demo-risk-appetite-growth",
        control_id: "demo-risk-control-checkout",
        mitigation: "Fail over to backup gateway and enable checkout queueing banner.",
        follow_up: "Audit failover runbook with engineering leadership and update post-incident report.",
        raised_by: "oncall",
        raised_at: iso(daysFromNow(-5)),
        due_at: isoOrNull(daysFromNow(2)),
        resolved_at: isoOrNull(daysFromNow(-1)),
        metadata: { fallback: true, category: "Checkout" },
        created_at: iso(daysFromNow(-5)),
        updated_at: iso(daysFromNow(0)),
      },
      {
        id: "demo-risk-entry-security-bruteforce",
        title: "Credential stuffing spike",
        summary:
          "Automated login attempts from known botnets are bypassing basic rate limits and hitting 3x normal volume.",
        status: "in-progress",
        severity: "high",
        likelihood: "likely",
        impact: "major",
        owner: "Security",
        appetite_id: "demo-risk-appetite-security",
        control_id: "demo-risk-control-security",
        mitigation: "Deploy adaptive MFA challenge for high-risk IP ranges and coordinate with CDN for blocks.",
        follow_up: "Ship permanent device fingerprinting update to authentication service.",
        raised_by: "soc",
        raised_at: iso(daysFromNow(-3)),
        due_at: isoOrNull(daysFromNow(1)),
        resolved_at: null,
        metadata: { fallback: true, category: "Security" },
        created_at: iso(daysFromNow(-3)),
        updated_at: iso(daysFromNow(0)),
      },
      {
        id: "demo-risk-entry-pricing-errors",
        title: "Catalog pricing discrepancy",
        summary:
          "Marketplace catalog import applied outdated currency exchange leading to underpriced vintage listings.",
        status: "open",
        severity: "medium",
        likelihood: "possible",
        impact: "moderate",
        owner: "Merchandising",
        appetite_id: "demo-risk-appetite",
        control_id: "demo-risk-control",
        mitigation: "Pause affected imports and reprice impacted SKUs based on latest FX rates.",
        follow_up: "Add validation step in ingestion workflow to confirm FX timestamp freshness.",
        raised_by: "merch_ops",
        raised_at: iso(daysFromNow(-7)),
        due_at: isoOrNull(daysFromNow(3)),
        resolved_at: null,
        metadata: { fallback: true, category: "Merchandising" },
        created_at: iso(daysFromNow(-7)),
        updated_at: iso(daysFromNow(-2)),
      },
      {
        id: "demo-risk-entry-chargebacks",
        title: "Chargeback spike on vintage goods",
        summary:
          "Chargebacks on high-value vintage items doubled week-over-week following social media promotion.",
        status: "open",
        severity: "medium",
        likelihood: "possible",
        impact: "major",
        owner: "Finance",
        appetite_id: "demo-risk-appetite-growth",
        control_id: "demo-risk-control-checkout",
        mitigation: "Increase manual review for flagged orders and coordinate with seller success on documentation.",
        follow_up: "Publish updated seller guidance on proof-of-authenticity requirements.",
        raised_by: "finance_ops",
        raised_at: iso(daysFromNow(-2)),
        due_at: isoOrNull(daysFromNow(5)),
        resolved_at: null,
        metadata: { fallback: true, category: "Finance" },
        created_at: iso(daysFromNow(-2)),
        updated_at: iso(daysFromNow(0)),
      },
    ];
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
