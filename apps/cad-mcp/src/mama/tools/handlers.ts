/**
 * MAMA MCP Tool Handlers
 *
 * Story 11.1: MAMA Core 4 Tools MCP 통합
 *
 * Implements handlers for:
 * - mama_save: Save decision or checkpoint
 * - mama_search: Semantic search for decisions
 * - mama_update: Update decision outcome
 * - mama_load_checkpoint: Resume from checkpoint
 * - mama_configure: View/modify configuration
 */

import { logger } from '../../logger.js'
import {
  initMAMA,
  saveDecision,
  saveCheckpoint,
  searchDecisions,
  updateOutcome,
  loadCheckpoint,
  getStatus,
  listDomains,
  addHint,
  updateHint,
  deleteHint,
  listHints,
  type DecisionResult,
} from '../index.js'
import { setSkillLevel, getSkillProfile, type SkillLevel } from '../mentoring.js'
import { loadConfig, updateConfig } from '../config.js'
import { calculateGraphHealth, formatHealthReport, type GraphHealth } from '../health.js'
import { analyzeDecisionBeforeSave, getStaleWarning, type AntiEchoWarning } from '../anti-echo.js'
import { saveLearning, type SaveLearningResult } from '../learning-tracker.js'
import { getGrowthSummary, formatGrowthReport, type GrowthSummary } from '../growth-tracker.js'

// ============================================================
// Response Types
// ============================================================

export interface ToolResponse {
  success: boolean
  data?: unknown
  error?: string
}

// ============================================================
// mama_save Handler
// ============================================================

export interface SaveArgs {
  type: 'decision' | 'checkpoint' | 'learning'
  // Decision fields
  topic?: string
  decision?: string
  reasoning?: string
  confidence?: number
  // Checkpoint fields
  summary?: string
  open_files?: string[]
  next_steps?: string
  // Learning fields (Story 11.13)
  concept?: string
  domain?: string
}

/**
 * Handle mama_save tool call
 */
export async function handleMamaSave(args: SaveArgs): Promise<ToolResponse> {
  try {
    await initMAMA()

    if (args.type === 'decision') {
      // Validate decision fields
      if (!args.topic) {
        return { success: false, error: 'topic is required for decision' }
      }
      if (!args.decision) {
        return { success: false, error: 'decision is required for decision' }
      }
      if (!args.reasoning) {
        return { success: false, error: 'reasoning is required for decision' }
      }

      // Anti-echo chamber analysis (Story 11.12)
      const antiEcho = analyzeDecisionBeforeSave(args.topic, args.decision, args.reasoning)

      const decisionId = await saveDecision({
        topic: args.topic,
        decision: args.decision,
        reasoning: args.reasoning,
        confidence: args.confidence,
      })

      logger.info(`mama_save: Decision saved - ${decisionId}`)

      // Include anti-echo warnings in response
      const responseData: Record<string, unknown> = {
        type: 'decision',
        id: decisionId,
        topic: args.topic,
        message: `Decision saved. ID: ${decisionId}`,
      }

      if (antiEcho.warnings.length > 0) {
        responseData.warnings = antiEcho.warnings.map((w: AntiEchoWarning) => w.message)
        logger.info(`mama_save: ${antiEcho.warnings.length} anti-echo warnings generated`)
      }

      return {
        success: true,
        data: responseData,
      }
    } else if (args.type === 'checkpoint') {
      // Validate checkpoint fields
      if (!args.summary) {
        return { success: false, error: 'summary is required for checkpoint' }
      }

      const checkpointId = await saveCheckpoint({
        summary: args.summary,
        open_files: args.open_files,
        next_steps: args.next_steps,
      })

      logger.info(`mama_save: Checkpoint saved - ${checkpointId}`)

      return {
        success: true,
        data: {
          type: 'checkpoint',
          id: checkpointId,
          message: `Checkpoint saved. ID: ${checkpointId}`,
        },
      }
    } else if (args.type === 'learning') {
      // Story 11.13: Learning Progress Storage
      // Validate learning fields
      if (!args.concept) {
        return { success: false, error: 'concept is required for learning' }
      }

      const result: SaveLearningResult = saveLearning({
        concept: args.concept,
        domain: args.domain,
      })

      logger.info(`mama_save: Learning ${result.is_new ? 'created' : 'found'} - ${result.id}`)

      return {
        success: true,
        data: {
          type: 'learning',
          id: result.id,
          concept: result.concept,
          domain: result.domain,
          understanding_level: result.understanding_level,
          applied_count: result.applied_count,
          is_new: result.is_new,
          message: result.is_new
            ? `Learning saved. Concept: ${result.concept} (level: 1 - introduced)`
            : `Learning already exists. Concept: ${result.concept} (level: ${result.understanding_level})`,
        },
      }
    } else {
      return { success: false, error: "type must be 'decision', 'checkpoint', or 'learning'" }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_save failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

// ============================================================
// mama_search Handler
// ============================================================

export interface SearchArgs {
  query?: string
  limit?: number
  type?: 'all' | 'decision' | 'checkpoint'
  domain?: string
  group_by_topic?: boolean
  list_domains?: boolean
  outcome_filter?: 'success' | 'failed' | 'partial' | 'pending'
}

/**
 * Handle mama_search tool call
 */
export async function handleMamaSearch(args: SearchArgs): Promise<ToolResponse> {
  try {
    await initMAMA()

    // Handle list_domains special case
    if (args.list_domains) {
      const domains = await listDomains()
      logger.info(`mama_search: Listed ${domains.length} domains`)

      return {
        success: true,
        data: {
          list_domains: true,
          count: domains.length,
          domains,
        },
      }
    }

    const results = await searchDecisions({
      query: args.query,
      limit: args.limit || 10,
      type: args.type || 'all',
      domain: args.domain,
      group_by_topic: args.group_by_topic,
      outcome_filter: args.outcome_filter,
    })

    // Format results for LLM consumption
    const formattedResults = results.map((r: DecisionResult) => {
      const result: Record<string, unknown> = {
        id: r.id,
        topic: r.topic,
        decision: r.decision,
        reasoning: r.reasoning,
        outcome: r.outcome,
        confidence: r.confidence,
        similarity: r.similarity,
        created_at: r.created_at,
        age: formatAge(r.created_at),
        edges: r.edges,
      }

      // Add warning for failed decisions
      if (r.outcome === 'FAILED') {
        result.outcome_warning = '⚠️ This decision previously failed'
        if (r.outcome_reason) {
          result.outcome_reason = r.outcome_reason
        }
      } else if (r.outcome === 'PARTIAL') {
        result.outcome_warning = '⚡ This decision had partial success'
        if (r.outcome_reason) {
          result.outcome_reason = r.outcome_reason
        }
      }

      // Add stale warning (Story 11.12 - AC2)
      const staleWarning = getStaleWarning(r.created_at)
      if (staleWarning) {
        result.stale_warning = staleWarning
      }

      return result
    })

    logger.info(`mama_search: Found ${results.length} results for "${args.query || '(recent)'}"${args.domain ? ` in domain "${args.domain}"` : ''}`)

    return {
      success: true,
      data: {
        query: args.query || null,
        domain: args.domain || null,
        group_by_topic: args.group_by_topic || false,
        count: results.length,
        results: formattedResults,
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_search failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

// ============================================================
// mama_update Handler
// ============================================================

export interface UpdateArgs {
  id: string
  outcome: string
  reason?: string
}

/**
 * Handle mama_update tool call
 */
export async function handleMamaUpdate(args: UpdateArgs): Promise<ToolResponse> {
  try {
    await initMAMA()

    // Normalize outcome to uppercase
    const normalizedOutcome = args.outcome.toUpperCase() as 'SUCCESS' | 'FAILED' | 'PARTIAL'

    if (!['SUCCESS', 'FAILED', 'PARTIAL'].includes(normalizedOutcome)) {
      return {
        success: false,
        error: "outcome must be 'SUCCESS', 'FAILED', or 'PARTIAL'",
      }
    }

    await updateOutcome({
      id: args.id,
      outcome: normalizedOutcome,
      reason: args.reason,
    })

    logger.info(`mama_update: Decision ${args.id} outcome updated to ${normalizedOutcome}`)

    return {
      success: true,
      data: {
        id: args.id,
        outcome: normalizedOutcome,
        reason: args.reason || null,
        message: `Decision ${args.id} updated to ${normalizedOutcome}`,
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_update failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

// ============================================================
// mama_load_checkpoint Handler
// ============================================================

/**
 * Handle mama_load_checkpoint tool call
 */
export async function handleMamaLoadCheckpoint(): Promise<ToolResponse> {
  try {
    await initMAMA()

    const checkpoint = await loadCheckpoint()

    if (!checkpoint) {
      return {
        success: true,
        data: {
          found: false,
          message: 'No active checkpoint found. This appears to be a fresh session.',
        },
      }
    }

    logger.info(`mama_load_checkpoint: Loaded checkpoint ${checkpoint.id}`)

    return {
      success: true,
      data: {
        found: true,
        checkpoint: {
          id: checkpoint.id,
          timestamp: checkpoint.timestamp,
          age: formatAge(checkpoint.timestamp),
          summary: checkpoint.summary,
          open_files: checkpoint.open_files,
          next_steps: checkpoint.next_steps,
        },
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_load_checkpoint failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

// ============================================================
// mama_configure Handler
// ============================================================

export interface ConfigureArgs {
  action?: 'get' | 'set'
  contextInjection?: 'none' | 'hint' | 'full'
}

/**
 * Handle mama_configure tool call
 */
export async function handleMamaConfigure(args: ConfigureArgs): Promise<ToolResponse> {
  try {
    const action = args.action || 'get'

    if (action === 'set') {
      const updates: Record<string, unknown> = {}

      if (args.contextInjection) {
        if (!['none', 'hint', 'full'].includes(args.contextInjection)) {
          return {
            success: false,
            error: "contextInjection must be 'none', 'hint', or 'full'",
          }
        }
        updates.contextInjection = args.contextInjection
      }

      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'No valid settings to update' }
      }

      updateConfig(updates as Parameters<typeof updateConfig>[0])
      logger.info(`mama_configure: Settings updated`)
    }

    // Always return current config
    const config = loadConfig()
    const status = getStatus()

    return {
      success: true,
      data: {
        config: {
          modelName: config.modelName,
          embeddingDim: config.embeddingDim,
          contextInjection: config.contextInjection,
        },
        status: {
          initialized: status.initialized,
          dbReady: status.dbReady,
          embeddingReady: status.embeddingReady,
          vectorSearchEnabled: status.vectorSearchEnabled,
          tier: getTierDescription(status),
        },
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_configure failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Format timestamp age as human-readable string
 */
function formatAge(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay > 0) {
    return `${diffDay}d ago`
  } else if (diffHour > 0) {
    return `${diffHour}h ago`
  } else if (diffMin > 0) {
    return `${diffMin}m ago`
  } else {
    return 'just now'
  }
}

/**
 * Get tier description based on status
 */
function getTierDescription(status: ReturnType<typeof getStatus>): string {
  if (status.vectorSearchEnabled && status.embeddingReady) {
    return 'Tier 1 (Full): Vector search + Embeddings'
  } else if (status.embeddingReady) {
    return 'Tier 2 (Limited): Embeddings only, no sqlite-vec'
  } else {
    return 'Tier 3 (Basic): Keyword search only'
  }
}

// ============================================================
// mama_edit_hint Handler
// ============================================================

export interface EditHintArgs {
  action: 'add' | 'update' | 'delete' | 'list'
  tool_name?: string
  hint_text?: string
  hint_id?: number
  priority?: number
  tags?: string[]
}

/**
 * Handle mama_edit_hint tool call
 */
// ============================================================
// mama_set_skill_level Handler
// ============================================================

export interface SetSkillLevelArgs {
  level: string
  domain?: string
}

/**
 * Handle mama_set_skill_level tool call
 */
export async function handleMamaSetSkillLevel(args: SetSkillLevelArgs): Promise<ToolResponse> {
  try {
    await initMAMA()

    // Validate level
    const validLevels: SkillLevel[] = ['beginner', 'intermediate', 'expert']
    if (!args.level || !validLevels.includes(args.level as SkillLevel)) {
      return {
        success: false,
        error: `level must be one of: ${validLevels.join(', ')}`,
      }
    }

    const level = args.level as SkillLevel
    const result = setSkillLevel(level, args.domain)

    if (!result.success) {
      return { success: false, error: result.message }
    }

    // Get updated profile
    const profile = getSkillProfile()

    logger.info(`mama_set_skill_level: ${result.message}`)

    return {
      success: true,
      data: {
        message: result.message,
        profile: {
          globalLevel: profile.globalLevel,
          domainLevels: profile.domainLevels,
        },
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_set_skill_level failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

export async function handleMamaEditHint(args: EditHintArgs): Promise<ToolResponse> {
  try {
    await initMAMA()

    switch (args.action) {
      case 'add': {
        if (!args.tool_name) {
          return { success: false, error: 'tool_name is required for add' }
        }
        if (!args.hint_text) {
          return { success: false, error: 'hint_text is required for add' }
        }

        const hintId = addHint({
          tool_name: args.tool_name,
          hint_text: args.hint_text,
          priority: args.priority,
          tags: args.tags,
        })

        logger.info(`mama_edit_hint: Added hint ${hintId} for ${args.tool_name}`)

        return {
          success: true,
          data: {
            action: 'add',
            hint_id: hintId,
            tool_name: args.tool_name,
            message: `Hint added. ID: ${hintId}`,
          },
        }
      }

      case 'update': {
        if (!args.hint_id) {
          return { success: false, error: 'hint_id is required for update' }
        }

        const updated = updateHint({
          hint_id: args.hint_id,
          hint_text: args.hint_text,
          priority: args.priority,
          tags: args.tags,
        })

        if (!updated) {
          return { success: false, error: `Hint not found: ${args.hint_id}` }
        }

        logger.info(`mama_edit_hint: Updated hint ${args.hint_id}`)

        return {
          success: true,
          data: {
            action: 'update',
            hint_id: args.hint_id,
            message: `Hint ${args.hint_id} updated`,
          },
        }
      }

      case 'delete': {
        if (!args.hint_id) {
          return { success: false, error: 'hint_id is required for delete' }
        }

        const deleted = deleteHint(args.hint_id)

        if (!deleted) {
          return { success: false, error: `Hint not found: ${args.hint_id}` }
        }

        logger.info(`mama_edit_hint: Deleted hint ${args.hint_id}`)

        return {
          success: true,
          data: {
            action: 'delete',
            hint_id: args.hint_id,
            message: `Hint ${args.hint_id} deleted`,
          },
        }
      }

      case 'list': {
        const hints = listHints(args.tool_name)

        return {
          success: true,
          data: {
            action: 'list',
            tool_name: args.tool_name || 'all',
            count: hints.length,
            hints: hints.map((h) => ({
              id: h.id,
              tool_name: h.tool_name,
              hint_text: h.hint_text,
              priority: h.priority,
              tags: h.tags ? JSON.parse(h.tags) : [],
              source: h.source,
            })),
          },
        }
      }

      default:
        return {
          success: false,
          error: `Invalid action: ${args.action}. Use 'add', 'update', 'delete', or 'list'`,
        }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_edit_hint failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

// ============================================================
// mama_health Handler
// ============================================================

export interface HealthArgs {
  verbose?: boolean
}

/**
 * Handle mama_health tool call
 *
 * Story 11.11: Graph Health Metrics
 */
export async function handleMamaHealth(args: HealthArgs): Promise<ToolResponse> {
  try {
    await initMAMA()

    const health = calculateGraphHealth()

    if (args.verbose) {
      // Verbose mode: return full formatted report
      const report = formatHealthReport(health)

      logger.info(`mama_health: Score=${health.healthScore}, ${health.warnings.length} warnings`)

      return {
        success: true,
        data: {
          healthScore: health.healthScore,
          report,
          metrics: {
            totalDecisions: health.totalDecisions,
            totalEdges: health.totalEdges,
            orphanCount: health.orphanCount,
            orphanRatio: health.orphanRatio,
            edgeTypeCounts: health.edgeTypeCounts,
            edgeTypeRatios: health.edgeTypeRatios,
            staleDecisions: health.staleDecisions,
          },
          warnings: health.warnings,
        },
      }
    }

    // Compact mode: return summary
    const summary = getSummary(health)

    logger.info(`mama_health: Score=${health.healthScore}`)

    return {
      success: true,
      data: {
        healthScore: health.healthScore,
        summary,
        warningCount: health.warnings.length,
        warnings: health.warnings,
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_health failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

/**
 * Get compact health summary
 */
function getSummary(health: GraphHealth): string {
  const scoreEmoji = health.healthScore >= 80 ? '🟢' : health.healthScore >= 50 ? '🟡' : '🔴'
  return `${scoreEmoji} Health: ${health.healthScore}/100 | ${health.totalDecisions} decisions | ${health.totalEdges} edges | ${health.warnings.length} warnings`
}

// ============================================================
// mama_growth_report Handler
// ============================================================

export interface GrowthReportArgs {
  period_days?: number
}

/**
 * Handle mama_growth_report tool call
 *
 * Story 11.14: User Growth Metrics
 */
export async function handleMamaGrowthReport(args: GrowthReportArgs): Promise<ToolResponse> {
  try {
    await initMAMA()

    const periodDays = args.period_days || 30
    const summary: GrowthSummary = getGrowthSummary(periodDays, 'manual')
    const report = formatGrowthReport(summary)

    logger.info(`mama_growth_report: ${periodDays} days, independent ratio=${summary.independentRatio.secondHalf}%`)

    return {
      success: true,
      data: {
        period_days: periodDays,
        report,
        metrics: summary.metrics,
        independentRatio: summary.independentRatio,
        newConceptsLearned: summary.newConceptsLearned,
        shouldUpgradeSkillLevel: summary.shouldUpgradeSkillLevel,
        daysActive: summary.daysActive,
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_growth_report failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}
