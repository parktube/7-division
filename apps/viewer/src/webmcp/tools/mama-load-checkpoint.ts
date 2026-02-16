/**
 * viewer.mama_load_checkpoint - Resume previous session
 */

import { executeMCPTool } from '../mcp-bridge'
import { ok, err, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

export const mamaLoadCheckpointTool: WebMcpToolDefinition = {
  name: 'viewer.mama_load_checkpoint',
  description: 'Resume previous session from last checkpoint. Returns summary, next_steps, and open_files.',
  execute: async (_payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    try {
      const result = await executeMCPTool('mama_load_checkpoint', {})
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
