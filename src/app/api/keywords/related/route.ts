import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RelatedKeyword = {
  term: string;
  relationshipStrength: number;
  relationshipType: string;
  demand: number;
  competition: number;
  momentum: number;
  insight: string;
};

const RELATIONSHIP_TYPES = [
  "Complementary",
  "Alternative",
  "Sub-niche",
  "Broader Category",
  "Semantic Variant",
  "Intent-based",
  "Behavioral Pattern",
  "Purchase Journey",
  "Problem-Solution",
  "Feature-focused"
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  let keyword = "unknown";
  let market = "us";
  let limit = 10;

  try {
    const body = await request.json();
    keyword = body.keyword || "unknown";
    market = body.market || "us";
    limit = body.limit || 10;

    if (!keyword) {
      return NextResponse.json(
        { error: "Keyword is required" },
        { status: 400 }
      );
    }

    // Use OpenAI to generate intelligent related keywords
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert e-commerce and marketplace analyst specializing in keyword research and user intent analysis.

Your task is to identify related keywords that represent:
1. Complementary products (what customers buy together)
2. Alternative searches (different ways to find the same thing)
3. Sub-niches and variations
4. Broader or narrower categories
5. Intent-based variations (research, purchase, comparison)
6. Behavioral patterns (seasonal, trending, emerging)
7. Purchase journey stages (awareness, consideration, decision)
8. Problem-solution relationships
9. Feature-focused alternatives

For each related keyword, analyze:
- The relationship strength (0-100): how closely related it is based on user behavior
- The relationship type: which category it falls into
- Estimated demand (0-100): predicted search volume/interest
- Competition level (0-100): market saturation
- Momentum (0-100): growth trend
- A brief insight explaining why this keyword is related

Return EXACTLY ${limit} related keywords in JSON format.`
        },
        {
          role: "user",
          content: `Find ${limit} highly relevant keywords related to "${keyword}" in the ${market.toUpperCase()} market.

Focus on untapped opportunities and keywords that reveal user intent patterns that aren't obvious.

Return a JSON array with this exact structure:
[
  {
    "term": "exact keyword phrase",
    "relationshipStrength": 85,
    "relationshipType": "Complementary",
    "demand": 75,
    "competition": 45,
    "momentum": 68,
    "insight": "Brief explanation of the relationship and opportunity"
  }
]

Only return the JSON array, no other text.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the AI response
    let relatedKeywords: RelatedKeyword[];
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      relatedKeywords = JSON.parse(cleanContent);

      // Validate and ensure we have the right number
      if (!Array.isArray(relatedKeywords)) {
        throw new Error("Response is not an array");
      }

      // Ensure each keyword has all required fields
      relatedKeywords = relatedKeywords.slice(0, limit).map((kw, index) => ({
        term: kw.term || `related keyword ${index + 1}`,
        relationshipStrength: Math.max(0, Math.min(100, kw.relationshipStrength || 50)),
        relationshipType: RELATIONSHIP_TYPES.includes(kw.relationshipType)
          ? kw.relationshipType
          : RELATIONSHIP_TYPES[Math.floor(Math.random() * RELATIONSHIP_TYPES.length)],
        demand: Math.max(0, Math.min(100, kw.demand || 50)),
        competition: Math.max(0, Math.min(100, kw.competition || 50)),
        momentum: Math.max(0, Math.min(100, kw.momentum || 50)),
        insight: kw.insight || "Related keyword with potential opportunity",
      }));

      // Sort by relationship strength
      relatedKeywords.sort((a, b) => b.relationshipStrength - a.relationshipStrength);

    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw content:", content);

      // Fallback to generated keywords if AI parsing fails
      relatedKeywords = generateFallbackKeywords(keyword, limit);
    }

    return NextResponse.json({
      keyword,
      market,
      relatedKeywords,
      count: relatedKeywords.length,
    });

  } catch (error: any) {
    console.error("Error generating related keywords:", error);

    // Provide fallback in case of any error
    const fallbackKeywords = generateFallbackKeywords(keyword, limit);

    return NextResponse.json({
      keyword: keyword,
      market: market,
      relatedKeywords: fallbackKeywords,
      count: fallbackKeywords.length,
      fallback: true,
      error: error.message,
    });
  }
}

function generateFallbackKeywords(baseKeyword: string, limit: number): RelatedKeyword[] {
  const variations = [
    `${baseKeyword} alternative`,
    `best ${baseKeyword}`,
    `${baseKeyword} for sale`,
    `cheap ${baseKeyword}`,
    `${baseKeyword} reviews`,
    `${baseKeyword} guide`,
    `how to choose ${baseKeyword}`,
    `${baseKeyword} comparison`,
    `top rated ${baseKeyword}`,
    `${baseKeyword} deals`,
  ];

  return variations.slice(0, limit).map((term, index) => ({
    term,
    relationshipStrength: Math.max(40, 90 - index * 5),
    relationshipType: RELATIONSHIP_TYPES[index % RELATIONSHIP_TYPES.length],
    demand: Math.floor(Math.random() * 40) + 40,
    competition: Math.floor(Math.random() * 40) + 30,
    momentum: Math.floor(Math.random() * 40) + 30,
    insight: `Related search term that users commonly explore when researching ${baseKeyword}.`,
  }));
}
