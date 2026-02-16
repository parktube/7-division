/**
 * WebMCP Tool Registration
 *
 * 도구 등록/해제 로직
 */

import { getModelContext, type WebMcpTool } from './model-context'
import { allTools } from './tools'
import type { WebMcpToolDefinition, ToolPayload } from './types'

/**
 * Registered tool names (for cleanup)
 */
let registeredTools: string[] = []

/**
 * Convert tool definition to WebMCP tool format
 */
function toWebMcpTool(def: WebMcpToolDefinition): WebMcpTool {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    execute: async (payload: { input: unknown }) => {
      // Handle WebMCP payload format
      // WebMCP sends parameters directly: { ids: [...] }
      // We need to wrap it as { input: {...} } for our tools
      const toolPayload: ToolPayload = {
        input: payload?.input ?? payload ?? {},
      }

      const result = await def.execute(toolPayload)
      // Return data directly for success, throw for error
      if (result.ok) {
        return result.data
      } else {
        throw new Error(result.error)
      }
    },
  }
}

/**
 * Register all WebMCP tools
 * @returns true if registration succeeded, false if WebMCP not available
 */
export function registerWebMcpTools(): boolean {
  const ctx = getModelContext()
  if (!ctx) {
    console.log('[WebMCP] API not available, skipping registration')
    return false
  }

  // Unregister existing tools first
  unregisterWebMcpTools()

  // Register all tools
  for (const tool of allTools) {
    try {
      ctx.registerTool(toWebMcpTool(tool))
      registeredTools.push(tool.name)
      console.log(`[WebMCP] Registered tool: ${tool.name}`)
    } catch (e) {
      console.error(`[WebMCP] Failed to register tool ${tool.name}:`, e)
    }
  }

  console.log(`[WebMCP] Registered ${registeredTools.length} tools`)
  return true
}

/**
 * Unregister all WebMCP tools
 */
export function unregisterWebMcpTools(): void {
  const ctx = getModelContext()
  if (!ctx) return

  for (const name of registeredTools) {
    try {
      ctx.unregisterTool(name)
      console.log(`[WebMCP] Unregistered tool: ${name}`)
    } catch (e) {
      console.error(`[WebMCP] Failed to unregister tool ${name}:`, e)
    }
  }

  registeredTools = []
}
