// app/api/lexybrain/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { generateLexyBrainInsight } from "@/lib/lexybrain/service";

export async function POST(req: NextRequest) {
  try {
    // Get user from auth (or null for anon)
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    const body = await req.json();

    const prompt: string = body?.prompt;
    const context = body?.context || {};
    const system = body?.system;
    const maxTokens = body?.maxTokens;
    const temperature = body?.temperature;
    const topP = body?.topP;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing 'prompt'" },
        { status: 400 }
      );
    }

    const insight = await generateLexyBrainInsight({
      userId: user?.id ?? null,
      prompt,
      context,
      system,
      maxTokens,
      temperature,
      topP,
    });

    // Shape this response to match what your frontend already expects
    return NextResponse.json(
      {
        ok: true,
        completion: insight.completion,
        model: insight.model,
        usage: insight.usage,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "LexyBrain unavailable",
        detail:
          process.env.NODE_ENV === "development"
            ? String(err?.message || err)
            : undefined,
      },
      { status: 502 }
    );
  }
}
