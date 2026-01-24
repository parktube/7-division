/**
 * MAMA Hooks - Index
 *
 * Story 11.5-11.7: MAMA Lifecycle Hooks
 *
 * Re-exports all hook implementations and registry.
 */

// Registry
export { hookRegistry, type HookRegistry } from './registry.js'

// Session Init (Story 11.5)
export {
  executeSessionInit,
  type SessionInitResult,
} from './session-init.js'

// Pre-Tool List (Story 11.6)
export {
  executePreToolList,
  addHint,
  updateHint,
  deleteHint,
  listHints,
  invalidateHintCache,
  type AddHintParams,
  type UpdateHintParams,
  type HintRow,
} from './pre-tool-list.js'

// Post-Execute (Story 11.7)
export {
  executePostExecute,
  formatActionHints,
  extractEntityNames,
  extractFromResult,
  shouldGenerateHints,
} from './post-execute.js'
