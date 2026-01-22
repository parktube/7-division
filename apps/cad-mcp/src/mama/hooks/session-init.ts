/**
 * SessionInit Hook Implementation
 *
 * Story 11.5: SessionStart Hook (onSessionInit)
 * Story 11.11: Graph Health Metrics (health check at session start)
 * Story 11.21: Design Workflow integration
 *
 * Loads checkpoint and recent decisions at session start.
 * Formats output based on contextInjection mode (none/hint/full).
 * Includes graph health warnings when applicable.
 * Shows active workflow project status.
 */

import { getContextInjection } from '../config.js'
import { loadCheckpoint, searchDecisions, type CheckpointResult, type DecisionResult } from '../index.js'
import { calculateGraphHealth, getHealthSummary } from '../health.js'
import { getSessionLearningHints, formatLearningHints, type LearningHint } from '../learning-tracker.js'
import { getWorkflowStatusForSession } from '../workflow.js'
import { formatAge } from '../utils.js'
import { logger } from '../../logger.js'

// ============================================================
// Types
// ============================================================

export interface WorkflowStatus {
  hasActiveProject: boolean
  project?: {
    id: string
    name: string
    phase: string
    progress: string
  }
  nextSteps?: string[]
}

export interface SessionInitResult {
  checkpoint: CheckpointResult | null
  recentDecisions: DecisionResult[]
  contextMode: 'none' | 'hint' | 'full'
  formattedContext: string
  healthWarning: string | null  // Story 11.11
  learningHints: LearningHint[]  // Story 11.13
  workflowStatus: WorkflowStatus | null  // Story 11.21
}

// ============================================================
// Implementation
// ============================================================

/**
 * Execute session initialization hook
 *
 * 1. Load latest checkpoint
 * 2. Load recent decisions (5)
 * 3. Check graph health (Story 11.11)
 * 4. Format based on contextInjection mode
 */
export async function executeSessionInit(): Promise<SessionInitResult> {
  const contextMode = getContextInjection()

  // None mode: return empty context immediately
  if (contextMode === 'none') {
    return {
      checkpoint: null,
      recentDecisions: [],
      contextMode: 'none',
      formattedContext: '',
      healthWarning: null,
      learningHints: [],
      workflowStatus: null,
    }
  }

  // Load checkpoint and recent decisions
  const [checkpoint, decisions] = await Promise.all([loadCheckpoint(), searchDecisions({ limit: 5 })])

  // Check graph health (Story 11.11)
  let healthWarning: string | null = null
  try {
    const health = calculateGraphHealth()
    healthWarning = getHealthSummary(health)
  } catch (error) {
    logger.debug(`Health check skipped: ${error}`)
  }

  // Get learning hints (Story 11.13)
  let learningHints: LearningHint[] = []
  try {
    learningHints = getSessionLearningHints()
  } catch (error) {
    logger.debug(`Learning hints skipped: ${error}`)
  }

  // Get workflow status (Story 11.21)
  let workflowStatus: WorkflowStatus | null = null
  try {
    workflowStatus = getWorkflowStatusForSession()
  } catch (error) {
    logger.debug(`Workflow status skipped: ${error}`)
  }

  const result: SessionInitResult = {
    checkpoint,
    recentDecisions: decisions,
    contextMode,
    formattedContext: '',
    healthWarning,
    learningHints,
    workflowStatus,
  }

  // Format based on mode
  if (contextMode === 'full') {
    result.formattedContext = formatFullContext(checkpoint, decisions, healthWarning, learningHints, workflowStatus)
  } else {
    // hint mode
    result.formattedContext = formatHintContext(checkpoint, decisions, healthWarning, learningHints, workflowStatus)
  }

  return result
}

/**
 * Format full context with all details
 */
function formatFullContext(
  checkpoint: CheckpointResult | null,
  decisions: DecisionResult[],
  healthWarning: string | null = null,
  learningHints: LearningHint[] = [],
  workflowStatus: WorkflowStatus | null = null
): string {
  const lines: string[] = []

  // Proactive Greeting Instruction (맨 앞에 위치 - 훅 없이도 작동하도록)
  lines.push('🤖 **PROACTIVE GREETING INSTRUCTION:**')
  lines.push('   If the user\'s first message is a simple greeting ("hi", "hello", "안녕"),')
  lines.push('   YOU MUST proactively initiate a contextual conversation:')
  lines.push('   1. Greet the user warmly in their language')
  lines.push('   2. Summarize what was being worked on from the last checkpoint (if exists)')
  lines.push('   3. Highlight 1-2 recent key decisions that might be relevant')
  lines.push('   4. Ask if they want to continue previous work or start something new')
  lines.push('   5. Suggest specific next steps based on checkpoint\'s next_steps')
  lines.push('')

  // Health warning section (Story 11.11)
  if (healthWarning) {
    lines.push(`📊 **Graph Health:**`)
    lines.push(`   ${healthWarning}`)
    lines.push('')
  }

  // Workflow status section (Story 11.21)
  if (workflowStatus?.hasActiveProject && workflowStatus.project) {
    const p = workflowStatus.project
    lines.push(`🎨 **Active Design Project:**`)
    lines.push(`   Project: ${p.name}`)
    lines.push(`   Phase: ${p.phase} (${p.progress})`)
    if (workflowStatus.nextSteps && workflowStatus.nextSteps.length > 0) {
      lines.push(`   Questions: ${workflowStatus.nextSteps[0]}`)
    }
    lines.push(`   Use mama_workflow({ command: 'status' }) for details`)
    lines.push('')
  }

  // Checkpoint section
  if (checkpoint) {
    const age = formatAge(checkpoint.timestamp)
    lines.push(`📍 **Last Checkpoint** (${age}):`)
    lines.push(`   ${truncate(checkpoint.summary, 200)}`)
    if (checkpoint.next_steps) {
      lines.push(`   Next: ${truncate(checkpoint.next_steps, 150)}`)
    }
    if (checkpoint.open_files && checkpoint.open_files.length > 0) {
      lines.push(`   Files: ${checkpoint.open_files.slice(0, 3).join(', ')}`)
    }
    lines.push('')
  }

  // Recent decisions section
  if (decisions.length > 0) {
    lines.push(`🧠 **Recent Decisions** (${decisions.length}):`)
    for (let i = 0; i < decisions.length; i++) {
      const d = decisions[i]
      const outcomeIcon = getOutcomeIcon(d.outcome)
      const age = formatAge(d.created_at)
      const summary = truncate(d.decision, 60)
      lines.push(`   ${i + 1}. ${outcomeIcon} ${d.topic}: ${summary} (${age})`)
    }
    lines.push('')
  }

  // Learning hints section (Story 11.13)
  const learningHintsStr = formatLearningHints(learningHints)
  if (learningHintsStr) {
    lines.push(learningHintsStr)
  }

  // Learning guide section (Story 11.17)
  if (learningHints.length > 0) {
    lines.push('')
    lines.push('💡 **Learning 활용 가이드**:')
    lines.push('   • 새 개념 설명 후 → mama_save(type="learning", concept="개념명")')
    lines.push('   • 사용자 "이해됐어" → mama_save(type="understood", concept="개념명")')
    lines.push('   • 사용자가 개념 적용 시 → mama_save(type="applied", concept="개념명")')
  }

  return lines.join('\n')
}

/**
 * Format hint context with summary only
 */
function formatHintContext(
  checkpoint: CheckpointResult | null,
  decisions: DecisionResult[],
  healthWarning: string | null = null,
  learningHints: LearningHint[] = [],
  workflowStatus: WorkflowStatus | null = null
): string {
  const parts: string[] = []

  if (checkpoint) {
    parts.push('1 checkpoint found')
  }

  if (decisions.length > 0) {
    parts.push(`${decisions.length} related decisions available`)
  }

  if (learningHints.length > 0) {
    parts.push(`${learningHints.length} concept(s) learned`)
  }

  // Add workflow status (Story 11.21)
  if (workflowStatus?.hasActiveProject && workflowStatus.project) {
    parts.push(`project "${workflowStatus.project.name}" in ${workflowStatus.project.phase}`)
  }

  if (parts.length === 0 && !healthWarning) {
    return ''
  }

  let result = ''
  if (parts.length > 0) {
    result = `🔍 ${parts.join(', ')}\n💡 Use mama_checkpoint() and mama_search() for details`
  }

  // Add health warning in hint mode (Story 11.11)
  if (healthWarning) {
    result = result ? `${result}\n${healthWarning}` : healthWarning
  }

  return result
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get outcome icon for decision
 */
function getOutcomeIcon(outcome: string | null): string {
  switch (outcome) {
    case 'SUCCESS':
      return '✅'
    case 'FAILED':
      return '❌'
    case 'PARTIAL':
      return '⚡'
    default:
      return '⏳' // pending
  }
}


/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (!str) return ''
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen - 3) + '...'
}
