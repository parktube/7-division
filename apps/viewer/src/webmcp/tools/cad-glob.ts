/**
 * viewer.glob - List CAD files matching pattern
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const GlobInputSchema = z.object({
  pattern: z.string().optional().describe('Glob pattern (e.g., "chicken*"). Omit for all files'),
})

type GlobInput = z.infer<typeof GlobInputSchema>

export const cadGlobTool: WebMcpToolDefinition = {
  name: 'viewer.glob',
  description: 'List CAD files matching glob pattern. Returns main and module files.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern (e.g., "chicken*"). Omit for all files',
      },
    },
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(GlobInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    const { pattern } = validated.data as GlobInput

    try {
      const result = await executeMCPTool('glob', { pattern })
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
