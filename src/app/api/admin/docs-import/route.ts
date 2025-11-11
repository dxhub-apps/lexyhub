/**
 * API Endpoint: Import Documentation from URL
 * POST /api/admin/docs-import
 *
 * Admin-only endpoint that converts a public help/documentation URL
 * into a clean, ingestion-ready Markdown document for the LexyBrain RAG corpus.
 *
 * Request Body:
 * - url: string (required) - The URL to fetch and convert
 * - marketplace: "auto" | "etsy" | "amazon" | "other" (optional, defaults to "auto")
 * - topicOverride: string (optional) - Custom topic slug/filename
 *
 * Response:
 * - success: boolean
 * - markdown?: string - The formatted markdown content
 * - suggestedPath?: string - Suggested file path under docs/public
 * - stage?: string - Stage where error occurred
 * - message?: string - Error or success message
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, AdminAccessError } from "@/lib/backoffice/auth";
import {
  importAndFormatUrlToMarkdown,
  type ImportUrlInput,
} from "@/lib/docs/import-from-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    await requireAdminUser();

    // Parse request body
    let body: ImportUrlInput;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          stage: "validate",
          message: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.url || typeof body.url !== "string") {
      return NextResponse.json(
        {
          success: false,
          stage: "validate",
          message: "Missing or invalid 'url' field",
        },
        { status: 400 }
      );
    }

    // Validate marketplace if provided
    if (
      body.marketplace &&
      !["auto", "etsy", "amazon", "other"].includes(body.marketplace)
    ) {
      return NextResponse.json(
        {
          success: false,
          stage: "validate",
          message:
            "Invalid marketplace. Must be one of: auto, etsy, amazon, other",
        },
        { status: 400 }
      );
    }

    // Process the URL
    const result = await importAndFormatUrlToMarkdown({
      url: body.url,
      marketplace: body.marketplace,
      topicOverride: body.topicOverride,
    });

    // Return result
    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    console.error("Error in docs-import API:", error);
    return NextResponse.json(
      {
        success: false,
        stage: "server",
        message: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
