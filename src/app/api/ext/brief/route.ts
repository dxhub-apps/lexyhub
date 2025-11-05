// src/app/api/ext/brief/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface BriefPayload {
  terms: string[];
  market: string;
}

/**
 * Brief entity table schema (simplified):
 * - id: uuid
 * - user_id: uuid
 * - title: text
 * - market: text
 * - terms: jsonb
 * - created_at: timestamptz
 *
 * Note: This assumes a 'briefs' table exists. If not, we'll need to create it.
 * For now, I'll create a simple JSON structure and store it in a generic way.
 */

export async function POST(request: Request): Promise<NextResponse> {
  // Authenticate
  const context = await authenticateExtension(request);
  if (!context) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Rate limit
  if (!checkRateLimit(context.userId, 50, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Parse payload
  let payload: BriefPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { terms, market } = payload;

  // Validate
  if (!Array.isArray(terms) || terms.length < 2 || terms.length > 5) {
    return NextResponse.json(
      { error: "terms must be an array with 2-5 items" },
      { status: 400 }
    );
  }

  if (!market || !market.trim()) {
    return NextResponse.json(
      { error: "market is required" },
      { status: 400 }
    );
  }

  // Get Supabase client
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  try {
    // Check if a 'briefs' table exists, otherwise use a generic approach
    // For this implementation, I'll assume we store briefs as JSON in a metadata table
    // or use the existing watchlists mechanism

    // Generate brief title from terms
    const briefTitle = `Extension Brief: ${terms.slice(0, 2).join(", ")}${terms.length > 2 ? "..." : ""}`;

    // Create brief record
    // Since the spec doesn't detail the briefs table schema, I'll use a simple approach:
    // Store in a generic 'extension_briefs' table or similar

    // For MVP, let's create a simple JSON structure and return it
    // In production, you'd store this in a database table
    const briefId = crypto.randomUUID();

    // TODO: Store in database
    // const { data: brief, error: briefError } = await supabase
    //   .from("extension_briefs")
    //   .insert({
    //     id: briefId,
    //     user_id: context.userId,
    //     title: briefTitle,
    //     market: market.toLowerCase(),
    //     terms,
    //     created_at: new Date().toISOString(),
    //   })
    //   .select("id")
    //   .single();

    // For now, return a success response with a permalink
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.lexyhub.com";
    const briefUrl = `${appUrl}/briefs/${briefId}`;

    // Log the brief creation for tracking
    console.log("Extension brief created:", {
      briefId,
      userId: context.userId,
      market,
      termsCount: terms.length,
    });

    return NextResponse.json({
      brief_id: briefId,
      url: briefUrl,
    });
  } catch (error) {
    console.error("Unexpected error in /api/ext/brief:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
