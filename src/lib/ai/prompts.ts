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

export type IntentClassifierInput = {
  term: string;
  market?: string;
  source?: string;
  context?: string;
  signals?: Array<{ name: string; value: number }>;
};

function createIntentClassifierMessage(input: IntentClassifierInput): string {
  const contextLines = [
    `Keyword: ${input.term}`,
    input.market ? `Market: ${input.market}` : null,
    input.source ? `Source: ${input.source}` : null,
    input.context ? `Context: ${input.context}` : null,
    input.signals?.length
      ? `Signals: ${input.signals.map((signal) => `${signal.name}=${signal.value.toFixed(2)}`).join(", ")}`
      : null,
    "Return JSON with keys intent (string), purchase_stage (string), persona (string), summary (string), confidence (0-1).",
  ];

  return contextLines.filter(Boolean).join("\n");
}

export const INTENT_CLASSIFIER_PROMPT: PromptTemplate<IntentClassifierInput> = {
  id: "intent_classifier.v1",
  version: "1.0.0",
  purpose: "Classify commerce intent, persona, and funnel stage for a keyword",
  system:
    "You are LexyHub's intent intelligence analyst. Respond with JSON only. Determine user intent, persona, and purchase stage using e-commerce funnel terminology (awareness, consideration, purchase, retention).",
  buildUserMessage: createIntentClassifierMessage,
  metadata: {
    owner: "insights",
    release: "sprint-5",
  },
};

export type ClusterLabelInput = {
  keywords: string[];
  primaryIntent?: string;
  signals?: Array<{ name: string; value: number }>;
};

function buildClusterLabelMessage(input: ClusterLabelInput): string {
  return [
    `Members: ${input.keywords.join(", ")}`,
    input.primaryIntent ? `Primary intent: ${input.primaryIntent}` : null,
    input.signals?.length
      ? `Signals: ${input.signals.map((signal) => `${signal.name}=${signal.value.toFixed(2)}`).join(", ")}`
      : null,
    "Return JSON with keys label (string), description (string), confidence (0-1).",
  ]
    .filter(Boolean)
    .join("\n");
}

export const CLUSTER_LABEL_PROMPT: PromptTemplate<ClusterLabelInput> = {
  id: "cluster_labeler.v1",
  version: "1.0.0",
  purpose: "Provide a short label and description for a semantic keyword cluster",
  system:
    "You are LexyHub's ontology curator. Provide concise, marketplace-friendly cluster labels and descriptions. Respond with JSON only.",
  buildUserMessage: buildClusterLabelMessage,
  metadata: {
    owner: "insights",
    release: "sprint-5",
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
