export type PromptTemplate<Input> = {
  id: string;
  version: string;
  purpose: string;
  system: string;
  buildUserMessage: (input: Input) => string;
  metadata?: Record<string, unknown>;
};

export type PromptTrace<Input> = {
  templateId: string;
  templateVersion: string;
  system: string;
  user: string;
  purpose: string;
  metadata?: Record<string, unknown>;
  input: Input;
};

function createTagOptimizerUserMessage(
  input: TagOptimizerPromptInput,
): string {
  const goals = input.goals?.length ? input.goals.join(", ") : "Improve listing visibility";
  const currentTags = input.currentTags?.length ? input.currentTags.join(", ") : "(none provided)";
  const attributes = input.attributes
    ? Object.entries(input.attributes)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join("; ")
    : "";

  return [
    `Listing title: ${input.listingTitle}`,
    `Market: ${input.market ?? "unspecified"}`,
    `Current tags: ${currentTags}`,
    attributes ? `Attributes: ${attributes}` : null,
    `Goals: ${goals}`,
    `Output JSON with keys: recommended_tags (array of strings), reasoning (string), confidence (0-1).`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type TagOptimizerPromptInput = {
  listingTitle: string;
  market?: string;
  currentTags?: string[];
  goals?: string[];
  attributes?: Record<string, string | number | null | undefined>;
};

export const TAG_OPTIMIZER_PROMPT: PromptTemplate<TagOptimizerPromptInput> = {
  id: "tag_optimizer.v1",
  version: "1.0.0",
  purpose: "Generate optimized marketplace tags with rationale",
  system:
    "You are LexyHub's tag optimization copilot. Return JSON only. Suggest concise, high-signal tags using the product context. Avoid duplicates.",
  buildUserMessage: createTagOptimizerUserMessage,
  metadata: {
    owner: "ai-platform",
    release: "sprint-2",
  },
};

export type VisualTagPromptInput = {
  caption: string;
  keywordHints?: string[];
  market?: string;
};

function createVisualTagMessage(input: VisualTagPromptInput): string {
  return [
    `Generated caption: ${input.caption}`,
    input.market ? `Market: ${input.market}` : null,
    input.keywordHints?.length
      ? `Keyword hints: ${input.keywordHints.join(", ")}`
      : "Keyword hints: none",
    `Return JSON with keys tags (array of {tag, confidence}) and summary (string).`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const VISUAL_TAG_PROMPT: PromptTemplate<VisualTagPromptInput> = {
  id: "visual_tag.v1",
  version: "1.0.0",
  purpose: "Extract structured tags from computer-vision caption output",
  system:
    "You are LexyHub's visual merchandiser. Analyse the caption and produce complementary e-commerce tags with confidences between 0 and 1.",
  buildUserMessage: createVisualTagMessage,
  metadata: {
    owner: "ai-platform",
    release: "sprint-2",
  },
};

export function buildPromptTrace<Input>(
  template: PromptTemplate<Input>,
  input: Input,
): PromptTrace<Input> {
  const userMessage = template.buildUserMessage(input);
  return {
    templateId: template.id,
    templateVersion: template.version,
    system: template.system,
    user: userMessage,
    purpose: template.purpose,
    metadata: template.metadata,
    input,
  };
}

export function buildChatMessages<Input>(
  template: PromptTemplate<Input>,
  input: Input,
): Array<{ role: "system" | "user"; content: string }> {
  return [
    { role: "system", content: template.system },
    { role: "user", content: template.buildUserMessage(input) },
  ];
}
