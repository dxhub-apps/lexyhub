import {
  LexyBrainProvider,
  LexyBrainProviderRequest,
  LexyBrainProviderResponse,
} from "./types";

const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = process.env.LEXYBRAIN_MODEL_ID;
const HF_URL = "https://router.huggingface.co/v1/chat/completions";

export class HuggingFaceProvider implements LexyBrainProvider {
  private token: string;
  private model: string;
  private url: string;

  constructor() {
    if (!HF_TOKEN) {
      throw new Error("HF_TOKEN is not set in environment variables");
    }

    if (!HF_MODEL) {
      throw new Error("LEXYBRAIN_MODEL_ID is not set in environment variables");
    }

    this.token = HF_TOKEN;
    this.model = HF_MODEL;
    this.url = HF_URL;

    console.log(`[HuggingFaceProvider] Initialized with model: ${this.model}`);
  }

  getProviderName(): string {
    return "HuggingFace";
  }

  async generate(request: LexyBrainProviderRequest): Promise<LexyBrainProviderResponse> {
    const { prompt, max_tokens, temperature, system } = request;

    console.log(`[HuggingFaceProvider] Generating completion`, {
      promptLength: prompt.length,
      maxTokens: max_tokens ?? 1024,
      temperature: temperature ?? 0.3,
      model: this.model,
    });

    const body = {
      model: this.model,
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

    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      const text = await res.text();

      if (!res.ok) {
        console.error(`[HuggingFaceProvider] HTTP ${res.status}:`, text.substring(0, 500));
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

      console.log(`[HuggingFaceProvider] Completion generated successfully`, {
        completionLength: completion.length,
        model: data.model || this.model,
      });

      return {
        completion,
        model: data.model || this.model,
      };
    } catch (error) {
      console.error(`[HuggingFaceProvider] Error:`, error);
      throw error;
    }
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    console.log(`[HuggingFaceProvider] Testing connection to ${this.url}`);

    try {
      const response = await this.generate({
        prompt: "Say 'hello' in one word",
        max_tokens: 10,
        temperature: 0.7,
      });

      return {
        success: true,
        message: "HuggingFace connection successful",
        details: {
          provider: "HuggingFace",
          model: response.model,
          completionLength: response.completion.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        details: {
          provider: "HuggingFace",
          errorType: error instanceof Error ? error.constructor.name : "Unknown",
        },
      };
    }
  }
}
