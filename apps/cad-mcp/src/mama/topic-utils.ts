/**
 * Topic Utilities Module
 *
 * Story 11.3: 단일 DB + Topic Prefix 구조
 *
 * Topic Prefix Convention: {domain}:{entity}:{aspect}
 * Examples:
 *   - voxel:chicken:color_palette
 *   - cad:scene:structure
 *   - api:auth:strategy
 */

// ============================================================
// Types
// ============================================================

export interface ParsedTopic {
  domain: string // 'voxel'
  entity: string // 'chicken'
  aspect: string // 'color_palette'
  raw: string // 'voxel:chicken:color_palette'
}

// ============================================================
// Constants
// ============================================================

// Topic format: domain:entity:aspect (all lowercase, alphanumeric + underscore)
const TOPIC_PATTERN = /^([a-z][a-z0-9_]*):([a-z][a-z0-9_]*):([a-z][a-z0-9_]*)$/

// Minimum topic format: at least domain (for legacy/simple topics)
const SIMPLE_TOPIC_PATTERN = /^[a-z][a-z0-9_]*$/

// ============================================================
// Parser Functions
// ============================================================

/**
 * Parse a topic string into its components
 *
 * @param topic - Topic string (e.g., 'voxel:chicken:color_palette')
 * @returns ParsedTopic or null if invalid format
 */
export function parseTopic(topic: string): ParsedTopic | null {
  if (!topic || typeof topic !== 'string') {
    return null
  }

  const trimmed = topic.trim().toLowerCase()
  const match = trimmed.match(TOPIC_PATTERN)

  if (match) {
    return {
      domain: match[1],
      entity: match[2],
      aspect: match[3],
      raw: trimmed,
    }
  }

  return null
}

/**
 * Extract domain from a topic string
 *
 * Works with both full topics (domain:entity:aspect) and simple topics (domain_name)
 *
 * @param topic - Topic string
 * @returns Domain string or the topic itself if no colon separator
 */
export function extractDomain(topic: string): string {
  if (!topic || typeof topic !== 'string') {
    return ''
  }

  const trimmed = topic.trim().toLowerCase()

  // Full format: domain:entity:aspect
  const colonIndex = trimmed.indexOf(':')
  if (colonIndex > 0) {
    return trimmed.substring(0, colonIndex)
  }

  // Simple format: extract prefix before underscore or return as-is
  const underscoreIndex = trimmed.indexOf('_')
  if (underscoreIndex > 0) {
    return trimmed.substring(0, underscoreIndex)
  }

  return trimmed
}

/**
 * Validate a topic string format
 *
 * Accepts both:
 * - Full format: domain:entity:aspect (e.g., 'voxel:chicken:color')
 * - Simple format: alphanumeric with underscores (e.g., 'auth_strategy')
 *
 * @param topic - Topic string to validate
 * @returns true if valid format
 */
export function validateTopic(topic: string): boolean {
  if (!topic || typeof topic !== 'string') {
    return false
  }

  const trimmed = topic.trim().toLowerCase()

  // Check full format first
  if (TOPIC_PATTERN.test(trimmed)) {
    return true
  }

  // Allow simple format for backwards compatibility (also handles underscore-separated legacy names)
  if (SIMPLE_TOPIC_PATTERN.test(trimmed)) {
    return true
  }

  return false
}

/**
 * Check if a topic uses the full prefix format
 *
 * @param topic - Topic string
 * @returns true if topic uses domain:entity:aspect format
 */
export function isFullFormat(topic: string): boolean {
  if (!topic || typeof topic !== 'string') {
    return false
  }

  return TOPIC_PATTERN.test(topic.trim().toLowerCase())
}

/**
 * Build a topic string from components
 *
 * @param domain - Domain name
 * @param entity - Entity name
 * @param aspect - Aspect name
 * @returns Formatted topic string or null if invalid
 */
export function buildTopic(domain: string, entity: string, aspect: string): string | null {
  // Type guards for non-string inputs
  if (typeof domain !== 'string' || typeof entity !== 'string' || typeof aspect !== 'string') {
    return null
  }

  const d = domain.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
  const e = entity.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
  const a = aspect.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')

  // Prevent empty topic components (would create '::' or ':x:' patterns)
  if (!d || !e || !a) {
    return null
  }

  return `${d}:${e}:${a}`
}

/**
 * Get all unique domains from a list of topics
 *
 * @param topics - Array of topic strings
 * @returns Array of unique domain names
 */
export function getUniqueDomains(topics: string[]): string[] {
  const domains = new Set<string>()

  for (const topic of topics) {
    const domain = extractDomain(topic)
    if (domain) {
      domains.add(domain)
    }
  }

  return Array.from(domains).sort()
}

/**
 * Group topics by domain
 *
 * @param topics - Array of topic strings
 * @returns Map of domain to topics
 */
export function groupTopicsByDomain(topics: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()

  for (const topic of topics) {
    const domain = extractDomain(topic)
    if (!domain) continue

    const existing = groups.get(domain) || []
    existing.push(topic)
    groups.set(domain, existing)
  }

  return groups
}
