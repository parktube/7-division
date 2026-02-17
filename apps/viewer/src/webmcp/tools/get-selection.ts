/**
 * viewer.get_selection - 선택 상태 조회 도구
 */

import { getUIStore } from '@/contexts/UIContext'
import { ok, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

interface GetSelectionOutput {
  selected_ids: string[]
}

export const getSelectionTool: WebMcpToolDefinition = {
  name: 'viewer.get_selection',
  description: 'Get currently selected entity IDs',
  execute: async (_payload: ToolPayload): Promise<WebMcpResult<GetSelectionOutput>> => {
    const store = getUIStore()

    return ok({
      selected_ids: [...store.selectedIds],
    })
  },
}
