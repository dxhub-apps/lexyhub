import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getExtensionConfig } from "@/lib/extension-config";
import { allowUserTelemetryEnabled } from "@/lib/feature-flags";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { verifyToken } from "@/lib/tokens";

const baseEventFields = {
  keywordId: z.string().uuid(),
  keywordTerm: z.string().min(1).optional(),
  rawSourceId: z.string().uuid().optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(1024).optional(),
  metadata: z.record(z.any()).optional(),
  url: z.string().url().optional(),
} as const;

const searchEventSchema = z.object({
  type: z.literal("search"),
  ...baseEventFields,
  query: z.string().min(1),
  resultCount: z.number().int().nonnegative().optional(),
});

const viewListingEventSchema = z.object({
  type: z.literal("view_listing"),
  ...baseEventFields,
  listingId: z.string().uuid().optional(),
  listingExternalId: z.string().min(1).optional(),
  position: z.number().int().nonnegative().optional(),
});

const viewShopEventSchema = z.object({
  type: z.literal("view_shop"),
  ...baseEventFields,
  shopId: z.string().uuid().optional(),
  shopSlug: z.string().min(1).optional(),
  shopName: z.string().min(1).optional(),
});

const keywordEventSchema = z.discriminatedUnion("type", [
  searchEventSchema,
  viewListingEventSchema,
  viewShopEventSchema,
]);

const keywordEventRequestSchema = z.union([
  keywordEventSchema,
  z.array(keywordEventSchema).min(1),
]);

type KeywordEvent = z.infer<typeof keywordEventSchema>;

type KeywordEventRow = {
  keyword_id: string;
  event_type: string;
  listing_id?: string | null;
  raw_source_id?: string | null;
  occurred_at?: string;
  payload: Record<string, unknown>;
  notes?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return asRecord(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

function extractTelemetryPreference(settings: unknown): boolean | null {
  const record = asRecord(settings);
  if (!record) {
    return null;
  }

  const candidates: Array<Array<string>> = [
    ["features", "allow_user_telemetry"],
    ["privacy", "allow_user_telemetry"],
    ["allow_user_telemetry"],
  ];

  for (const path of candidates) {
    let cursor: unknown = record;
    for (const key of path) {
      if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
        cursor = undefined;
        break;
      }

      cursor = (cursor as Record<string, unknown>)[key];
    }

    if (typeof cursor === "boolean") {
      return cursor;
    }
  }

  return null;
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

function eventToRow(event: KeywordEvent): KeywordEventRow {
  const payload = sanitizePayload({
    keywordTerm: event.keywordTerm,
    metadata: event.metadata,
    query: event.type === "search" ? event.query : undefined,
    resultCount: event.type === "search" ? event.resultCount : undefined,
    listingExternalId:
      event.type === "view_listing" ? event.listingExternalId : undefined,
    position: event.type === "view_listing" ? event.position : undefined,
    shopSlug: event.type === "view_shop" ? event.shopSlug : undefined,
    shopName: event.type === "view_shop" ? event.shopName : undefined,
    url: event.url,
  });

  const row: KeywordEventRow = {
    keyword_id: event.keywordId,
    event_type: event.type,
    payload,
    notes: event.notes ?? null,
  };

  if (event.rawSourceId) {
    row.raw_source_id = event.rawSourceId;
  }

  if (event.occurredAt) {
    row.occurred_at = event.occurredAt;
  }

  if (event.type === "view_listing" && event.listingId) {
    row.listing_id = event.listingId;
  }

  return row;
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }

  return false;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = auth.slice("Bearer ".length);
  const payload = verifyToken(token);

  if (!payload?.sub || typeof payload.sub !== "string") {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = keywordEventRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event payload", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const events = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
  }

  const telemetryEnabled = await allowUserTelemetryEnabled({ supabase });
  if (!telemetryEnabled) {
    return NextResponse.json({ error: "Telemetry disabled" }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("settings")
    .eq("user_id", payload.sub)
    .maybeSingle();

  if (profileError && profileError.code !== "PGRST116") {
    return NextResponse.json(
      { error: `Unable to load user profile: ${profileError.message}` },
      { status: 500 },
    );
  }

  const extensionConfig = getExtensionConfig();
  const allowTelemetryFromProfile = extractTelemetryPreference(profile?.settings);
  const allowTelemetry =
    allowTelemetryFromProfile ?? extensionConfig.allowUserTelemetryDefault;

  if (!coerceBoolean(allowTelemetry)) {
    return NextResponse.json({ error: "Telemetry disabled" }, { status: 403 });
  }

  const rows = events.map(eventToRow);

  const { error: insertError } = await supabase
    .from("keyword_events")
    .insert(rows);

  if (insertError) {
    return NextResponse.json(
      { error: `Failed to persist keyword events: ${insertError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ inserted: rows.length }, { status: 201 });
}
