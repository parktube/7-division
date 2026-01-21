/**
 * SessionInit Hook Implementation
 *
 * Story 11.5: SessionStart Hook (onSessionInit)
 *
 * Loads checkpoint and recent decisions at session start.
 * Formats output based on contextInjection mode (none/hint/full).
 */

import { getContextInjection } from '../config.js'
import { loadCheckpoint, searchDecisions, type CheckpointResult, type DecisionResult } from '../index.js'

// ============================================================
// Types
// ============================================================

export interface SessionInitResult {
  checkpoint: CheckpointResult | null
  recentDecisions: DecisionResult[]
  contextMode: 'none' | 'hint' | 'full'
  formattedContext: string
}

// ============================================================
// Implementation
// ============================================================

/**
 * Execute session initialization hook
 *
 * 1. Load latest checkpoint
 * 2. Load recent decisions (5)
 * 3. Format based on contextInjection mode
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
    }
  }

  // Load checkpoint and recent decisions
  const [checkpoint, decisions] = await Promise.all([loadCheckpoint(), searchDecisions({ limit: 5 })])

  const result: SessionInitResult = {
    checkpoint,
    recentDecisions: decisions,
    contextMode,
    formattedContext: '',
  }

  // Format based on mode
  if (contextMode === 'full') {
    result.formattedContext = formatFullContext(checkpoint, decisions)
  } else {
    // hint mode
    result.formattedContext = formatHintContext(checkpoint, decisions)
  }

  return result
}

/**
 * Format full context with all details
 */
function formatFullContext(checkpoint: CheckpointResult | null, decisions: DecisionResult[]): string {
  const lines: string[] = []

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
  }

  return lines.join('\n')
}

/**
 * Format hint context with summary only
 */
function formatHintContext(checkpoint: CheckpointResult | null, decisions: DecisionResult[]): string {
  const parts: string[] = []

  if (checkpoint) {
    parts.push('1 checkpoint found')
  }

  if (decisions.length > 0) {
    parts.push(`${decisions.length} related decisions available`)
  }

  if (parts.length === 0) {
    return ''
  }

  return `🔍 ${parts.join(', ')}\n💡 Use mama_checkpoint() and mama_search() for details`
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
 * Format timestamp as human-readable age
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
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (!str) return ''
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen - 3) + '...'
}
