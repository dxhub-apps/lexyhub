// app/api/lexybrain/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { generateLexyBrainInsight } from "@/lib/lexybrain/service";

// Force Node.js runtime (not Edge) for proper fetch behavior and longer timeouts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds max for Vercel

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();
  console.log(`[lexybrain] Request received at ${new Date().toISOString()}`);

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

    console.log(`[lexybrain] Request details:`, {
      userId: user?.id ?? "anon",
      promptLength: prompt?.length ?? 0,
      hasContext: !!context,
      maxTokens,
      temperature,
    });

    if (!prompt || typeof prompt !== "string") {
      console.error(`[lexybrain] Invalid request: missing prompt`);
      return NextResponse.json(
        { error: "Missing 'prompt'" },
        { status: 400 }
      );
    }

    console.log(`[lexybrain] Calling generateLexyBrainInsight...`);

    const insight = await generateLexyBrainInsight({
      userId: user?.id ?? null,
      prompt,
      context,
      system,
      maxTokens,
      temperature,
      topP,
    });

    const requestDuration = Date.now() - requestStartTime;
    console.log(`[lexybrain] Request completed in ${requestDuration}ms`);

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
    const requestDuration = Date.now() - requestStartTime;
    console.error(`[lexybrain] Request failed after ${requestDuration}ms:`, err);

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
