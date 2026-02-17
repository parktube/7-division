import { describe, it, expect, beforeEach, vi } from 'vitest'
import { __resetStoreForTesting } from '@/hooks/useWebSocket'

// Mock UIContext store
// Note: This mock updates synchronously, while production uses React setState + useEffect.
// This difference is acceptable because select-entities.ts calculates expectedSelection
// directly instead of reading from getUIStore() after selectMultiple() call.
let mockUIStore = {
  selectedIds: [] as string[],
  hiddenIds: [] as string[],
  lockedIds: [] as string[],
}

let mockUIActions = {
  selectMultiple: vi.fn((ids: string[]) => {
    mockUIStore.selectedIds = ids
  }),
  clearSelection: vi.fn(() => {
    mockUIStore.selectedIds = []
  }),
}

vi.mock('@/contexts/UIContext', () => ({
  getUIStore: () => mockUIStore,
  getUIActions: () => mockUIActions,
}))

// Import tools after mocking
import { getStatusTool } from '@/webmcp/tools/get-status'
import { getSceneSummaryTool } from '@/webmcp/tools/get-scene-summary'
import { getSelectionTool } from '@/webmcp/tools/get-selection'
import { selectEntitiesTool } from '@/webmcp/tools/select-entities'

describe('webmcp/tools', () => {
  beforeEach(() => {
    __resetStoreForTesting()
    mockUIStore = {
      selectedIds: [],
      hiddenIds: [],
      lockedIds: [],
    }
    mockUIActions.selectMultiple.mockClear()
    mockUIActions.clearSelection.mockClear()
  })

  describe('viewer.get_status', () => {
    it('should return connection state and version info', async () => {
      const result = await getStatusTool.execute({ input: {} })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.connection_state).toBe('disconnected')
        expect(result.data.viewer_version).toBeDefined()
        expect(result.data.is_read_only).toBe(false)
      }
    })

    it('should have correct tool metadata', () => {
      expect(getStatusTool.name).toBe('viewer.get_status')
      expect(getStatusTool.description).toContain('status')
    })
  })

  describe('viewer.get_scene_summary', () => {
    it('should return error when no scene loaded', async () => {
      const result = await getSceneSummaryTool.execute({ input: {} })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('No scene loaded')
      }
    })

    it('should have correct tool metadata', () => {
      expect(getSceneSummaryTool.name).toBe('viewer.get_scene_summary')
      expect(getSceneSummaryTool.description).toContain('scene')
    })
  })

  describe('viewer.get_selection', () => {
    it('should return empty selection initially', async () => {
      const result = await getSelectionTool.execute({ input: {} })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.selected_ids).toEqual([])
      }
    })

    it('should return current selection', async () => {
      mockUIStore.selectedIds = ['entity1', 'entity2']

      const result = await getSelectionTool.execute({ input: {} })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.selected_ids).toEqual(['entity1', 'entity2'])
      }
    })

    it('should have correct tool metadata', () => {
      expect(getSelectionTool.name).toBe('viewer.get_selection')
      expect(getSelectionTool.description).toContain('selected')
    })
  })

  describe('viewer.select_entities', () => {
    it('should select entities with replace mode', async () => {
      mockUIStore.selectedIds = ['old']

      const result = await selectEntitiesTool.execute({
        input: { ids: ['new1', 'new2'], mode: 'replace' },
      })

      expect(result.ok).toBe(true)
      expect(mockUIActions.selectMultiple).toHaveBeenCalledWith(['new1', 'new2'])
    })

    it('should default to replace mode', async () => {
      const result = await selectEntitiesTool.execute({
        input: { ids: ['a', 'b'] },
      })

      expect(result.ok).toBe(true)
      expect(mockUIActions.selectMultiple).toHaveBeenCalledWith(['a', 'b'])
    })

    it('should add entities with add mode', async () => {
      mockUIStore.selectedIds = ['existing']

      const result = await selectEntitiesTool.execute({
        input: { ids: ['new'], mode: 'add' },
      })

      expect(result.ok).toBe(true)
      // add mode merges with existing
      expect(mockUIActions.selectMultiple).toHaveBeenCalledWith(
        expect.arrayContaining(['existing', 'new'])
      )
    })

    it('should deduplicate in add mode', async () => {
      mockUIStore.selectedIds = ['a', 'b']

      await selectEntitiesTool.execute({
        input: { ids: ['b', 'c'], mode: 'add' },
      })

      // Should be ['a', 'b', 'c'] without duplicates
      const calledWith = mockUIActions.selectMultiple.mock.calls[0][0]
      expect(new Set(calledWith).size).toBe(calledWith.length)
    })

    it('should return error for invalid input', async () => {
      const result = await selectEntitiesTool.execute({
        input: { ids: 'not-an-array' },
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Invalid input')
      }
    })

    it('should return error for invalid mode', async () => {
      const result = await selectEntitiesTool.execute({
        input: { ids: ['a'], mode: 'invalid' },
      })

      expect(result.ok).toBe(false)
    })

    it('should have correct tool metadata', () => {
      expect(selectEntitiesTool.name).toBe('viewer.select_entities')
      expect(selectEntitiesTool.description).toContain('select')
      expect(selectEntitiesTool.inputSchema).toBeDefined()
      expect(selectEntitiesTool.inputSchema?.properties).toHaveProperty('ids')
      expect(selectEntitiesTool.inputSchema?.properties).toHaveProperty('mode')
    })

    it('should report changed=true when selection changes', async () => {
      mockUIStore.selectedIds = []

      const result = await selectEntitiesTool.execute({
        input: { ids: ['a'] },
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.changed).toBe(true)
      }
    })

    it('should report changed=false when selection unchanged', async () => {
      mockUIStore.selectedIds = ['a']

      // selectMultiple doesn't actually change the store in mock
      // so we need to simulate the same selection
      mockUIActions.selectMultiple.mockImplementationOnce(() => {
        // Don't change selection
      })

      const result = await selectEntitiesTool.execute({
        input: { ids: ['a'] },
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.changed).toBe(false)
      }
    })
  })
})
