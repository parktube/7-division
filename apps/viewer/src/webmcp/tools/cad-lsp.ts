/**
 * viewer.lsp - Explore CAD functions and symbols
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const LspInputSchema = z.object({
  operation: z.enum(['domains', 'describe', 'schema', 'symbols']).describe('Operation type'),
  domain: z.string().optional().describe('For describe: domain name'),
  name: z.string().optional().describe('For schema: function name. For symbols: file name'),
  file: z.string().optional().describe('For symbols: file name'),
})

type LspInput = z.infer<typeof LspInputSchema>

export const cadLspTool: WebMcpToolDefinition = {
  name: 'viewer.lsp',
  description: 'Explore CAD functions. domains → list domains, describe → functions in domain, schema → function details, symbols → file symbols',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['domains', 'describe', 'schema', 'symbols'],
        description: 'Operation type',
      },
      domain: {
        type: 'string',
        description: 'For describe: domain name (e.g., "primitives")',
      },
      name: {
        type: 'string',
        description: 'For schema: function name (e.g., "drawCircle")',
      },
      file: {
        type: 'string',
        description: 'For symbols: file name ("main" or module name)',
      },
    },
    required: ['operation'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(LspInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    const { operation, domain, name, file } = validated.data as LspInput

    try {
      const result = await executeMCPTool('lsp', { operation, domain, name, file })
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
