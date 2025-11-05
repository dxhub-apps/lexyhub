// src/app/api/ext/snapshot/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface SnapshotPayload {
  listing_url: string;
  market: string;
  listing_metadata: {
    title: string;
    price?: number;
    reviews?: number;
    seller_stats?: any;
    tags?: string[];
  };
  main_keyword: string;
  competitor_data?: any;
}

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
  if (!checkRateLimit(context.userId, 100, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Parse payload
  let payload: SnapshotPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  try {
    // Calculate difficulty score (simplified)
    const difficultyScore = calculateDifficulty(payload);
    const improvementHints = generateHints(payload);

    // Insert snapshot
    const { data, error } = await supabase
      .from("listing_snapshots")
      .insert({
        user_id: context.userId,
        listing_url: payload.listing_url,
        market: payload.market,
        listing_metadata: payload.listing_metadata,
        difficulty_score: difficultyScore,
        competitor_data: payload.competitor_data || {},
        improvement_hints: improvementHints,
        main_keyword: payload.main_keyword,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving snapshot:", error);
      return NextResponse.json(
        { error: "Failed to save snapshot" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      snapshot: data,
      difficulty_score: difficultyScore,
      improvement_hints: improvementHints,
    });
  } catch (error) {
    console.error("Unexpected error in /api/ext/snapshot:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function calculateDifficulty(payload: SnapshotPayload): number {
  // Simplified difficulty calculation
  // In production, this would compare to top competitors
  const metadata = payload.listing_metadata;

  let difficulty = 50; // baseline

  if (metadata.reviews && metadata.reviews < 10) {
    difficulty += 20; // Harder for new listings
  }

  if (metadata.price && metadata.price > 50) {
    difficulty -= 10; // Premium products may have less competition
  }

  return Math.max(0, Math.min(100, difficulty));
}

function generateHints(payload: SnapshotPayload): any {
  const hints = [];
  const metadata = payload.listing_metadata;

  if (!metadata.tags || metadata.tags.length < 5) {
    hints.push({
      type: "tags",
      message: "Add more relevant tags to increase visibility",
      priority: "high",
    });
  }

  if (metadata.reviews && metadata.reviews < 10) {
    hints.push({
      type: "social_proof",
      message: "Focus on getting more reviews to build trust",
      priority: "high",
    });
  }

  return hints;
}

export const runtime = "nodejs";
