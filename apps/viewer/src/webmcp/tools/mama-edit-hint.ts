/**
 * viewer.mama_edit_hint - Manage dynamic hints
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const MamaEditHintInputSchema = z.object({
  action: z.enum(['add', 'update', 'delete', 'list']),
  tool_name: z.string().optional(),
  hint_id: z.number().optional(),
  hint_text: z.string().optional(),
  priority: z.number().optional(),
  tags: z.array(z.string()).optional(),
})


export const mamaEditHintTool: WebMcpToolDefinition = {
  name: 'viewer.mama_edit_hint',
  description: 'Manage dynamic hints for tool descriptions (add/update/delete/list).',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add', 'update', 'delete', 'list'] },
      tool_name: { type: 'string' },
      hint_id: { type: 'number' },
      hint_text: { type: 'string' },
      priority: { type: 'number' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['action'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(MamaEditHintInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    try {
      const result = await executeMCPTool('mama_edit_hint', validated.data)
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
