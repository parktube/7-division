/**
 * viewer.mama_save - Save decision or checkpoint to MAMA
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const MamaSaveInputSchema = z.object({
  type: z.enum(['decision', 'checkpoint', 'learning', 'understood', 'applied']),
  topic: z.string().optional(),
  decision: z.string().optional(),
  reasoning: z.string().optional(),
  confidence: z.number().optional(),
  summary: z.string().optional(),
  next_steps: z.string().optional(),
  open_files: z.array(z.string()).optional(),
  concept: z.string().optional(),
  domain: z.string().optional(),
  user_explanation: z.string().optional(),
})


export const mamaSaveTool: WebMcpToolDefinition = {
  name: 'viewer.mama_save',
  description: 'Save decision, checkpoint, or learning to MAMA memory. Search first to find related decisions for linking.',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['decision', 'checkpoint', 'learning', 'understood', 'applied'] },
      topic: { type: 'string' },
      decision: { type: 'string' },
      reasoning: { type: 'string' },
      confidence: { type: 'number' },
      summary: { type: 'string' },
      next_steps: { type: 'string' },
      open_files: { type: 'array', items: { type: 'string' } },
      concept: { type: 'string' },
      domain: { type: 'string' },
      user_explanation: { type: 'string' },
    },
    required: ['type'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(MamaSaveInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    try {
      const result = await executeMCPTool('mama_save', validated.data)
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
