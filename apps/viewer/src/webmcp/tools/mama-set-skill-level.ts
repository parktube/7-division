/**
 * viewer.mama_set_skill_level - Set skill level for adaptive mentoring
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const MamaSetSkillLevelInputSchema = z.object({
  level: z.enum(['beginner', 'intermediate', 'expert']),
  domain: z.string().optional(),
})


export const mamaSetSkillLevelTool: WebMcpToolDefinition = {
  name: 'viewer.mama_set_skill_level',
  description: 'Set skill level (beginner/intermediate/expert) globally or per domain.',
  inputSchema: {
    type: 'object',
    properties: {
      level: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] },
      domain: { type: 'string' },
    },
    required: ['level'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(MamaSetSkillLevelInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    try {
      const result = await executeMCPTool('mama_set_skill_level', validated.data)
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
