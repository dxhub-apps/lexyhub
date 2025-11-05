import { getSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = 'force-dynamic';

export interface TrendingKeyword {
  term: string;
  adjusted_demand_index: number | null;
  deseasoned_trend_momentum: number | null;
  engagement_score: number | null;
  competition_score: number | null;
  seasonal_label: string | null;
  source?: "database" | "ai";
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const seasonalPeriodName = searchParams.get("periodName");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!seasonalPeriodName) {
      return NextResponse.json(
        { error: "periodName is required" },
        { status: 400 }
      );
    }

    // Fetch keywords that have this seasonal period as their current seasonal_label
    // and order by adjusted_demand_index to get the most trending ones
    const { data, error } = await supabase
      .from("keywords")
      .select(
        "term, adjusted_demand_index, deseasoned_trend_momentum, engagement_score, competition_score, seasonal_label"
      )
      .eq("seasonal_label", seasonalPeriodName)
      .not("adjusted_demand_index", "is", null)
      .order("adjusted_demand_index", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching trending keywords:", error);
      return NextResponse.json(
        { error: "Failed to fetch trending keywords" },
        { status: 500 }
      );
    }

    let keywords: TrendingKeyword[] = (data as TrendingKeyword[]).map(k => ({
      ...k,
      source: "database" as const
    }));

    // If we have fewer than 5 keywords from the database, enrich with AI suggestions
    if (keywords.length < 5) {
      try {
        const aiKeywords = await generateAIKeywords(seasonalPeriodName, limit - keywords.length);

        // Filter out AI keywords that already exist in database results
        const existingTerms = new Set(keywords.map(k => k.term.toLowerCase()));
        const uniqueAIKeywords = aiKeywords.filter(
          k => !existingTerms.has(k.term.toLowerCase())
        );

        keywords = [...keywords, ...uniqueAIKeywords] as TrendingKeyword[];
      } catch (aiError) {
        console.error("Error generating AI keywords:", aiError);
        // Continue with database keywords only if AI fails
      }
    }

    return NextResponse.json(keywords);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function generateAIKeywords(
  seasonalPeriodName: string,
  count: number
): Promise<TrendingKeyword[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log("ANTHROPIC_API_KEY not found, skipping AI keyword generation");
    return [];
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = `Generate ${count} trending e-commerce and shopping keywords related to "${seasonalPeriodName}".

Focus on:
- Product categories (e.g., "holiday decorations", "gift baskets")
- Shopping behaviors (e.g., "black friday deals", "last minute gifts")
- Seasonal needs (e.g., "winter coats", "summer dresses")
- Popular searches during this period

Return ONLY a JSON array of objects with this exact format:
[
  {
    "term": "keyword phrase",
    "adjusted_demand_index": 75.5,
    "deseasoned_trend_momentum": 12.3,
    "engagement_score": 65.0,
    "competition_score": 55.0
  }
]

Make the metrics realistic:
- adjusted_demand_index: 60-95 (higher = more demand)
- deseasoned_trend_momentum: -10 to 25 (positive = growing trend)
- engagement_score: 50-85 (higher = more engagement)
- competition_score: 40-80 (higher = more competition)

Return ONLY the JSON array, no other text.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const textContent = message.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    return [];
  }

  try {
    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("No JSON array found in AI response");
      return [];
    }

    const aiKeywords = JSON.parse(jsonMatch[0]);
    return aiKeywords.map((kw: any) => ({
      term: kw.term,
      adjusted_demand_index: kw.adjusted_demand_index,
      deseasoned_trend_momentum: kw.deseasoned_trend_momentum,
      engagement_score: kw.engagement_score,
      competition_score: kw.competition_score,
      seasonal_label: seasonalPeriodName,
      source: "ai" as const,
    }));
  } catch (parseError) {
    console.error("Error parsing AI response:", parseError);
    return [];
  }
}
