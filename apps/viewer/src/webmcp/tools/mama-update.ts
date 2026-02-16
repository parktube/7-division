/**
 * viewer.mama_update - Update decision outcome
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const MamaUpdateInputSchema = z.object({
  id: z.string(),
  outcome: z.string(),
  reason: z.string().optional(),
})


export const mamaUpdateTool: WebMcpToolDefinition = {
  name: 'viewer.mama_update',
  description: 'Update decision outcome (success/failed/partial) after validation.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      outcome: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['id', 'outcome'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(MamaUpdateInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    try {
      const result = await executeMCPTool('mama_update', validated.data)
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
