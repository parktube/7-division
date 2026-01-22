/**
 * CAD MAMA Embedding System
 *
 * Story 11.1: MAMA Core 4 Tools MCP 통합
 * Generates embeddings using @huggingface/transformers
 *
 * Reference: ~/MAMA/packages/claude-code-plugin/src/core/embeddings.js
 */

import { getEmbeddingDim, getModelName } from './config.js'
import { logger } from '../logger.js'

// ============================================================
// Types
// ============================================================

type EmbeddingPipeline = (
  text: string | string[],
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: Float32Array }>

// ============================================================
// Singleton State
// ============================================================

let embeddingPipeline: EmbeddingPipeline | null = null
let currentModelName: string | null = null
let modelLoading: Promise<EmbeddingPipeline> | null = null

// ============================================================
// LRU Cache
// ============================================================

const CACHE_MAX_SIZE = 1000
const embeddingCache = new Map<string, Float32Array>()

/**
 * Get cached embedding (LRU: reinsert on hit to update recency)
 */
function getCached(text: string): Float32Array | undefined {
  const value = embeddingCache.get(text)
  if (value !== undefined) {
    // Reinsert to mark as recently used (LRU)
    embeddingCache.delete(text)
    embeddingCache.set(text, value)
  }
  return value
}

/**
 * Set cached embedding with LRU eviction
 */
function setCache(text: string, embedding: Float32Array): void {
  // If key exists, remove it first to update its position
  if (embeddingCache.has(text)) {
    embeddingCache.delete(text)
  }
  // Simple LRU: delete oldest if at capacity
  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    const firstKey = embeddingCache.keys().next().value
    if (firstKey) {
      embeddingCache.delete(firstKey)
    }
  }
  embeddingCache.set(text, embedding)
}

/**
 * Clear embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear()
  logger.info('Embedding cache cleared')
}

// ============================================================
// Model Loading
// ============================================================

/**
 * Load embedding model (singleton)
 *
 * @returns Embedding pipeline
 */
async function loadModel(): Promise<EmbeddingPipeline> {
  const modelName = getModelName()

  // Check if model changed
  if (embeddingPipeline && currentModelName && currentModelName !== modelName) {
    logger.info(`Embedding model changed: ${currentModelName} -> ${modelName}`)
    embeddingPipeline = null
    currentModelName = null
    clearEmbeddingCache()
  }

  // Return existing pipeline
  if (embeddingPipeline) {
    return embeddingPipeline
  }

  // Return loading promise if already loading
  if (modelLoading) {
    return modelLoading
  }

  // Load model
  logger.info(`Loading embedding model: ${modelName}...`)
  const startTime = Date.now()

  modelLoading = (async () => {
    try {
      // Dynamic import for ES Module
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformers = await import('@huggingface/transformers') as any
      const { pipeline } = transformers

      embeddingPipeline = (await pipeline('feature-extraction', modelName)) as EmbeddingPipeline
      currentModelName = modelName

      const loadTime = Date.now() - startTime
      logger.info(`Embedding model loaded in ${loadTime}ms (${getEmbeddingDim()}-dim)`)

      return embeddingPipeline
    } catch (error) {
      logger.error(`Failed to load embedding model: ${error}`)
      throw error
    } finally {
      modelLoading = null
    }
  })()

  return modelLoading
}

// ============================================================
// Embedding Generation
// ============================================================

/**
 * Generate embedding vector from text
 *
 * @param text - Input text to embed
 * @returns Embedding vector (Float32Array) or null if failed
 */
export async function generateEmbedding(text: string): Promise<Float32Array | null> {
  if (!text || text.trim().length === 0) {
    logger.warn('Cannot generate embedding for empty text')
    return null
  }

  // Check cache
  const cached = getCached(text)
  if (cached) {
    return cached
  }

  try {
    const model = await loadModel()
    const expectedDim = getEmbeddingDim()

    // Generate embedding
    const output = await model(text, {
      pooling: 'mean',
      normalize: true,
    })

    const embedding = output.data

    // Verify dimensions
    if (embedding.length !== expectedDim) {
      logger.error(`Expected ${expectedDim}-dim, got ${embedding.length}-dim`)
      return null
    }

    // Cache and return
    setCache(text, embedding)
    return embedding
  } catch (error) {
    logger.error(`Failed to generate embedding: ${error}`)
    return null
  }
}

/**
 * Generate enhanced embedding with content + metadata
 *
 * @param decision - Decision object
 * @returns Enhanced embedding
 */
export async function generateEnhancedEmbedding(decision: {
  topic: string
  decision: string
  reasoning?: string
  outcome?: string | null
  confidence?: number
}): Promise<Float32Array | null> {
  // Construct enriched text representation
  const enrichedText = `
Topic: ${decision.topic}
Decision: ${decision.decision}
Reasoning: ${decision.reasoning || 'N/A'}
Outcome: ${decision.outcome || 'PENDING'}
Confidence: ${decision.confidence ?? 0.5}
`.trim()

  return generateEmbedding(enrichedText)
}

/**
 * Calculate cosine similarity between two embeddings
 *
 * @param embA - First embedding
 * @param embB - Second embedding
 * @returns Similarity score (0-1)
 */
export function cosineSimilarity(embA: Float32Array, embB: Float32Array): number {
  if (embA.length !== embB.length) {
    throw new Error('Embeddings must have same dimension')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < embA.length; i++) {
    dotProduct += embA[i] * embB[i]
    normA += embA[i] * embA[i]
    normB += embB[i] * embB[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  // Avoid division by zero
  if (denominator < 1e-12) {
    return 0
  }
  return dotProduct / denominator
}

/**
 * Check if embedding system is ready
 */
export function isEmbeddingReady(): boolean {
  return embeddingPipeline !== null
}

/**
 * Preload embedding model (for startup)
 */
export async function preloadModel(): Promise<boolean> {
  try {
    await loadModel()
    return true
  } catch {
    return false
  }
}
