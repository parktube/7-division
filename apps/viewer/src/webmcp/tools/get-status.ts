/**
 * viewer.get_status - Viewer 상태 조회 도구
 */

import { getWebSocketStore } from '@/hooks/useWebSocket'
import { VIEWER_VERSION } from '@/utils/version'
import { ok, type WebMcpToolDefinition, type ToolPayload } from '../types'

interface GetStatusOutput {
  connection_state: 'connecting' | 'connected' | 'disconnected'
  viewer_version: string
  version_status: 'compatible' | 'warning' | 'error' | null
  is_read_only: boolean
}

export const getStatusTool: WebMcpToolDefinition = {
  name: 'viewer.get_status',
  description: 'Get current viewer connection status, version info, and read-only mode',
  execute: async (_payload: ToolPayload): Promise<ReturnType<typeof ok<GetStatusOutput>>> => {
    const store = getWebSocketStore()

    return ok({
      connection_state: store.connectionState,
      viewer_version: VIEWER_VERSION,
      version_status: store.versionStatus?.status ?? null,
      is_read_only: store.isReadOnly,
    })
  },
}
