import { env } from "../env";
import { buildChatMessages, buildPromptTrace, INTENT_CLASSIFIER_PROMPT, type IntentClassifierInput } from "./prompts";
import type { PromptTrace } from "./prompts";

export type IntentClassification = {
  intent: string;
  purchaseStage: string;
  persona: string;
  summary: string;
  confidence: number;
  model: string;
  trace: PromptTrace<IntentClassifierInput>;
  raw?: unknown;
};

function inferFromTerm(term: string): Pick<IntentClassification, "intent" | "purchaseStage" | "persona" | "summary" | "confidence"> {
  const normalized = term.toLowerCase();

  if (normalized.includes("ideas") || normalized.includes("inspiration")) {
    return {
      intent: "discovery",
      purchaseStage: "awareness",
      persona: "trend researcher",
      summary: "User is exploring inspiration and gathering ideas before shortlisting products.",
      confidence: 0.45,
    };
  }

  if (normalized.includes("buy") || normalized.includes("for sale") || normalized.includes("price")) {
    return {
      intent: "purchase",
      purchaseStage: "purchase",
      persona: "ready-to-buy shopper",
      summary: "Clear purchase language indicates transactional intent.",
      confidence: 0.55,
    };
  }

  if (normalized.includes("how to") || normalized.includes("tutorial")) {
    return {
      intent: "education",
      purchaseStage: "consideration",
      persona: "do-it-yourself maker",
      summary: "The user is looking to learn how to create or evaluate a product.",
      confidence: 0.48,
    };
  }

  if (normalized.includes("wholesale") || normalized.includes("bulk")) {
    return {
      intent: "wholesale",
      purchaseStage: "consideration",
      persona: "reseller",
      summary: "Wholesale intent suggests B2B persona evaluating supply.",
      confidence: 0.5,
    };
  }

  return {
    intent: "research",
    purchaseStage: "consideration",
    persona: "market analyst",
    summary: "Default classification when intent is ambiguous; assume comparative research.",
    confidence: 0.35,
  };
}

function extractJson(content: string): unknown {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[0]);
  } catch (error) {
    console.warn("Intent classifier JSON parse failed", error);
    return null;
  }
}

async function callOpenAI(
  input: IntentClassifierInput,
): Promise<Pick<IntentClassification, "intent" | "purchaseStage" | "persona" | "summary" | "confidence" | "model"> & {
  raw?: unknown;
}> {
  if (!env.OPENAI_API_KEY) {
    return { ...inferFromTerm(input.term), model: "deterministic-fallback" };
  }

  try {
    const messages = buildChatMessages(INTENT_CLASSIFIER_PROMPT, input);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI intent classifier failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content) as
      | {
          intent?: string;
          purchase_stage?: string;
          persona?: string;
          summary?: string;
          confidence?: number;
        }
      | null;

    if (!parsed) {
      throw new Error("Intent classifier missing JSON payload");
    }

    return {
      intent: parsed.intent ?? inferFromTerm(input.term).intent,
      purchaseStage: parsed.purchase_stage ?? "consideration",
      persona: parsed.persona ?? "general shopper",
      summary: parsed.summary ?? "Model did not provide a summary.",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.65,
      model: "gpt-4o-mini",
      raw: { payload, parsed },
    };
  } catch (error) {
    console.error("Intent classifier OpenAI call failed", error);
    return { ...inferFromTerm(input.term), model: "deterministic-fallback" };
  }
}

export async function classifyKeywordIntent(input: IntentClassifierInput): Promise<IntentClassification> {
  const trace = buildPromptTrace(INTENT_CLASSIFIER_PROMPT, input);
  const result = await callOpenAI(input);

  return {
    intent: result.intent,
    purchaseStage: result.purchaseStage,
    persona: result.persona,
    summary: result.summary,
    confidence: result.confidence,
    model: result.model,
    trace,
    raw: result.raw,
  };
}
