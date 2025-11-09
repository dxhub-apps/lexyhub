// lib/lexybrain/service.ts
"use server";

import { runLexyBrainOrchestration, type LexyBrainOrchestrationRequest } from "@/lib/lexybrain/orchestrator";

export { type LexyBrainOrchestrationResult } from "@/lib/lexybrain/orchestrator";

export async function generateLexyBrainInsight(
  args: Omit<LexyBrainOrchestrationRequest, "userId"> & { userId: string }
) {
  return runLexyBrainOrchestration(args);
}
