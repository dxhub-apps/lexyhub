/**
 * Admin API: LexyBrain Prompt Configuration Management
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
  name: z.string().min(1).max(100),
  type: z.enum(["market_brief", "radar", "ad_insight", "risk", "global"]),
  system_instructions: z.string().min(10),
  constraints: z.record(z.unknown()).optional().default({}),
  is_active: z.boolean().optional().default(false),
});

const UpdateConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  system_instructions: z.string().min(10).optional(),
  constraints: z.record(z.unknown()).optional(),
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
      .from("lexybrain_prompt_configs")
      .select("*")
      .order("type", { ascending: true })
      .order("created_at", { ascending: false });

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

    const { name, type, system_instructions, constraints, is_active } = parsed.data;

    // If setting as active, deactivate other configs of same type
    if (is_active) {
      await supabase
        .from("lexybrain_prompt_configs")
        .update({ is_active: false })
        .eq("type", type);
    }

    // Create new config
    const { data, error } = await supabase
      .from("lexybrain_prompt_configs")
      .insert({
        name,
        type,
        system_instructions,
        constraints,
        is_active,
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
        config_name: name,
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

    // Get existing config to check type
    const { data: existing } = await supabase
      .from("lexybrain_prompt_configs")
      .select("type")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // If setting as active, deactivate other configs of same type
    if (updates.is_active === true) {
      await supabase
        .from("lexybrain_prompt_configs")
        .update({ is_active: false })
        .eq("type", existing.type)
        .neq("id", id);
    }

    // Update config
    const { data, error } = await supabase
      .from("lexybrain_prompt_configs")
      .update(updates)
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
      .from("lexybrain_prompt_configs")
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
