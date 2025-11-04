import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let niche = "unknown";
  try {
    const body = await request.json();
    niche = body.niche || "unknown";
    const market = body.market || "us";

    if (!niche) {
      return NextResponse.json(
        { error: "Niche is required" },
        { status: 400 }
      );
    }

    // Use OpenAI to analyze the niche and generate comprehensive data
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert marketplace analyst specializing in niche market research and keyword analysis.

Your task is to analyze a given niche and provide comprehensive market intelligence including:
1. Total keywords in this niche (estimate)
2. Average demand and competition metrics
3. Market momentum trend
4. Top markets/regions
5. Top 20 keywords ranked by opportunity
6. Growth trends over time
7. Keyword clusters/subthemes
8. Market forecast
9. Actionable recommendations

Provide realistic, data-driven estimates based on market research principles.

Return response in JSON format only.`
        },
        {
          role: "user",
          content: `Analyze the "${niche}" niche in the ${market.toUpperCase()} market.

Provide a comprehensive analysis in this JSON structure:
{
  "overview": {
    "totalKeywords": number (estimated count of related keywords),
    "avgDemand": number (0-100),
    "avgCompetition": number (0-100),
    "momentum": "expanding" | "stable" | "cooling",
    "topMarkets": [{"market": "string", "share": number}]
  },
  "keywords": [
    {
      "term": "exact keyword",
      "demand": number (0-100),
      "competition": number (0-100),
      "opportunity": number (0-100),
      "momentum": number (0-100),
      "freshness": "emerging" | "stable" | "mature"
    }
  ],
  "trends": {
    "historical": [
      {"date": "2024-10", "demand": number, "competition": number}
    ],
    "topGrowing": [
      {"term": "keyword", "growthRate": number, "searchVolume": number, "socialMentions": number}
    ]
  },
  "clusters": [
    {
      "name": "cluster name",
      "keywords": ["term1", "term2"],
      "growthRate": number,
      "opportunityScore": number
    }
  ],
  "forecast": [
    {
      "cluster": "cluster name",
      "prediction": "expanding" | "cooling" | "volatile",
      "confidence": number (0-100)
    }
  ],
  "recommendations": {
    "opportunities": ["keyword1", "keyword2"],
    "phaseOut": ["keyword1", "keyword2"],
    "synonymGaps": ["keyword1", "keyword2"]
  }
}

Only return valid JSON, no other text.`
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the AI response
    let analysis;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw content:", content);

      // Fallback
      analysis = generateFallbackAnalysis(niche);
    }

    return NextResponse.json({
      niche,
      market,
      analysis,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Error analyzing niche:", error);

    return NextResponse.json({
      error: error.message || "Failed to analyze niche",
      niche: niche,
    }, { status: 500 });
  }
}

function generateFallbackAnalysis(niche: string) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    months.push({
      date: date.toISOString().slice(0, 7),
      demand: Math.floor(Math.random() * 30) + 50,
      competition: Math.floor(Math.random() * 20) + 40,
    });
  }

  return {
    overview: {
      totalKeywords: Math.floor(Math.random() * 500) + 200,
      avgDemand: Math.floor(Math.random() * 20) + 60,
      avgCompetition: Math.floor(Math.random() * 30) + 40,
      momentum: "expanding",
      topMarkets: [
        { market: "US", share: 45 },
        { market: "UK", share: 20 },
        { market: "Canada", share: 15 },
        { market: "Australia", share: 12 },
        { market: "Germany", share: 8 },
      ],
    },
    keywords: Array.from({ length: 20 }, (_, i) => ({
      term: `${niche} ${["ideas", "trends", "styles", "guide", "tips", "for sale", "wholesale", "bulk", "cheap", "best", "top rated", "handmade", "custom", "unique", "vintage", "modern", "classic", "premium", "luxury", "affordable"][i]}`,
      demand: Math.floor(Math.random() * 40) + 40,
      competition: Math.floor(Math.random() * 60) + 20,
      opportunity: Math.floor(Math.random() * 40) + 40,
      momentum: Math.floor(Math.random() * 40) + 30,
      freshness: ["emerging", "stable", "mature"][Math.floor(Math.random() * 3)],
    })),
    trends: {
      historical: months,
      topGrowing: Array.from({ length: 5 }, (_, i) => ({
        term: `trending ${niche} ${i + 1}`,
        growthRate: Math.floor(Math.random() * 50) + 30,
        searchVolume: Math.floor(Math.random() * 5000) + 1000,
        socialMentions: Math.floor(Math.random() * 1000) + 200,
      })),
    },
    clusters: [
      {
        name: "Materials & Supplies",
        keywords: [`${niche} materials`, `${niche} supplies`, `${niche} tools`],
        growthRate: 15,
        opportunityScore: 72,
      },
      {
        name: "Styles & Trends",
        keywords: [`${niche} styles`, `${niche} trends`, `modern ${niche}`],
        growthRate: 25,
        opportunityScore: 85,
      },
      {
        name: "Buyer Intent",
        keywords: [`buy ${niche}`, `${niche} for sale`, `${niche} shop`],
        growthRate: 10,
        opportunityScore: 65,
      },
    ],
    forecast: [
      {
        cluster: "Materials & Supplies",
        prediction: "expanding",
        confidence: 78,
      },
      {
        cluster: "Styles & Trends",
        prediction: "expanding",
        confidence: 85,
      },
      {
        cluster: "Buyer Intent",
        prediction: "stable",
        confidence: 70,
      },
    ],
    recommendations: {
      opportunities: [`premium ${niche}`, `eco-friendly ${niche}`, `${niche} kit`],
      phaseOut: [`cheap ${niche}`, `discount ${niche}`],
      synonymGaps: [`artisan ${niche}`, `boutique ${niche}`, `${niche} collection`],
    },
  };
}
