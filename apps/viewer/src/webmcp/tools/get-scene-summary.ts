/**
 * viewer.get_scene_summary - 씬 요약 조회 도구
 */

import { getWebSocketStore } from '@/hooks/useWebSocket'
import { ok, err, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

interface EntitySample {
  id: string
  type: string
  label?: string
}

interface GetSceneSummaryOutput {
  entity_count: number
  sample_entities: EntitySample[]
}

export const getSceneSummaryTool: WebMcpToolDefinition = {
  name: 'viewer.get_scene_summary',
  description: 'Get scene summary including entity count and sample entities (max 10)',
  execute: async (_payload: ToolPayload): Promise<WebMcpResult<GetSceneSummaryOutput>> => {
    const store = getWebSocketStore()

    if (!store.scene) {
      return err('No scene loaded')
    }

    const entities = store.scene.entities
    const sampleEntities: EntitySample[] = entities.slice(0, 10).map((e) => ({
      id: e.id,
      type: e.entity_type,
      label: e.metadata?.name,
    }))

    return ok({
      entity_count: entities.length,
      sample_entities: sampleEntities,
    })
  },
}
