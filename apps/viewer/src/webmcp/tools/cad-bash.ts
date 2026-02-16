/**
 * viewer.bash - Execute CAD commands (scene query, export, snapshot)
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const BashInputSchema = z.object({
  command: z.enum(['info', 'tree', 'groups', 'draw_order', 'selection', 'entity', 'capture', 'svg', 'json', 'reset', 'snapshot', 'undo', 'redo', 'snapshots']).describe('Command to execute'),
  group: z.string().optional().describe('For draw_order: group name'),
  name: z.string().optional().describe('For entity: entity/group name'),
  clearSketch: z.boolean().optional().describe('For capture: clear sketch after capture'),
})

type BashInput = z.infer<typeof BashInputSchema>

export const cadBashTool: WebMcpToolDefinition = {
  name: 'viewer.bash',
  description: 'Execute CAD commands. info → scene info, tree → hierarchy, entity → coordinates, capture → PNG screenshot, svg/json → export',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        enum: ['info', 'tree', 'groups', 'draw_order', 'selection', 'entity', 'capture', 'svg', 'json', 'reset', 'snapshot', 'undo', 'redo', 'snapshots'],
        description: 'Command to execute',
      },
      group: {
        type: 'string',
        description: 'For draw_order: group name',
      },
      name: {
        type: 'string',
        description: 'For entity: entity/group name',
      },
      clearSketch: {
        type: 'boolean',
        description: 'For capture: clear sketch after capture',
      },
    },
    required: ['command'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(BashInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    const { command, group, name, clearSketch } = validated.data as BashInput

    try {
      const result = await executeMCPTool('bash', { command, group, name, clearSketch })
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
