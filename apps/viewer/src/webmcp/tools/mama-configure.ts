/**
 * viewer.mama_configure - View or modify MAMA configuration
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const MamaConfigureInputSchema = z.object({
  action: z.enum(['get', 'set']).optional(),
  contextInjection: z.enum(['none', 'hint', 'full']).optional(),
})


export const mamaConfigureTool: WebMcpToolDefinition = {
  name: 'viewer.mama_configure',
  description: 'View or modify MAMA configuration (database, embedding model, context injection).',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['get', 'set'] },
      contextInjection: { type: 'string', enum: ['none', 'hint', 'full'] },
    },
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(MamaConfigureInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    try {
      const result = await executeMCPTool('mama_configure', validated.data)
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
