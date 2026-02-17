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

    const { ids, mode } = validated.data
    const actions = getUIActions()

    if (!actions) {
      return err('UI context not initialized')
    }

    const store = getUIStore()
    // Copy to avoid mutation and capture current state
    const previousSelection = [...store.selectedIds]

    // Calculate expected new selection (don't rely on store after setState)
    // Use Set to dedupe ids (matches selectMultiple behavior)
    let expectedSelection: string[]
    if (mode === 'replace') {
      expectedSelection = [...new Set(ids)]
      actions.selectMultiple(ids)
    } else {
      // add mode: merge with existing
      expectedSelection = [...new Set([...previousSelection, ...ids])]
      actions.selectMultiple(expectedSelection)
    }

    // Compare using calculated values (getUIStore() returns stale state after setState)
    const changed = JSON.stringify([...previousSelection].sort()) !== JSON.stringify([...expectedSelection].sort())

    return ok({
      selected_ids: expectedSelection,
      changed,
    })
  },
}
