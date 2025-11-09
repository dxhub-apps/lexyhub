/**
 * Ask LexyBrain RAG - Prompt Builder
 *
 * Constructs prompts for RAG generation
 */

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import type { PromptConfig, RetrievalContext, ConversationHistory } from "./types";

// =====================================================
// Prompt Loading
// =====================================================

/**
 * Load system prompt from database
 */
export async function loadSystemPrompt(): Promise<string | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from('lexybrain_prompt_configs')
    .select('system_instructions')
    .eq('is_active', true)
    .eq('name', 'ask_lexybrain_system')
    .maybeSingle();

  return data?.system_instructions || null;
}

/**
 * Load capability-specific prompt from database
 */
export async function loadCapabilityPrompt(
  capability: string
): Promise<PromptConfig | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from('lexybrain_prompt_configs')
    .select('system_instructions, constraints')
    .eq('is_active', true)
    .eq('type', capability)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    system_instructions: data.system_instructions,
    constraints: (data.constraints as Record<string, unknown>) || {},
  };
}

// =====================================================
// Context Formatting
// =====================================================

/**
 * Format retrieved sources for prompt
 */
export function formatSources(sources: RetrievalContext[]): string {
  if (sources.length === 0) {
    return 'No specific data retrieved. Provide general guidance based on marketplace knowledge.';
  }

  const sections: string[] = [];

  sections.push(`Retrieved ${sources.length} relevant sources from LexyHub database:\n`);

  sources.forEach((source, index) => {
    const metadata = source.metadata;
    sections.push(
      `${index + 1}. [${source.source_type.toUpperCase()}] "${source.source_label}"`
    );

    if (source.source_type === 'keyword' && metadata) {
      const details: string[] = [];
      if (metadata.demand_index) details.push(`Demand: ${metadata.demand_index}`);
      if (metadata.competition_score)
        details.push(`Competition: ${metadata.competition_score}`);
      if (metadata.trend_momentum) details.push(`Trend: ${metadata.trend_momentum}%`);
      if (metadata.ai_opportunity_score)
        details.push(`Opportunity: ${metadata.ai_opportunity_score}`);

      if (details.length > 0) {
        sections.push(`   ${details.join(', ')}`);
      }
    }

    sections.push(`   Similarity: ${(source.similarity_score * 100).toFixed(1)}%`);
    sections.push(`   Scope: ${source.owner_scope}\n`);
  });

  return sections.join('\n');
}

/**
 * Format conversation history for prompt
 */
export function formatHistory(history: ConversationHistory[]): string {
  if (history.length === 0) {
    return '';
  }

  const sections: string[] = ['=== CONVERSATION HISTORY ===\n'];

  history.forEach((msg) => {
    sections.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`);
  });

  return sections.join('\n');
}

// =====================================================
// Prompt Construction
// =====================================================

/**
 * Build complete RAG prompt
 */
export async function buildRagPrompt(params: {
  capability: string;
  retrievedContext: RetrievalContext[];
  conversationHistory: ConversationHistory[];
  userMessage: string;
}): Promise<string> {
  const sections: string[] = [];

  // 1. System instructions
  const systemPrompt = await loadSystemPrompt();
  if (systemPrompt) {
    sections.push('=== SYSTEM INSTRUCTIONS ===\n');
    sections.push(systemPrompt);
    sections.push('\n');
  }

  // 2. Capability-specific instructions
  const capabilityConfig = await loadCapabilityPrompt(params.capability);
  if (capabilityConfig) {
    sections.push('=== YOUR ROLE ===\n');
    sections.push(capabilityConfig.system_instructions);
    sections.push('\n');
  }

  // 3. Retrieved context
  sections.push('=== RETRIEVED CONTEXT ===\n');
  sections.push(formatSources(params.retrievedContext));
  sections.push('\n');

  // 4. Conversation history (if exists)
  if (params.conversationHistory.length > 0) {
    sections.push(formatHistory(params.conversationHistory));
    sections.push('\n');
  }

  // 5. Current user query
  sections.push('=== CURRENT USER QUERY ===\n');
  sections.push(params.userMessage);
  sections.push('\n');

  // 6. Final instruction
  sections.push('=== INSTRUCTIONS ===\n');
  sections.push(
    'Answer the query based on the retrieved context. Cite sources when referencing specific data.\n'
  );
  sections.push(
    'If the context is insufficient, clearly state what information is missing and suggest which LexyHub feature might help.\n'
  );
  sections.push('Be concise, actionable, and data-driven.\n');

  const prompt = sections.join('\n');

  logger.debug(
    {
      type: 'rag_prompt_built',
      capability: params.capability,
      context_count: params.retrievedContext.length,
      history_count: params.conversationHistory.length,
      prompt_length: prompt.length,
    },
    'RAG prompt constructed'
  );

  return prompt;
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}
