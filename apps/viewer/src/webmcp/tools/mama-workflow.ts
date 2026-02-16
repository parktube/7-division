/**
 * viewer.mama_workflow - Design workflow management
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const MamaWorkflowInputSchema = z.object({
  command: z.enum(['start', 'status', 'next', 'goto', 'list', 'artifact']),
  project_name: z.string().optional(),
  description: z.string().optional(),
  phase: z.enum(['discovery', 'planning', 'architecture', 'creation']).optional(),
  content: z.string().optional(),
  artifact_type: z.enum(['design-brief', 'style-prd', 'design-architecture']).optional(),
})


export const mamaWorkflowTool: WebMcpToolDefinition = {
  name: 'viewer.mama_workflow',
  description: 'Design workflow management (start project, check status, move phases, save artifacts).',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', enum: ['start', 'status', 'next', 'goto', 'list', 'artifact'] },
      project_name: { type: 'string' },
      description: { type: 'string' },
      phase: { type: 'string', enum: ['discovery', 'planning', 'architecture', 'creation'] },
      content: { type: 'string' },
      artifact_type: { type: 'string', enum: ['design-brief', 'style-prd', 'design-architecture'] },
    },
    required: ['command'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(MamaWorkflowInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    try {
      const result = await executeMCPTool('mama_workflow', validated.data)
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
