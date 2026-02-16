/**
 * viewer.mama_recommend_modules - Recommend CAD modules
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const MamaRecommendModulesInputSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
  min_score: z.number().optional(),
  tags: z.array(z.string()).optional(),
  sync_first: z.boolean().optional(),
})


export const mamaRecommendModulesTool: WebMcpToolDefinition = {
  name: 'viewer.mama_recommend_modules',
  description: 'Recommend CAD modules based on semantic query (e.g., "draw a chicken").',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
      min_score: { type: 'number' },
      tags: { type: 'array', items: { type: 'string' } },
      sync_first: { type: 'boolean' },
    },
    required: ['query'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(MamaRecommendModulesInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    try {
      const result = await executeMCPTool('mama_recommend_modules', validated.data)
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
