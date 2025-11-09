/**
 * Ask LexyBrain RAG - Type Definitions
 *
 * Shared types for RAG chat functionality
 */

import { z } from "zod";

// =====================================================
// Capabilities
// =====================================================

export const RAG_CAPABILITIES = [
  'keyword_insights',
  'market_brief',
  'competitor_intel',
  'keyword_explanation',
  'alert_explanation',
  'general_chat',
] as const;

export type RagCapability = typeof RAG_CAPABILITIES[number];

// =====================================================
// Request/Response Types
// =====================================================

export const RagRequestSchema = z.object({
  threadId: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(4000),
  capability: z.enum(RAG_CAPABILITIES).nullable().optional(),
  context: z.object({
    keywordIds: z.array(z.string().uuid()).max(50).optional(),
    watchlistIds: z.array(z.string().uuid()).max(10).optional(),
    listingIds: z.array(z.string().uuid()).max(20).optional(),
    alertIds: z.array(z.string().uuid()).max(10).optional(),
    shopUrl: z.string().url().optional(),
    marketplaces: z.array(z.string()).max(5).optional(),
    timeRange: z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    }).optional(),
  }).optional(),
  options: z.object({
    maxTokens: z.number().int().min(256).max(2048).optional(),
    temperature: z.number().min(0).max(1).optional(),
    language: z.string().length(2).optional(),
    planCode: z.string().optional(),
  }).optional(),
  meta: z.object({
    client: z.enum(['web', 'extension', 'api']).optional(),
    version: z.string().optional(),
  }).optional(),
});

export type RagRequest = z.infer<typeof RagRequestSchema>;

export interface RagResponse {
  threadId: string;
  messageId: string;
  answer: string;
  capability: string;
  sources: RagSource[];
  references: RagReferences;
  model: RagModelMetadata;
  flags: RagFlags;
}

export interface RagSource {
  id: string;
  type: 'keyword' | 'listing' | 'alert' | 'doc';
  label: string;
  score: number;
}

export interface RagReferences {
  keywords: string[];
  listings: string[];
  alerts: string[];
  docs: string[];
}

export interface RagModelMetadata {
  id: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  } | null;
  latencyMs: number;
}

export interface RagFlags {
  usedRag: boolean;
  fallbackToGeneric: boolean;
  insufficientContext: boolean;
}

// =====================================================
// Database Types
// =====================================================

export interface RagThread {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  message_count: number;
  metadata: Record<string, unknown>;
  archived: boolean;
}

export interface RagMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  capability: string | null;
  context_json: Record<string, unknown> | null;
  model_id: string | null;
  retrieved_source_ids: RetrievedSource[] | null;
  generation_metadata: GenerationMetadata | null;
  flags: RagFlags | null;
  training_eligible: boolean;
  deleted_at: string | null;
}

export interface RetrievedSource {
  id: string;
  type: string;
  score: number;
}

export interface GenerationMetadata {
  tokens_in: number;
  tokens_out: number;
  latencyMs: number;
  temperature: number;
}

export interface RagFeedback {
  id: string;
  message_id: string;
  user_id: string;
  rating: 'positive' | 'negative' | 'neutral';
  feedback_text: string | null;
  created_at: string;
}

// =====================================================
// Internal Types
// =====================================================

export interface RetrievalContext {
  source_id: string;
  source_type: string;
  source_label: string;
  similarity_score: number;
  metadata: Record<string, unknown>;
  owner_scope: 'user' | 'team' | 'global';
}

export interface PromptConfig {
  system_instructions: string;
  constraints: Record<string, unknown>;
}

export interface ConversationHistory {
  role: 'user' | 'assistant';
  content: string;
}
