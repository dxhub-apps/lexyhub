"use server";

const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = process.env.LEXYBRAIN_MODEL_ID;
const HF_URL = "https://router.huggingface.co/v1/chat/completions";

if (!HF_TOKEN) {
  throw new Error("HF_TOKEN is not set");
}

if (!HF_MODEL) {
  throw new Error("LEXYBRAIN_MODEL_ID is not set");
}

type LexybrainParams = {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
};

export async function callLexybrainHFRouter(
  params: LexybrainParams
): Promise<{ completion: string; model: string }> {
  const { prompt, max_tokens, temperature, system } = params;

  const body = {
    model: HF_MODEL,
    stream: false,
    messages: [
      system
        ? { role: "system", content: system }
        : {
            role: "system",
            content:
              "You are LexyBrain, an AI that returns concise, strictly valid JSON with market, keyword, and product opportunity insights.",
          },
      { role: "user", content: prompt },
    ],
    max_tokens: max_tokens ?? 1024,
    temperature: temperature ?? 0.3,
  };

  const res = await fetch(HF_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HF router HTTP ${res.status}: ${text}`);
  }

  const data = JSON.parse(text) as {
    choices: { message: { content: string } }[];
    model: string;
  };

  const completion = data.choices?.[0]?.message?.content;
  if (!completion) {
    throw new Error("HF router: empty completion");
  }

  return { completion, model: data.model || HF_MODEL! };
}
