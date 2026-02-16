/**
 * viewer.mama_health - Check reasoning graph health
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const MamaHealthInputSchema = z.object({
  verbose: z.boolean().optional(),
})


export const mamaHealthTool: WebMcpToolDefinition = {
  name: 'viewer.mama_health',
  description: 'Check reasoning graph health metrics (orphans, staleness, edge distribution).',
  inputSchema: {
    type: 'object',
    properties: {
      verbose: { type: 'boolean' },
    },
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(MamaHealthInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    try {
      const result = await executeMCPTool('mama_health', validated.data)
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
