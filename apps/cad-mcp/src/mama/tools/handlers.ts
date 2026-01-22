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
import { formatAge } from '../utils.js'
import { setSkillLevel, getSkillProfile, type SkillLevel } from '../mentoring.js'

// Constants
const DEFAULT_BUILTIN_SIMILARITY = 0.8
import { loadConfig, updateConfig } from '../config.js'
import { calculateGraphHealth, formatHealthReport, type GraphHealth } from '../health.js'
import { analyzeDecisionBeforeSave, getStaleWarning, type AntiEchoWarning } from '../anti-echo.js'
import {
  saveLearning,
  markUnderstood,
  recordApplication,
  getLearningByConcept,
  type SaveLearningResult,
} from '../learning-tracker.js'
import { getGrowthSummary, formatGrowthReport, type GrowthSummary } from '../growth-tracker.js'
import {
  recommendModules,
  syncModulesFromFiles,
} from '../module-recommender.js'
import {
  searchBuiltinKnowledge,
  listBuiltinDomains,
  type BuiltinDecision,
} from '../builtin-knowledge.js'
import {
  handleMamaWorkflow as handleWorkflow,
  type WorkflowInput,
} from '../workflow.js'

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
  type: 'decision' | 'checkpoint' | 'learning' | 'understood' | 'applied'
  // Decision fields
  topic?: string
  decision?: string
  reasoning?: string
  confidence?: number
  // Checkpoint fields
  summary?: string
  open_files?: string[]
  next_steps?: string
  // Learning fields (Story 11.13, 11.17)
  concept?: string
  domain?: string
  user_explanation?: string  // Story 11.17: 사용자의 이해 설명
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
    } else if (args.type === 'understood') {
      // Story 11.17: Mark concept as understood
      if (!args.concept) {
        return { success: false, error: 'concept is required for type=understood' }
      }

      // Check if concept exists
      const existing = getLearningByConcept(args.concept)
      if (!existing) {
        return {
          success: false,
          error: `Concept not found: "${args.concept}". Use type='learning' to introduce new concepts first.`,
        }
      }

      markUnderstood(args.concept, args.user_explanation)

      logger.info(`mama_save: Concept "${args.concept}" marked as understood`)

      return {
        success: true,
        data: {
          type: 'understood',
          concept: args.concept,
          previous_level: existing.understanding_level,
          new_level: Math.max(existing.understanding_level, 2),
          message: `Concept "${args.concept}" marked as understood (level: 2)`,
        },
      }
    } else if (args.type === 'applied') {
      // Story 11.17: Record concept application
      if (!args.concept) {
        return { success: false, error: 'concept is required for type=applied' }
      }

      // Check if concept exists
      const existing = getLearningByConcept(args.concept)
      if (!existing) {
        return {
          success: false,
          error: `Concept not found: "${args.concept}". Use type='learning' to introduce new concepts first.`,
        }
      }

      const newCount = recordApplication(args.concept)
      const updated = getLearningByConcept(args.concept)

      logger.info(`mama_save: Concept "${args.concept}" applied (count: ${newCount})`)

      return {
        success: true,
        data: {
          type: 'applied',
          concept: args.concept,
          applied_count: newCount,
          understanding_level: updated?.understanding_level || existing.understanding_level,
          mastered: (updated?.understanding_level || 0) >= 4,
          message: newCount >= 3 && (updated?.understanding_level || 0) >= 4
            ? `Concept "${args.concept}" applied ${newCount} times - MASTERED! 🎉`
            : `Concept "${args.concept}" applied (count: ${newCount})`,
        },
      }
    } else {
      return { success: false, error: "type must be 'decision', 'checkpoint', 'learning', 'understood', or 'applied'" }
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
 *
 * Story 11.20: Dual-source support - searches both user decisions and builtin knowledge
 */
export async function handleMamaSearch(args: SearchArgs): Promise<ToolResponse> {
  try {
    await initMAMA()

    // Handle list_domains special case
    if (args.list_domains) {
      const userDomains = await listDomains()
      const builtinDomains = listBuiltinDomains()

      // Merge and dedupe domains
      const allDomains = [...new Set([...userDomains, ...builtinDomains])].sort()

      logger.info(`mama_search: Listed ${allDomains.length} domains (${userDomains.length} user, ${builtinDomains.length} builtin)`)

      return {
        success: true,
        data: {
          list_domains: true,
          count: allDomains.length,
          domains: allDomains,
        },
      }
    }

    // Search user decisions
    const userResults = await searchDecisions({
      query: args.query,
      limit: args.limit || 10,
      type: args.type || 'all',
      domain: args.domain,
      group_by_topic: args.group_by_topic,
      outcome_filter: args.outcome_filter,
    })

    // Search builtin knowledge (Story 11.20)
    // Skip if outcome_filter is set (builtin doesn't have outcomes)
    const builtinResults: BuiltinDecision[] = args.outcome_filter
      ? []
      : searchBuiltinKnowledge(args.query, {
          limit: args.limit || 10,
          domain: args.domain,
        })

    // Format user results for LLM consumption
    const formattedUserResults = userResults.map((r: DecisionResult) => {
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
        source: 'user',  // Story 11.20: Add source field
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

    // Format builtin results (Story 11.20)
    const formattedBuiltinResults = builtinResults.map((r: BuiltinDecision) => ({
      id: r.id,
      topic: r.topic,
      decision: r.decision,
      reasoning: r.reasoning,
      outcome: null,
      confidence: r.confidence,
      similarity: DEFAULT_BUILTIN_SIMILARITY,
      created_at: null,
      age: 'builtin',
      edges: null,
      source: 'builtin',  // Story 11.20: Add source field
    }))

    // Merge results: user first, then builtin (avoiding duplicates by topic)
    const seenTopics = new Set(formattedUserResults.map((r) => r.topic as string))
    const mergedBuiltin = formattedBuiltinResults.filter((r) => !seenTopics.has(r.topic))

    const allResults = [...formattedUserResults, ...mergedBuiltin]

    // Apply limit if needed
    const limit = args.limit || 10
    const limitedResults = allResults.slice(0, limit)

    logger.info(
      `mama_search: Found ${limitedResults.length} results ` +
      `(${formattedUserResults.length} user, ${mergedBuiltin.length} builtin) ` +
      `for "${args.query || '(recent)'}"${args.domain ? ` in domain "${args.domain}"` : ''}`
    )

    return {
      success: true,
      data: {
        query: args.query || null,
        domain: args.domain || null,
        group_by_topic: args.group_by_topic || false,
        count: limitedResults.length,
        results: limitedResults,
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

    // Normalize and validate outcome
    const normalizedOutcome = args.outcome.toUpperCase()
    const validOutcomes = ['SUCCESS', 'FAILED', 'PARTIAL'] as const

    if (!validOutcomes.includes(normalizedOutcome as typeof validOutcomes[number])) {
      return {
        success: false,
        error: "outcome must be 'SUCCESS', 'FAILED', or 'PARTIAL'",
      }
    }

    // Safe cast after validation
    const validatedOutcome = normalizedOutcome as 'SUCCESS' | 'FAILED' | 'PARTIAL'

    await updateOutcome({
      id: args.id,
      outcome: validatedOutcome,
      reason: args.reason,
    })

    logger.info(`mama_update: Decision ${args.id} outcome updated to ${validatedOutcome}`)

    return {
      success: true,
      data: {
        id: args.id,
        outcome: validatedOutcome,
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
  action?: 'get' | 'set' | 'debug'
  contextInjection?: 'none' | 'hint' | 'full'
}

/**
 * Handle mama_configure tool call
 */
export async function handleMamaConfigure(args: ConfigureArgs): Promise<ToolResponse> {
  try {
    const action = args.action || 'get'

    // Debug: Show current tool descriptions with injected hints
    if (action === 'debug') {
      const { executePreToolList } = await import('../hooks/pre-tool-list.js')

      // Mock tools to test hint injection
      const testTools = [
        { name: 'glob', description: 'CAD 파일 목록 조회.', inputSchema: {} },
        { name: 'read', description: '파일 읽기.', inputSchema: {} },
        { name: 'edit', description: '파일 부분 수정.', inputSchema: {} },
        { name: 'write', description: '파일 전체 작성.', inputSchema: {} },
        { name: 'lsp', description: '코드 탐색.', inputSchema: {} },
        { name: 'bash', description: '명령 실행.', inputSchema: {} },
      ]

      const enhanced = executePreToolList(testTools)
      const results: Record<string, { original: string; enhanced: string; hints: string[] }> = {}

      for (let i = 0; i < testTools.length; i++) {
        const orig = testTools[i]
        const enh = enhanced[i]
        const hints = (enh.description.match(/💡 .+/g) || [])
        results[orig.name] = {
          original: orig.description,
          enhanced: enh.description,
          hints,
        }
      }

      return {
        success: true,
        data: {
          action: 'debug',
          hint_injection_test: results,
          tools_with_hints: Object.entries(results).filter(([, v]) => v.hints.length > 0).map(([k]) => k),
        },
      }
    }

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

// ============================================================
// mama_edit_hint Handler
// ============================================================

/**
 * Handle mama_edit_hint tool call
 */
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
            hints: hints.map((h) => {
              let parsedTags: string[] = [];
              if (h.tags) {
                try {
                  parsedTags = JSON.parse(h.tags);
                } catch {
                  // Invalid JSON tags - use empty array
                }
              }
              return {
                id: h.id,
                tool_name: h.tool_name,
                hint_text: h.hint_text,
                priority: h.priority,
                tags: parsedTags,
                source: h.source,
              };
            }),
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

// ============================================================
// mama_recommend_modules Handler (Story 11.19)
// ============================================================

export interface RecommendModulesArgs {
  query: string
  limit?: number
  min_score?: number
  tags?: string[]
  sync_first?: boolean
}

/**
 * Handle mama_recommend_modules tool call
 *
 * Story 11.19: Module Library Recommendation
 */
export async function handleMamaRecommendModules(
  args: RecommendModulesArgs
): Promise<ToolResponse> {
  try {
    await initMAMA()

    // Sync modules from files if requested
    if (args.sync_first) {
      const synced = await syncModulesFromFiles()
      logger.info(`mama_recommend_modules: Synced ${synced} modules`)
    }

    // Get recommendations
    const recommendations = await recommendModules(args.query, {
      limit: args.limit,
      minScore: args.min_score,
      tags: args.tags,
    })

    logger.info(
      `mama_recommend_modules: Found ${recommendations.length} modules for query "${args.query}"`
    )

    return {
      success: true,
      data: {
        query: args.query,
        count: recommendations.length,
        recommendations: recommendations.map((r) => ({
          name: r.name,
          description: r.description,
          tags: r.tags,
          score: Math.round(r.score * 100) / 100,
          scoreBreakdown: {
            semantic: Math.round(r.scoreBreakdown.semantic * 100) / 100,
            usage: Math.round(r.scoreBreakdown.usage * 100) / 100,
            recency: Math.round(r.scoreBreakdown.recency * 100) / 100,
          },
          example: r.example,
        })),
      },
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_recommend_modules failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}

// ============================================================
// mama_workflow Handler (Story 11.21)
// ============================================================

export interface WorkflowArgs {
  command: string
  project_name?: string
  description?: string
  phase?: string
  content?: string
  artifact_type?: string
}

/**
 * Handle mama_workflow tool call
 *
 * Commands: start, status, next, goto, list, artifact
 */
export async function handleMamaWorkflow(args: WorkflowArgs): Promise<ToolResponse> {
  try {
    await initMAMA()

    const result = handleWorkflow({
      command: args.command as WorkflowInput['command'],
      project_name: args.project_name,
      description: args.description,
      phase: args.phase as WorkflowInput['phase'],
      content: args.content,
      artifact_type: args.artifact_type,
    })

    if (result.success) {
      logger.info(`mama_workflow: ${args.command} completed`)
      return { success: true, data: result.data }
    } else {
      logger.warn(`mama_workflow: ${args.command} failed - ${result.error}`)
      return { success: false, error: result.error }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`mama_workflow failed: ${errorMsg}`)
    return { success: false, error: errorMsg }
  }
}
