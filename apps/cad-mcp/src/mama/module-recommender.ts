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
import { logger } from '../logger.js'
import {
  getAllModules,
  getModule,
  ModuleRow,
  recordModuleUsage,
  upsertModule
} from './db.js'
import { generateEmbedding, cosineSimilarity } from './embeddings.js'
import { CAD_DATA_DIR } from './config.js'

// ============================================================
// Types
// ============================================================

export interface ModuleMetadata {
  name: string
  description: string
  tags: string[]
  example: string | null
  imports: string[]
  exports: string[]
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
    exports: []
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

  // Parse imports (consistent with trackImportsFromCode pattern)
  // Matches: import 'module', import { x } from 'module', import * as x from 'module', import x from 'module'
  const importMatches = content.matchAll(/import\s+(?:\w+\s+from\s+|\{[^}]*\}\s+from\s+|\*\s+as\s+\w+\s+from\s+)?['"]([^'"]+)['"]/g)
  for (const match of importMatches) {
    if (result.imports) {
      result.imports.push(match[1])
    }
  }

  // Parse exports (function names, const/let/var declarations, classes)
  // This regex-based approach captures common patterns; AST would be more robust
  const exportPatterns = [
    /function\s+(\w+)\s*\(/g,                           // function name(
    /(?:const|let|var)\s+(\w+)\s*=/g,                   // const/let/var name =
    /class\s+(\w+)/g,                                    // class Name
    /export\s+function\s+(\w+)/g,                        // export function name
    /export\s+(?:const|let|var)\s+(\w+)/g,              // export const name
    /export\s+class\s+(\w+)/g,                           // export class Name
    /export\s+default\s+(?:function\s+)?(\w+)/g,         // export default name
  ]

  const exportedNames = new Set<string>()
  for (const pattern of exportPatterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        exportedNames.add(match[1])
      }
    }
  }

  if (result.exports) {
    result.exports.push(...exportedNames)
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

      upsertModule({
        name,
        description: metadata.description || `Module: ${name}`,
        tags: metadata.tags,
        example: metadata.example || undefined
      })

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
  // Exponential decay: score = 0.5^(elapsed / half_life)
  return Math.pow(0.5, elapsed / RECENCY_HALF_LIFE_MS)
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
    return keywordFallback(query, modules, limit)
  }

  // Calculate max usage for normalization
  const maxUsage = Math.max(...modules.map(m => m.usage_count), 1)

  // Score each module
  const scored: ModuleRecommendation[] = []

  // TODO: 모듈 저장 시 임베딩 미리 계산하여 DB 캐싱 (확장성 개선)
  for (const module of modules) {
    // Generate module embedding from description + tags
    const moduleText = buildModuleText(module)
    const moduleEmbedding = await generateEmbedding(moduleText)

    if (!moduleEmbedding) continue

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

  return parts.join('\n')
}

/**
 * Fallback to keyword-based search when embedding fails
 */
function keywordFallback(
  query: string,
  modules: ModuleRow[],
  limit: number
): ModuleRecommendation[] {
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/)

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
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
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
