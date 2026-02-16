/**
 * viewer.write - Write entire CAD file
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const WriteInputSchema = z.object({
  file: z.string().describe('File name: "main" or module name'),
  code: z.string().describe('Full file content'),
})

type WriteInput = z.infer<typeof WriteInputSchema>

export const cadWriteTool: WebMcpToolDefinition = {
  name: 'viewer.write',
  description: `Write entire CAD file content. Automatically executes and updates scene.

🎯 Coordinate System:
- Origin (0,0) is at screen center
- Typical viewport: -400 to +400 (x), -300 to +300 (y)
- Recommended starting size: 50-100 for small objects

❌ NEVER: part.Box, import statements
✅ Use global functions: drawCircle, drawRect, drawLine, etc.

📋 Example - Centered circle:
drawCircle('my_circle', 0, 0, 50);

📸 IMPORTANT: After drawing, MUST verify result:
Call viewer.bash({command: 'capture'}) or viewer.get_scene_summary() to check if objects are visible and properly positioned.`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'File name: "main" or module name',
      },
      code: {
        type: 'string',
        description: 'Full file content',
      },
    },
    required: ['file', 'code'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(WriteInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    const { file, code } = validated.data as WriteInput

    try {
      const result = await executeMCPTool('write', { file, code })
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
