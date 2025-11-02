import type { SupabaseClient, User } from "@supabase/supabase-js";

import { env } from "@/lib/env";

function parseAllowlist(value: string | undefined): Set<string> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(/[,\n\r\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

const ADMIN_EMAIL_ALLOWLIST = parseAllowlist(env.LEXYHUB_ADMIN_EMAILS);

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

function booleanFromMetadata(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "admin";
  }
  return false;
}

function arrayContainsAdmin(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.some((item) => {
    const normalized = normalizeString(item);
    return normalized === "admin" || normalized === "administrator";
  });
}

function objectContainsAdmin(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (booleanFromMetadata(record.admin ?? record.is_admin ?? record.isAdmin)) {
    return true;
  }
  if (arrayContainsAdmin(record.roles ?? record.permissions)) {
    return true;
  }
  const role = normalizeString(record.role);
  if (role === "admin" || role === "administrator") {
    return true;
  }
  if (record.claims && objectContainsAdmin(record.claims)) {
    return true;
  }
  return false;
}

export function emailIsAllowlisted(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  if (ADMIN_EMAIL_ALLOWLIST.size === 0) {
    return false;
  }
  return ADMIN_EMAIL_ALLOWLIST.has(email.trim().toLowerCase());
}

export function metadataDeclaresAdmin(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (objectContainsAdmin(user.app_metadata)) {
    return true;
  }
  if (objectContainsAdmin(user.user_metadata)) {
    return true;
  }
  return false;
}

export function planGrantsAdmin(plan: string | null | undefined): boolean {
  const normalized = normalizeString(plan);
  if (!normalized) {
    return false;
  }
  return normalized === "admin";
}

export function isAdminUser(user: User | null | undefined, plan: string | null | undefined): boolean {
  if (!user) {
    return false;
  }

  if (emailIsAllowlisted(user.email)) {
    return true;
  }

  if (metadataDeclaresAdmin(user)) {
    return true;
  }

  return planGrantsAdmin(plan);
}

export async function fetchUserPlan(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<{ plan: string | null; momentum: string | null; quota: number | null }> {
  if (!supabase) {
    return { plan: null, momentum: null, quota: null };
  }

  const response = await supabase
    .from("user_profiles")
    .select("plan, momentum, ai_usage_quota")
    .eq("user_id", userId)
    .maybeSingle();

  if (response.error && response.error.code !== "PGRST116") {
    console.warn("Failed to load user profile for admin check", response.error.message);
    return { plan: null, momentum: null, quota: null };
  }

  const data = response.data ?? null;
  return {
    plan: data?.plan ?? null,
    momentum: data?.momentum ?? null,
    quota: data?.ai_usage_quota ?? null,
  };
}

export function shouldElevateToAdmin(
  user: User,
  currentPlan: string | null | undefined,
): boolean {
  if (emailIsAllowlisted(user.email)) {
    return true;
  }

  if (metadataDeclaresAdmin(user)) {
    return true;
  }

  return planGrantsAdmin(currentPlan);
}
