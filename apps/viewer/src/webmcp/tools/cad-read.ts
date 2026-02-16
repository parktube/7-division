/**
 * viewer.read - Read CAD file content
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const ReadInputSchema = z.object({
  file: z.string().describe('File name: "main" or module name'),
})

type ReadInput = z.infer<typeof ReadInputSchema>

export const cadReadTool: WebMcpToolDefinition = {
  name: 'viewer.read',
  description: 'Read CAD file content. Returns JavaScript code.',
  inputSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'File name: "main" or module name',
      },
    },
    required: ['file'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(ReadInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    const { file } = validated.data as ReadInput

    try {
      const result = await executeMCPTool('read', { file })
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
