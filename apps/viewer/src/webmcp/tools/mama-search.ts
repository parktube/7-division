/**
 * viewer.mama_search - Search MAMA memory
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const MamaSearchInputSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['all', 'decision', 'checkpoint']).optional(),
  limit: z.number().optional(),
  domain: z.string().optional(),
  outcome_filter: z.string().optional(),
  group_by_topic: z.boolean().optional(),
  list_domains: z.boolean().optional(),
})


export const mamaSearchTool: WebMcpToolDefinition = {
  name: 'viewer.mama_search',
  description: 'Search MAMA memory for decisions and checkpoints. Use before saving to find related decisions.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      type: { type: 'string', enum: ['all', 'decision', 'checkpoint'] },
      limit: { type: 'number' },
      domain: { type: 'string' },
      outcome_filter: { type: 'string' },
      group_by_topic: { type: 'boolean' },
      list_domains: { type: 'boolean' },
    },
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(MamaSearchInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    try {
      const result = await executeMCPTool('mama_search', validated.data)
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
