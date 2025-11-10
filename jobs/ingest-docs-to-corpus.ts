#!/usr/bin/env node
/**
 * Documentation Ingestion to ai_corpus Job
 *
 * Reads markdown documentation files from /docs directory
 * Chunks them into ~500 token segments and upserts into ai_corpus with embeddings
 *
 * Run: node --loader ts-node/esm jobs/ingest-docs-to-corpus.ts
 */

import { createClient } from "@supabase/supabase-js";
import { createSemanticEmbedding } from "../src/lib/ai/semantic-embeddings";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DOCS_DIR = process.env.DOCS_DIR || "./docs";
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || "500", 10); // ~500 tokens
const OVERLAP = parseInt(process.env.OVERLAP || "50", 10); // 50 tokens overlap

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[ERROR] Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

interface DocFile {
  path: string;
  relativePath: string;
  content: string;
  title: string;
  category: string;
}

interface DocChunk {
  file: DocFile;
  chunk: string;
  index: number;
  totalChunks: number;
}

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string, baseDir: string = dir): DocFile[] {
  const files: DocFile[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        // Skip node_modules, .git, etc.
        if (!entry.startsWith('.') && entry !== 'node_modules') {
          files.push(...findMarkdownFiles(fullPath, baseDir));
        }
      } else if (stats.isFile() && entry.endsWith('.md')) {
        const relativePath = relative(baseDir, fullPath);
        const content = readFileSync(fullPath, 'utf-8');

        // Extract title from first heading or filename
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : entry.replace('.md', '');

        // Determine category from path
        const pathParts = relativePath.split('/');
        const category = pathParts.length > 1 ? pathParts[0] : 'general';

        files.push({
          path: fullPath,
          relativePath,
          content,
          title,
          category,
        });
      }
    }
  } catch (error) {
    console.error(`[ERROR] Failed to read directory ${dir}: ${error}`);
  }

  return files;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Chunk a document into smaller pieces with overlap
 */
function chunkDocument(doc: DocFile): DocChunk[] {
  const chunks: DocChunk[] = [];
  const content = doc.content;

  // Split by sections (headings)
  const sections = content.split(/\n(?=#+\s)/);

  let currentChunk = '';
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section);

    // If section is small enough, add to current chunk
    if (estimateTokens(currentChunk + section) <= CHUNK_SIZE) {
      currentChunk += '\n\n' + section;
    } else {
      // Current chunk is full, save it
      if (currentChunk.trim()) {
        chunks.push({
          file: doc,
          chunk: currentChunk.trim(),
          index: chunkIndex++,
          totalChunks: 0, // Will be updated later
        });
      }

      // Start new chunk with section
      if (sectionTokens <= CHUNK_SIZE) {
        currentChunk = section;
      } else {
        // Section itself is too large, split by paragraphs
        const paragraphs = section.split(/\n\n+/);
        let subChunk = '';

        for (const para of paragraphs) {
          if (estimateTokens(subChunk + para) <= CHUNK_SIZE) {
            subChunk += '\n\n' + para;
          } else {
            if (subChunk.trim()) {
              chunks.push({
                file: doc,
                chunk: subChunk.trim(),
                index: chunkIndex++,
                totalChunks: 0,
              });
            }
            subChunk = para;
          }
        }

        currentChunk = subChunk;
      }
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      file: doc,
      chunk: currentChunk.trim(),
      index: chunkIndex++,
      totalChunks: 0,
    });
  }

  // Update totalChunks
  chunks.forEach((chunk) => {
    chunk.totalChunks = chunks.length;
  });

  return chunks;
}

/**
 * Create a rich chunk with context
 */
function createEnrichedChunk(docChunk: DocChunk): string {
  const parts: string[] = [];

  // Add document context
  parts.push(`Document: ${docChunk.file.title}`);
  parts.push(`Category: ${docChunk.file.category}`);

  if (docChunk.totalChunks > 1) {
    parts.push(`Section: ${docChunk.index + 1} of ${docChunk.totalChunks}`);
  }

  parts.push(''); // Blank line
  parts.push(docChunk.chunk);

  return parts.join('\n');
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const runId = crypto.randomUUID();
  const runStarted = new Date().toISOString();

  console.log(`[${runStarted}] Starting docs ingestion to ai_corpus ${runId}`);
  console.log(`[INFO] Docs directory: ${DOCS_DIR}, Chunk size: ${CHUNK_SIZE} tokens, Overlap: ${OVERLAP}`);

  try {
    // Find all markdown files
    console.log("[INFO] Scanning for markdown files...");
    const docFiles = findMarkdownFiles(DOCS_DIR);

    if (docFiles.length === 0) {
      console.log("[INFO] No markdown files found");
      return;
    }

    console.log(`[INFO] Found ${docFiles.length} markdown files`);

    // Chunk all documents
    const allChunks: DocChunk[] = [];
    for (const doc of docFiles) {
      const chunks = chunkDocument(doc);
      allChunks.push(...chunks);
    }

    console.log(`[INFO] Created ${allChunks.length} chunks from ${docFiles.length} documents`);

    // Process each chunk
    let successCount = 0;
    let errorCount = 0;

    for (const docChunk of allChunks) {
      try {
        const enrichedChunk = createEnrichedChunk(docChunk);

        // Generate semantic embedding
        const embedding = await createSemanticEmbedding(enrichedChunk, {
          fallbackToDeterministic: true,
        });

        // Validate embedding dimension
        if (embedding.length !== 384) {
          console.error(
            `[ERROR] Invalid embedding dimension for doc ${docChunk.file.relativePath}: expected 384, got ${embedding.length}`
          );
          errorCount++;
          continue;
        }

        // Upsert to ai_corpus
        const { error: upsertError } = await supabase
          .from("ai_corpus")
          .upsert({
            id: crypto.randomUUID(),
            owner_scope: "global",
            owner_user_id: null,
            owner_team_id: null,
            source_type: "doc",
            source_ref: {
              file_path: docChunk.file.relativePath,
              chunk_index: docChunk.index,
              total_chunks: docChunk.totalChunks,
              ingested_at: new Date().toISOString(),
            },
            marketplace: null,
            language: "en",
            chunk: enrichedChunk,
            embedding: embedding, // Pass array directly, not JSON.stringify
            metadata: {
              title: docChunk.file.title,
              category: docChunk.file.category,
              file_path: docChunk.file.relativePath,
              chunk_index: docChunk.index,
              total_chunks: docChunk.totalChunks,
            },
            is_active: true,
          }, {
            onConflict: "id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`[ERROR] Failed to upsert chunk for ${docChunk.file.relativePath}: ${upsertError.message}`);
          errorCount++;
        } else {
          successCount++;
          if (successCount % 20 === 0) {
            console.log(`[INFO] Processed ${successCount}/${allChunks.length} chunks`);
          }
        }
      } catch (error) {
        console.error(`[ERROR] Failed to process chunk for ${docChunk.file.relativePath}: ${error}`);
        errorCount++;
      }
    }

    const runEnded = new Date().toISOString();
    const duration = new Date(runEnded).getTime() - new Date(runStarted).getTime();

    console.log(`[${runEnded}] Docs ingestion completed`);
    console.log(`[INFO] Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`[INFO] Documents: ${docFiles.length}, Chunks: ${allChunks.length}`);
    console.log(`[INFO] Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error(`[ERROR] Fatal error in docs ingestion: ${error}`);
    process.exit(1);
  }
}

main();
