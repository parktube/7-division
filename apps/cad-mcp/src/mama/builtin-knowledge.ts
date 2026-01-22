/**
 * Builtin Knowledge Loader
 *
 * Story 11.20: Dual-source MAMA Support
 * - Loads best practices from assets/knowledge/decisions.json
 * - Provides search/filter capabilities for builtin knowledge
 * - Read-only (builtin cannot be modified by users)
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger.js';

// ============================================================
// Types
// ============================================================

export interface BuiltinDecision {
  id: string;
  topic: string;
  decision: string;
  reasoning: string;
  confidence: number;
  source: 'builtin';
}

interface BuiltinKnowledgeFile {
  version: string;
  description?: string;
  decisions: Array<{
    id: string;
    topic: string;
    decision: string;
    reasoning: string;
    confidence: number;
    source: string;
  }>;
}

// ============================================================
// Module State
// ============================================================

let builtinDecisions: BuiltinDecision[] | null = null;

// ============================================================
// Path Resolution
// ============================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILTIN_KNOWLEDGE_PATH = resolve(__dirname, '../../assets/knowledge/decisions.json');

// ============================================================
// Loader
// ============================================================

/**
 * Load builtin knowledge from assets/knowledge/decisions.json
 * Caches in memory for performance
 */
export function loadBuiltinKnowledge(): BuiltinDecision[] {
  // Return cached if available
  if (builtinDecisions !== null) {
    return builtinDecisions;
  }

  // Check if file exists
  if (!existsSync(BUILTIN_KNOWLEDGE_PATH)) {
    logger.warn(`Builtin knowledge file not found: ${BUILTIN_KNOWLEDGE_PATH}`);
    builtinDecisions = [];
    return builtinDecisions;
  }

  try {
    const content = readFileSync(BUILTIN_KNOWLEDGE_PATH, 'utf-8');
    const data: BuiltinKnowledgeFile = JSON.parse(content);

    // Validate and transform
    builtinDecisions = data.decisions.map((d) => ({
      id: d.id,
      topic: d.topic,
      decision: d.decision,
      reasoning: d.reasoning,
      confidence: d.confidence,
      source: 'builtin' as const,
    }));

    logger.info(`Loaded ${builtinDecisions.length} builtin decisions from ${BUILTIN_KNOWLEDGE_PATH}`);
    return builtinDecisions;
  } catch (err) {
    logger.error(`Failed to load builtin knowledge: ${err}`);
    builtinDecisions = [];
    return builtinDecisions;
  }
}

/**
 * Clear cached builtin knowledge (for testing)
 */
export function clearBuiltinKnowledgeCache(): void {
  builtinDecisions = null;
}

// ============================================================
// Search Functions
// ============================================================

/**
 * Search builtin knowledge by query (keyword matching)
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Matching builtin decisions
 */
export function searchBuiltinKnowledge(
  query: string | undefined,
  options: {
    limit?: number;
    domain?: string;
  } = {}
): BuiltinDecision[] {
  const { limit = 10, domain } = options;
  const decisions = loadBuiltinKnowledge();

  if (decisions.length === 0) {
    return [];
  }

  // Filter by domain if specified
  let filtered = decisions;
  if (domain) {
    const domainLower = domain.toLowerCase();
    filtered = decisions.filter((d) =>
      d.topic.toLowerCase().startsWith(`${domainLower}:`)
    );
  }

  // If no query, return recent items (sorted by id for consistency)
  if (!query || query.trim().length === 0) {
    return filtered.slice(0, limit);
  }

  // Keyword search
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (keywords.length === 0) {
    return [];
  }

  // Score by keyword matches
  const scored = filtered.map((d) => {
    const text = `${d.topic} ${d.decision} ${d.reasoning}`.toLowerCase();
    const matchCount = keywords.filter((k) => text.includes(k)).length;
    return { decision: d, score: matchCount / keywords.length };
  });

  // Filter and sort by score
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.decision);
}

/**
 * Get all unique domains from builtin knowledge
 */
export function listBuiltinDomains(): string[] {
  const decisions = loadBuiltinKnowledge();
  const domains = new Set<string>();

  for (const d of decisions) {
    const colonIndex = d.topic.indexOf(':');
    if (colonIndex > 0) {
      domains.add(d.topic.substring(0, colonIndex));
    }
  }

  return Array.from(domains).sort();
}

/**
 * Get builtin decision by ID
 */
export function getBuiltinDecisionById(id: string): BuiltinDecision | undefined {
  const decisions = loadBuiltinKnowledge();
  return decisions.find((d) => d.id === id);
}

/**
 * Get builtin decisions by topic
 */
export function getBuiltinDecisionsByTopic(topic: string): BuiltinDecision[] {
  const decisions = loadBuiltinKnowledge();
  return decisions.filter((d) => d.topic === topic);
}
