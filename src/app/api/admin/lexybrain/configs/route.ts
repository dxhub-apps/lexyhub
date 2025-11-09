/**
 * Admin API: LexyBrain Prompt Configuration Management
 *
 * UNIFIED: Now manages ai_prompts table (replaced lexybrain_prompt_configs)
 *
 * Allows admins to view and manage prompt configurations for LexyBrain.
 * Configurations control LLM behavior without code changes.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { requireAdminUser } from "@/lib/backoffice/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// Request Schemas
// =====================================================

const CreateConfigSchema = z.object({
  key: z.string().min(1).max(100),
  type: z.enum(["system", "capability", "template"]),
  content: z.string().min(10),
  config: z.record(z.unknown()).optional().default({}),
  is_active: z.boolean().optional().default(false),
});

const UpdateConfigSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1).max(100).optional(),
  content: z.string().min(10).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

// =====================================================
// GET - List all prompt configurations
// =====================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdminUser();

    const supabase = getSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase client unavailable" },
        { status: 503 }
      );
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const activeOnly = searchParams.get("active") === "true";

    // Build query
    let query = supabase
      .from("ai_prompts")
      .select("*")
      .order("type", { ascending: true })
      .order("updated_at", { ascending: false });

    if (type) {
      query = query.eq("type", type);
    }

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { type: "admin_lexybrain_configs_list_error", error: error.message },
        "Failed to list prompt configs"
      );
      return NextResponse.json(
        { error: "Failed to list configurations", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ configs: data || [] });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Admin access required")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    logger.error(
      { type: "admin_lexybrain_configs_list_exception", error: error instanceof Error ? error.message : String(error) },
      "Exception listing prompt configs"
    );

    Sentry.captureException(error, {
      tags: { feature: "lexybrain", component: "admin-configs" },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =====================================================
// POST - Create new prompt configuration
// =====================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    const { user } = await requireAdminUser();

    const supabase = getSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase client unavailable" },
        { status: 503 }
      );
    }

    // Parse and validate request
    const body = await request.json().catch(() => null);
    const parsed = CreateConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.errors },
        { status: 422 }
      );
    }

    const { key, type, content, config, is_active } = parsed.data;

    // If setting as active, deactivate other prompts with same key
    if (is_active) {
      await supabase
        .from("ai_prompts")
        .update({ is_active: false })
        .eq("key", key);
    }

    // Create new config
    const { data, error } = await supabase
      .from("ai_prompts")
      .insert({
        key,
        type,
        content,
        config,
        is_active,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      logger.error(
        { type: "admin_lexybrain_configs_create_error", error: error.message },
        "Failed to create prompt config"
      );
      return NextResponse.json(
        { error: "Failed to create configuration", details: error.message },
        { status: 500 }
      );
    }

    logger.info(
      {
        type: "admin_lexybrain_config_created",
        config_id: data.id,
        config_key: key,
        config_type: type,
        admin_user: user.id,
      },
      "LexyBrain prompt config created"
    );

    return NextResponse.json({ config: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Admin access required")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    logger.error(
      { type: "admin_lexybrain_configs_create_exception", error: error instanceof Error ? error.message : String(error) },
      "Exception creating prompt config"
    );

    Sentry.captureException(error, {
      tags: { feature: "lexybrain", component: "admin-configs" },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =====================================================
// PATCH - Update existing prompt configuration
// =====================================================

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    const { user } = await requireAdminUser();

    const supabase = getSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase client unavailable" },
        { status: 503 }
      );
    }

    // Parse and validate request
    const body = await request.json().catch(() => null);
    const parsed = UpdateConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.errors },
        { status: 422 }
      );
    }

    const { id, ...updates } = parsed.data;

    // Get existing config to check key
    const { data: existing } = await supabase
      .from("ai_prompts")
      .select("key")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // If setting as active, deactivate other configs with same key
    if (updates.is_active === true) {
      await supabase
        .from("ai_prompts")
        .update({ is_active: false })
        .eq("key", existing.key)
        .neq("id", id);
    }

    // Update config
    const { data, error } = await supabase
      .from("ai_prompts")
      .update({
        ...updates,
        updated_by: user.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error(
        { type: "admin_lexybrain_configs_update_error", config_id: id, error: error.message },
        "Failed to update prompt config"
      );
      return NextResponse.json(
        { error: "Failed to update configuration", details: error.message },
        { status: 500 }
      );
    }

    logger.info(
      {
        type: "admin_lexybrain_config_updated",
        config_id: id,
        admin_user: user.id,
        updates: Object.keys(updates),
      },
      "LexyBrain prompt config updated"
    );

    return NextResponse.json({ config: data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Admin access required")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    logger.error(
      { type: "admin_lexybrain_configs_update_exception", error: error instanceof Error ? error.message : String(error) },
      "Exception updating prompt config"
    );

    Sentry.captureException(error, {
      tags: { feature: "lexybrain", component: "admin-configs" },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE - Delete prompt configuration
// =====================================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    const { user } = await requireAdminUser();

    const supabase = getSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase client unavailable" },
        { status: 503 }
      );
    }

    // Get config ID from query params
    const configId = request.nextUrl.searchParams.get("id");

    if (!configId) {
      return NextResponse.json(
        { error: "Missing config ID" },
        { status: 400 }
      );
    }

    // Delete config
    const { error } = await supabase
      .from("ai_prompts")
      .delete()
      .eq("id", configId);

    if (error) {
      logger.error(
        { type: "admin_lexybrain_configs_delete_error", config_id: configId, error: error.message },
        "Failed to delete prompt config"
      );
      return NextResponse.json(
        { error: "Failed to delete configuration", details: error.message },
        { status: 500 }
      );
    }

    logger.info(
      {
        type: "admin_lexybrain_config_deleted",
        config_id: configId,
        admin_user: user.id,
      },
      "LexyBrain prompt config deleted"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Admin access required")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    logger.error(
      { type: "admin_lexybrain_configs_delete_exception", error: error instanceof Error ? error.message : String(error) },
      "Exception deleting prompt config"
    );

    Sentry.captureException(error, {
      tags: { feature: "lexybrain", component: "admin-configs" },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
