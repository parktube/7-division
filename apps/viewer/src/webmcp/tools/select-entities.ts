/**
 * viewer.select_entities - 엔티티 선택 도구
 */

import { z } from 'zod'
import { getUIStore, getUIActions } from '@/contexts/UIContext'
import { ok, err, validateInput, type WebMcpToolDefinition, type ToolPayload, type WebMcpResult } from '../types'

const SelectEntitiesInputSchema = z.object({
  ids: z.array(z.string()).describe('Entity IDs to select'),
  mode: z.enum(['replace', 'add']).default('replace').describe('Selection mode: replace clears existing, add appends'),
})

type SelectEntitiesInput = z.infer<typeof SelectEntitiesInputSchema>

interface SelectEntitiesOutput {
  selected_ids: string[]
  changed: boolean
}

export const selectEntitiesTool: WebMcpToolDefinition = {
  name: 'viewer.select_entities',
  description: 'Select entities by ID. Mode "replace" clears existing selection, "add" appends to it.',
  inputSchema: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Entity IDs to select',
      },
      mode: {
        type: 'string',
        enum: ['replace', 'add'],
        default: 'replace',
        description: 'Selection mode: replace clears existing, add appends',
      },
    },
    required: ['ids'],
  },
  execute: async (payload: ToolPayload): Promise<WebMcpResult<SelectEntitiesOutput>> => {
    // Validate input with Zod
    const validated = validateInput(SelectEntitiesInputSchema, payload)
    if (!validated.ok) {
      return validated
    }

    const { ids, mode } = validated.data as SelectEntitiesInput
    const actions = getUIActions()

    if (!actions) {
      return err('UI context not initialized')
    }

    const store = getUIStore()
    const previousSelection = store.selectedIds

    if (mode === 'replace') {
      actions.selectMultiple(ids)
    } else {
      // add mode: merge with existing
      const merged = [...new Set([...previousSelection, ...ids])]
      actions.selectMultiple(merged)
    }

    // Check if selection changed
    const newStore = getUIStore()
    const changed = JSON.stringify(previousSelection.sort()) !== JSON.stringify(newStore.selectedIds.sort())

    return ok({
      selected_ids: newStore.selectedIds,
      changed,
    })
  },
}
