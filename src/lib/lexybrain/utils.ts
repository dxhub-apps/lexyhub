// lib/lexybrain/utils.ts
// Utility functions for LexyBrain (no server actions, just pure functions)

/**
 * Extract JSON from model output
 * Handles cases where the model includes extra text around the JSON
 */
export function extractJsonFromOutput(output: string): string {
  // Strategy 1: Try to extract from markdown code blocks
  const codeBlockMatch = output.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    const extracted = codeBlockMatch[1].trim();
    if (extracted && (extracted.startsWith('{') || extracted.startsWith('['))) {
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {
        // Continue to other strategies
      }
    }
  }

  // Strategy 2: Find all potential JSON structures using balanced bracket matching
  const jsonCandidates = findBalancedJsonStructures(output);

  // Try to parse each candidate and collect valid ones with their sizes
  const validCandidates: Array<{ json: string; size: number; keyCount: number }> = [];
  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      // Ensure it's a substantial object/array, not just {}
      if (typeof parsed === 'object' && parsed !== null) {
        const keyCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
        if (keyCount > 0) {
          validCandidates.push({
            json: candidate,
            size: candidate.length,
            keyCount: keyCount,
          });
        }
      }
    } catch {
      // Invalid JSON, skip
      continue;
    }
  }

  // Return the largest valid JSON structure (by character count)
  // This helps avoid returning schema examples or small context objects
  if (validCandidates.length > 0) {
    validCandidates.sort((a, b) => b.size - a.size);
    return validCandidates[0].json;
  }

  // Strategy 3: More aggressive - find content between first { and last }
  // This is the original behavior as a final fallback
  const fallbackMatch = output.match(/\{[\s\S]*\}/) || output.match(/\[[\s\S]*\]/);
  if (fallbackMatch) {
    return fallbackMatch[0];
  }

  // If no JSON found, return the full output
  return output;
}

/**
 * Find all balanced JSON structures (objects and arrays) in text
 * Uses character-by-character parsing to handle nested structures properly
 */
function findBalancedJsonStructures(text: string): string[] {
  const candidates: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '{' || char === '[') {
      const closingChar = char === '{' ? '}' : ']';
      let depth = 1;
      let inString = false;
      let escaped = false;

      for (let j = i + 1; j < text.length; j++) {
        const currentChar = text[j];

        // Handle string boundaries and escaping
        if (currentChar === '\\' && !escaped) {
          escaped = true;
          continue;
        }

        if (currentChar === '"' && !escaped) {
          inString = !inString;
        }

        escaped = false;

        // Only count brackets outside of strings
        if (!inString) {
          if (currentChar === char) {
            depth++;
          } else if (currentChar === closingChar) {
            depth--;

            if (depth === 0) {
              // Found a balanced structure
              const candidate = text.substring(i, j + 1);
              candidates.push(candidate);
              break;
            }
          }
        }
      }
    }
  }

  return candidates;
}
