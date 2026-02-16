/**
 * WebMCP Model Context API Detection
 *
 * Chrome WebMCP Early Preview API 감지 및 접근
 * https://chromestatus.com/feature/5127871893405696
 */

/**
 * WebMCP Tool interface (Chrome 146+)
 */
export interface WebMcpTool {
  name: string
  description: string
  inputSchema?: Record<string, unknown>
  execute: (payload: { input: unknown }) => Promise<unknown>
}

/**
 * WebMCP Model Context interface (Chrome 146+)
 */
export interface ModelContext {
  registerTool(tool: WebMcpTool): void
  unregisterTool(name: string): void
}

/**
 * Extended window interface with model context
 */
declare global {
  interface Window {
    ai?: {
      modelContext?: ModelContext
    }
  }
}

/**
 * Check if WebMCP API is available
 */
export function hasWebMcp(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.ai?.modelContext !== 'undefined'
}

/**
 * Get Model Context instance (returns null if not available)
 */
export function getModelContext(): ModelContext | null {
  if (!hasWebMcp()) return null
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return window.ai!.modelContext!
}
