/**
 * CAD MAMA Module Recommender
 *
 * Story 11.19: Module Library Recommendation
 * Embedding-based semantic module recommendation
 *
 * Scoring Algorithm:
 * Score = (semantic_similarity × 0.6) + (usage_frequency × 0.3) + (recency × 0.1)
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { init as initLexer, parse as parseEsm } from 'es-module-lexer'
import { logger } from '../logger.js'
import {
  getAllModules,
  getModule,
  ModuleRow,
  recordModuleUsage,
  upsertModule,
  updateModuleEmbedding,
  getModuleEmbeddings,
  needsEmbeddingRefresh
} from './db.js'
import { generateEmbedding, cosineSimilarity } from './embeddings.js'
import { CAD_DATA_DIR } from './config.js'

// Initialize es-module-lexer eagerly at module load
let lexerReady = false
initLexer.then(() => {
  lexerReady = true
}).catch(() => {
  // Ignore init failure - will fall back to regex
})

// ============================================================
// Types
// ============================================================

export interface ModuleMetadata {
  name: string
  description: string
  tags: string[]
  example: string | null
  imports: string[]
  // Note: exports field removed - was parsing but never used,
  // and mixed internal symbols with actual exports
}

export interface ModuleRecommendation {
  name: string
  description: string
  tags: string[]
  score: number
  scoreBreakdown: {
    semantic: number
    usage: number
    recency: number
  }
  example: string | null
}

// ============================================================
// Constants
// ============================================================

const WEIGHTS = {
  semantic: 0.6,
  usage: 0.3,
  recency: 0.1
}

// Recency decay: 7 days = 50% score
const RECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Safely parse tags JSON with error handling
 */
function parseTagsSafe(tagsJson: string | null): string[] {
  if (!tagsJson) return []
  try {
    const parsed = JSON.parse(tagsJson)
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
      return parsed
    }
    return []
  } catch {
    return []
  }
}

// ============================================================
// Import Parser Helper
// ============================================================

/**
 * Parse imports using regex (fallback for when es-module-lexer isn't ready or fails)
 * Matches: import 'module', import { x } from 'module', import * as x from 'module', import x from 'module'
 * LIMITATION: May match import-like strings in comments or string literals
 */
function parseImportsWithRegex(content: string, imports: string[]): void {
  const importMatches = content.matchAll(/import\s+(?:\w+\s+from\s+|\{[^}]*\}\s+from\s+|\*\s+as\s+\w+\s+from\s+)?['"]([^'"]+)['"]/g)
  for (const match of importMatches) {
    imports.push(match[1])
  }
}

// ============================================================
// JSDoc Parser
// ============================================================

/**
 * Parse JSDoc from module content
 *
 * Supports formats:
 * - Simple: / ** Description * /
 * - @module name
 * - @description text
 * - @tags tag1, tag2
 * - @example code
 */
export function parseModuleJSDoc(content: string): Partial<ModuleMetadata> {
  const result: Partial<ModuleMetadata> = {
    tags: [],
    imports: [],
  }

  // Extract JSDoc block (first /** ... */)
  const jsdocMatch = content.match(/\/\*\*\s*([\s\S]*?)\s*\*\//)
  if (!jsdocMatch) {
    return result
  }

  const jsdocContent = jsdocMatch[1]

  // Parse @module
  const moduleMatch = jsdocContent.match(/@module\s+(\S+)/)
  if (moduleMatch) {
    result.name = moduleMatch[1]
  }

  // Parse @description or first line
  const descMatch = jsdocContent.match(/@description\s+(.+)/)
  if (descMatch) {
    result.description = descMatch[1].trim()
  } else {
    // First non-@ line is description
    const lines = jsdocContent.split('\n')
    for (const line of lines) {
      const cleaned = line.replace(/^\s*\*\s*/, '').trim()
      if (cleaned && !cleaned.startsWith('@')) {
        result.description = cleaned
        break
      }
    }
  }

  // Parse @tags
  const tagsMatch = jsdocContent.match(/@tags?\s+(.+)/)
  if (tagsMatch) {
    result.tags = tagsMatch[1].split(/[,\s]+/).filter(Boolean)
  }

  // Parse @example
  const exampleMatch = jsdocContent.match(/@example\s+([\s\S]*?)(?=@|$)/)
  if (exampleMatch) {
    result.example = exampleMatch[1].replace(/^\s*\*\s*/gm, '').trim()
  }

  // Parse imports using es-module-lexer for accurate AST-based parsing
  // This avoids false positives from import-like strings in comments/literals
  if (lexerReady) {
    try {
      const [imports] = parseEsm(content)
      for (const imp of imports) {
        // imp.n is the module specifier (may be undefined for dynamic imports)
        if (imp.n && result.imports) {
          result.imports.push(imp.n)
        }
      }
    } catch {
      // Fallback to regex for non-standard JS (e.g., CAD sandbox code with bare imports)
      parseImportsWithRegex(content, result.imports ?? [])
    }
  } else {
    // Lexer not ready yet, use regex fallback
    parseImportsWithRegex(content, result.imports ?? [])
  }

  return result
}

// ============================================================
// Module Sync
// ============================================================

/**
 * Sync modules from CAD files to database
 *
 * @param moduleDir - Directory containing module files
 * @returns Number of modules synced
 */
export async function syncModulesFromFiles(moduleDir?: string): Promise<number> {
  const dir = moduleDir || join(CAD_DATA_DIR, 'modules')

  // Check directory existence with async fs
  try {
    await fs.access(dir)
  } catch {
    logger.warn(`Module directory not found: ${dir}`)
    return 0
  }

  const allFiles = await fs.readdir(dir)
  const files = allFiles.filter(f => !f.startsWith('.'))
  let synced = 0

  for (const file of files) {
    try {
      const content = await fs.readFile(join(dir, file), 'utf-8')
      const metadata = parseModuleJSDoc(content)

      // Use filename if @module not specified
      const name = metadata.name || file.replace(/\.[^.]+$/, '')

      const moduleData = {
        name,
        description: metadata.description || `Module: ${name}`,
        tags: metadata.tags,
        example: metadata.example || undefined
      }

      upsertModule(moduleData)

      // Generate and store embedding for the module
      try {
        await updateModuleEmbeddingAsync(moduleData)
      } catch (embErr) {
        logger.warn(`Failed to generate embedding for module ${name}: ${embErr}`)
        // Continue syncing even if embedding fails
      }

      synced++
    } catch (err) {
      logger.error(`Failed to sync module ${file}: ${err}`)
    }
  }

  logger.info(`Synced ${synced} modules from ${dir}`)
  return synced
}

// ============================================================
// Scoring
// ============================================================

/**
 * Calculate usage score (normalized 0-1)
 *
 * Uses logarithmic scaling to prevent heavily-used modules from dominating
 */
function calculateUsageScore(usageCount: number, maxUsage: number): number {
  if (maxUsage <= 0) return 0
  if (usageCount <= 0) return 0

  // Log scale: log(1 + usage) / log(1 + maxUsage)
  return Math.log(1 + usageCount) / Math.log(1 + maxUsage)
}

/**
 * Calculate recency score (0-1, exponential decay)
 *
 * @param lastUsedAt - Unix timestamp (ms) of last use
 * @returns Score from 0 to 1
 */
function calculateRecencyScore(lastUsedAt: number | null): number {
  if (!lastUsedAt) return 0

  const elapsed = Date.now() - lastUsedAt
  // Handle future timestamps (negative elapsed) by clamping
  if (elapsed < 0) return 1

  // Exponential decay: score = 0.5^(elapsed / half_life)
  const score = Math.pow(0.5, elapsed / RECENCY_HALF_LIFE_MS)
  // Clamp to [0, 1] range for safety
  return Math.min(Math.max(score, 0), 1)
}

// ============================================================
// Recommendation Engine
// ============================================================

/**
 * Recommend modules based on query
 *
 * @param query - Natural language query (e.g., "draw a chicken")
 * @param options - Recommendation options
 * @returns Sorted list of recommendations
 */
export async function recommendModules(
  query: string,
  options: {
    limit?: number
    minScore?: number
    tags?: string[]
  } = {}
): Promise<ModuleRecommendation[]> {
  const { limit = 5, minScore = 0.1, tags } = options

  // Get all modules
  let modules = getAllModules()

  // Filter by tags if specified
  if (tags && tags.length > 0) {
    modules = modules.filter(m => {
      const moduleTags = parseTagsSafe(m.tags)
      if (moduleTags.length === 0) return false
      return tags.some(t => moduleTags.includes(t))
    })
  }

  if (modules.length === 0) {
    return []
  }

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query)
  if (!queryEmbedding) {
    logger.warn('Failed to generate query embedding, falling back to keyword search')
    return keywordFallback(query, modules, limit, minScore)
  }

  // Calculate max usage for normalization
  const maxUsage = Math.max(...modules.map(m => m.usage_count), 1)

  // Score each module
  const scored: ModuleRecommendation[] = []

  // Track embedding failures for threshold-based logging
  let embeddingFailures = 0
  const FAILURE_LOG_THRESHOLD = 3

  // Get all module names for bulk fetch
  const moduleNames = modules.map(m => m.name)

  // Bulk fetch cached embeddings from DB
  const cachedEmbeddings = getModuleEmbeddings(moduleNames)

  // Process modules with cached embeddings first
  for (const module of modules) {
    let moduleEmbedding: Float32Array | undefined = cachedEmbeddings.get(module.name)

    // If no cached embedding, generate and cache it
    if (!moduleEmbedding) {
      const metadataHash = await calculateMetadataHash(module)

      // Double-check if refresh needed (in case of race condition)
      if (needsEmbeddingRefresh(module.name, metadataHash)) {
        const moduleText = buildModuleText(module)
        const generated = await generateEmbedding(moduleText)
        moduleEmbedding = generated || undefined

        if (moduleEmbedding) {
          // Cache for future use (non-blocking)
          updateModuleEmbedding(module.name, moduleEmbedding, metadataHash)
        } else {
          embeddingFailures++
          continue
        }
      }
    }

    if (!moduleEmbedding) {
      embeddingFailures++
      continue
    }

    // Calculate component scores
    const semanticScore = cosineSimilarity(queryEmbedding, moduleEmbedding)
    const usageScore = calculateUsageScore(module.usage_count, maxUsage)
    const recencyScore = calculateRecencyScore(module.last_used_at)

    // Weighted total
    const totalScore =
      WEIGHTS.semantic * semanticScore +
      WEIGHTS.usage * usageScore +
      WEIGHTS.recency * recencyScore

    if (totalScore >= minScore) {
      scored.push({
        name: module.name,
        description: module.description,
        tags: parseTagsSafe(module.tags),
        score: totalScore,
        scoreBreakdown: {
          semantic: semanticScore,
          usage: usageScore,
          recency: recencyScore
        },
        example: module.example
      })
    }
  }

  // Log if many embeddings failed (indicates potential embedding service issues)
  if (embeddingFailures >= FAILURE_LOG_THRESHOLD) {
    logger.warn(`Module embedding failures: ${embeddingFailures}/${modules.length} modules skipped`)
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, limit)
}

/**
 * Build searchable text from module
 */
function buildModuleText(module: ModuleRow): string {
  const parts = [
    `Module: ${module.name}`,
    `Description: ${module.description}`
  ]

  const tags = parseTagsSafe(module.tags)
  if (tags.length > 0) {
    parts.push(`Tags: ${tags.join(', ')}`)
  }

  // Include example code for better semantic matching
  if (module.example) {
    parts.push(`Example: ${module.example}`)
  }

  return parts.join('\n')
}

/**
 * Calculate SHA256 hash of module metadata for change detection
 */
async function calculateMetadataHash(module: ModuleRow): Promise<string> {
  const content = [
    module.description,
    module.tags || '',
    module.example || ''
  ].join('|')

  // Simple hash using Node.js crypto
  const { createHash } = await import('crypto')
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Fallback to keyword-based search when embedding fails
 */
function keywordFallback(
  query: string,
  modules: ModuleRow[],
  limit: number,
  minScore: number = 0
): ModuleRecommendation[] {
  const queryLower = query.toLowerCase().trim()
  // Filter empty tokens to prevent empty query matching everything
  const queryWords = queryLower.split(/\s+/).filter(Boolean)

  // Empty query returns no results
  if (queryWords.length === 0) {
    return []
  }

  const scored = modules.map(module => {
    const textLower = `${module.name} ${module.description}`.toLowerCase()
    const matches = queryWords.filter(w => textLower.includes(w)).length
    const score = matches / queryWords.length

    return {
      name: module.name,
      description: module.description,
      tags: parseTagsSafe(module.tags),
      score,
      scoreBreakdown: {
        semantic: score,
        usage: 0,
        recency: 0
      },
      example: module.example
    }
  })

  return scored
    .filter(s => s.score > 0 && s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ============================================================
// Embedding Management
// ============================================================

/**
 * Update module embedding asynchronously
 * Called after module upsert to generate and cache embedding
 */
async function updateModuleEmbeddingAsync(module: ModuleRow | {
  name: string
  description: string
  tags?: string[]
  example?: string
}): Promise<void> {
  // Convert plain object to ModuleRow format if needed
  const moduleRow: ModuleRow = 'usage_count' in module ? module : {
    name: module.name,
    description: module.description,
    tags: module.tags ? JSON.stringify(module.tags) : null,
    example: module.example || null,
    usage_count: 0,
    last_used_at: null,
    created_at: Date.now(),
    updated_at: null
  }

  // Calculate metadata hash
  const metadataHash = await calculateMetadataHash(moduleRow)

  // Check if embedding needs update
  if (!needsEmbeddingRefresh(moduleRow.name, metadataHash)) {
    return // Embedding is up-to-date
  }

  // Generate text for embedding
  const moduleText = buildModuleText(moduleRow)

  // Generate embedding
  const embedding = await generateEmbedding(moduleText)
  if (!embedding) {
    throw new Error(`Failed to generate embedding for module ${moduleRow.name}`)
  }

  // Store in database
  updateModuleEmbedding(moduleRow.name, embedding, metadataHash)
}

// ============================================================
// Usage Tracking
// ============================================================

/**
 * Track module usage when imported
 *
 * @param moduleName - Name of the module being used
 */
export function trackModuleUsage(moduleName: string): void {
  const module = getModule(moduleName)
  if (module) {
    recordModuleUsage(moduleName)
    logger.debug(`Tracked usage of module: ${moduleName}`)
  }
}

/**
 * Extract and track module imports from code
 *
 * @param code - CAD code being executed
 */
export function trackImportsFromCode(code: string): void {
  // Match: import 'module', import { x } from 'module', import * as x from 'module', import x from 'module'
  // Note: CAD 모듈은 주로 import 'module' 형태 사용
  const importMatches = code.matchAll(/import\s+(?:\w+\s+from\s+|\{[^}]*\}\s+from\s+|\*\s+as\s+\w+\s+from\s+)?['"]([^'"]+)['"]/g)

  for (const match of importMatches) {
    const moduleName = match[1]
    // Skip built-in modules or paths
    if (!moduleName.includes('/') && !moduleName.startsWith('.')) {
      trackModuleUsage(moduleName)
    }
  }
}
