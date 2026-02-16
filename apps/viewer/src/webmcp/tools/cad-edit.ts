/**
 * viewer.edit - Edit CAD file (partial update)
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const EditInputSchema = z.object({
  file: z.string().describe('File name: "main" or module name'),
  old_code: z.string().describe('Code to replace'),
  new_code: z.string().describe('New code (empty string = delete)'),
})

type EditInput = z.infer<typeof EditInputSchema>

export const cadEditTool: WebMcpToolDefinition = {
  name: 'viewer.edit',
  description: `Edit CAD file by replacing old_code with new_code. Automatically executes and updates scene.

❌ NEVER: part.Box, import statements for primitives
✅ Use primitives functions DIRECTLY (they are GLOBAL):
- drawCircle, drawRect, drawLine, drawArc, drawPolygon, drawBezier, drawText

Example:
drawCircle('head', 0, 50, 30);`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'File name: "main" or module name',
      },
      old_code: {
        type: 'string',
        description: 'Code to replace',
      },
      new_code: {
        type: 'string',
        description: 'New code (empty string = delete)',
      },
    },
    required: ['file', 'old_code', 'new_code'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(EditInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    const { file, old_code, new_code } = validated.data as EditInput

    try {
      const result = await executeMCPTool('edit', { file, old_code, new_code })
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
