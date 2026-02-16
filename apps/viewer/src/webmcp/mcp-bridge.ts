/**
 * WebMCP to Local MCP Bridge
 *
 * Sends commands to MCP server via WebSocket and waits for response
 */

import { getWebSocket } from '@/hooks/useWebSocket'

interface MCPCommandRequest {
  id: string
  tool: string
  params: unknown
}

interface MCPCommandResponse {
  id: string
  result?: unknown
  error?: string
}

// Pending command promises
const pendingCommands = new Map<string, {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
}>()

/**
 * Execute MCP tool via WebSocket
 */
export async function executeMCPTool(tool: string, params: unknown): Promise<unknown> {
  const ws = getWebSocket()

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket not connected to MCP server')
  }

  // Generate unique request ID
  const id = `webmcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Create promise for response
  const promise = new Promise((resolve, reject) => {
    pendingCommands.set(id, { resolve, reject })

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingCommands.has(id)) {
        pendingCommands.delete(id)
        reject(new Error(`MCP command timeout: ${tool}`))
      }
    }, 30000)
  })

  // Send command
  const request: MCPCommandRequest = { id, tool, params }
  ws.send(JSON.stringify({
    type: 'mcp_command',
    data: request,
    timestamp: Date.now(),
  }))

  return promise
}

/**
 * Handle MCP response from server
 * Called by WebSocket message handler
 */
export function handleMCPResponse(response: MCPCommandResponse): void {
  const pending = pendingCommands.get(response.id)
  if (!pending) {
    console.warn(`[WebMCP] Received response for unknown command: ${response.id}`)
    return
  }

  pendingCommands.delete(response.id)

  if (response.error) {
    pending.reject(new Error(response.error))
  } else {
    pending.resolve(response.result)
  }
}
