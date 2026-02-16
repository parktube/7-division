/**
 * viewer.mama_growth_report - Generate user growth metrics
 */

import { z } from 'zod'
import { executeMCPTool } from '../mcp-bridge'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const MamaGrowthReportInputSchema = z.object({
  period_days: z.number().optional(),
})


export const mamaGrowthReportTool: WebMcpToolDefinition = {
  name: 'viewer.mama_growth_report',
  description: 'Generate user growth metrics report (independent decisions, concept applications, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      period_days: { type: 'number' },
    },
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<unknown>> => {
    const validated = validateInput(MamaGrowthReportInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    try {
      const result = await executeMCPTool('mama_growth_report', validated.data)
      return ok(result)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  },
}
