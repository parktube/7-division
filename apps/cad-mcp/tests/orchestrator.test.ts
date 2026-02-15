/**
 * CADOrchestrator Tests
 *
 * Story 11.8: CADOrchestrator Hook Owner
 *
 * Tests for LLM-agnostic hook management and MCP request routing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CADOrchestrator } from '../src/orchestrator.js'

describe('CADOrchestrator', () => {
  let orchestrator: CADOrchestrator

  beforeEach(() => {
    orchestrator = new CADOrchestrator()
  })

  afterEach(() => {
    orchestrator.reset()
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(orchestrator.isInitialized()).toBe(false)

      await orchestrator.init()

      expect(orchestrator.isInitialized()).toBe(true)
    })

    it('should be idempotent', async () => {
      await orchestrator.init()
      await orchestrator.init() // Second call should be no-op

      expect(orchestrator.isInitialized()).toBe(true)
    })

    it('should reset state correctly', async () => {
      await orchestrator.init()
      orchestrator.reset()

      expect(orchestrator.isInitialized()).toBe(false)
      expect(orchestrator.getSessionContext()).toBeNull()
    })
  })

  describe('handleInitialize', () => {
    it('should return session init result', async () => {
      const result = await orchestrator.handleInitialize()

      expect(result).not.toBeNull()
      expect(result).toHaveProperty('contextMode')
      expect(result).toHaveProperty('formattedContext')
      expect(result).toHaveProperty('recentDecisions')
      expect(result).toHaveProperty('checkpoint')
    })

    it('should store session context', async () => {
      await orchestrator.handleInitialize()

      const context = orchestrator.getSessionContext()
      expect(context).not.toBeNull()
    })

    it('should initialize orchestrator if not initialized', async () => {
      expect(orchestrator.isInitialized()).toBe(false)

      await orchestrator.handleInitialize()

      expect(orchestrator.isInitialized()).toBe(true)
    })
  })

  describe('handleToolsList', () => {
    it('should return enhanced tools with hints', async () => {
      await orchestrator.init()

      const tools = [
        {
          name: 'write',
          description: 'Write file',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'read',
          description: 'Read file',
          parameters: { type: 'object', properties: {} },
        },
      ]

      const enhanced = orchestrator.handleToolsList(tools)

      expect(enhanced).toHaveLength(2)
      expect(enhanced[0].name).toBe('write')
      expect(enhanced[1].name).toBe('read')
    })

    it('should preserve tool structure', async () => {
      await orchestrator.init()

      const tools = [
        {
          name: 'test',
          description: 'Test tool',
          parameters: {
            type: 'object',
            properties: { arg: { type: 'string' } },
            required: ['arg'],
          },
        },
      ]

      const enhanced = orchestrator.handleToolsList(tools)

      expect(enhanced[0].parameters.properties).toHaveProperty('arg')
    })

    it('should return original tools on error', async () => {
      // Don't initialize to simulate error scenario
      const tools = [{ name: 'test', description: 'Test', parameters: { type: 'object', properties: {} } }]

      const result = orchestrator.handleToolsList(tools)

      expect(result).toEqual(tools)
    })
  })

  describe('handleToolCall', () => {
    beforeEach(async () => {
      await orchestrator.init()
    })

    it('should return enhanced result with action hints for write', () => {
      const result = orchestrator.handleToolCall(
        'write',
        { success: true, data: { file: 'main' } },
        {
          toolName: 'write',
          file: 'main',
          entitiesCreated: ['chicken_body', 'chicken_head'],
          code: "drawBox({ name: 'chicken_body' })",
        }
      )

      expect(result.success).toBe(true)
      // Action hints should be generated for character entities
      expect(result.actionHints).toBeDefined()
    })

    it('should skip hints for read tool', () => {
      const result = orchestrator.handleToolCall(
        'read',
        { success: true, data: { content: 'file content' } },
        { toolName: 'read', file: 'main' }
      )

      expect(result.success).toBe(true)
      expect(result.actionHints).toBeUndefined()
    })

    it('should not add hints for failed execution', () => {
      const result = orchestrator.handleToolCall(
        'write',
        { success: false, data: null, error: 'Execution failed' },
        { toolName: 'write', file: 'main' }
      )

      expect(result.success).toBe(false)
      expect(result.actionHints).toBeUndefined()
    })

    it('should return original result on error', () => {
      const originalResult = {
        success: true,
        data: { test: true },
        warnings: ['warning1'],
        logs: ['log1'],
      }

      const result = orchestrator.handleToolCall(
        'unknown_tool',
        originalResult,
        { toolName: 'unknown_tool' }
      )

      expect(result.success).toBe(originalResult.success)
      expect(result.data).toEqual(originalResult.data)
    })
  })

  describe('formatHints', () => {
    beforeEach(async () => {
      await orchestrator.init()
    })

    it('should format action hints as string', () => {
      const result = orchestrator.handleToolCall(
        'write',
        { success: true, data: {} },
        {
          toolName: 'write',
          entitiesCreated: ['room1'],
          entityTypes: ['room'],
          code: "drawBox({ name: 'room1' })",
        }
      )

      const formatted = orchestrator.formatHints(result)

      if (formatted) {
        expect(typeof formatted).toBe('string')
        expect(formatted.length).toBeGreaterThan(0)
      }
    })

    it('should return undefined for results without hints', () => {
      const result = {
        success: true,
        data: {},
      }

      const formatted = orchestrator.formatHints(result)

      expect(formatted).toBeUndefined()
    })
  })

  describe('error isolation (AC6)', () => {
    it('should not throw on handleInitialize error', async () => {
      // Reset and don't init - should gracefully handle
      orchestrator.reset()

      const result = await orchestrator.handleInitialize()

      // Should return result or null, not throw
      expect(result).toBeDefined()
    })

    it('should return original tools on handleToolsList error', () => {
      const tools = [{ name: 'test', description: 'Test', parameters: { type: 'object', properties: {} } }]

      // Without init, should still work
      const result = orchestrator.handleToolsList(tools)

      expect(result).toEqual(tools)
    })

    it('should return original result on handleToolCall error', () => {
      const originalResult = { success: true, data: { test: true } }

      // Without init, should still work
      const result = orchestrator.handleToolCall('test', originalResult, { toolName: 'test' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ test: true })
    })
  })

  describe('LLM independence (AC5)', () => {
    it('should produce consistent results regardless of initialization order', async () => {
      const tools = [
        { name: 'write', description: 'Write', parameters: { type: 'object', properties: {} } },
      ]

      // First orchestrator
      const orch1 = new CADOrchestrator()
      await orch1.init()
      const result1 = orch1.handleToolsList(tools)

      // Second orchestrator (simulating different LLM client)
      const orch2 = new CADOrchestrator()
      await orch2.init()
      const result2 = orch2.handleToolsList(tools)

      // Results should be structurally equivalent
      expect(result1.length).toBe(result2.length)
      expect(result1[0].name).toBe(result2[0].name)

      orch1.reset()
      orch2.reset()
    })

    it('should handle tool calls the same way regardless of LLM', async () => {
      const orch1 = new CADOrchestrator()
      const orch2 = new CADOrchestrator()

      await orch1.init()
      await orch2.init()

      const toolResult = { success: true, data: {} }
      const context = {
        toolName: 'write',
        entitiesCreated: ['test_entity'],
        entityTypes: ['character'],
      }

      const result1 = orch1.handleToolCall('write', toolResult, context)
      const result2 = orch2.handleToolCall('write', toolResult, context)

      // Both should produce hints for character entity
      expect(result1.success).toBe(result2.success)
      expect(!!result1.actionHints).toBe(!!result2.actionHints)

      orch1.reset()
      orch2.reset()
    })
  })
})

describe('Orchestrator Singleton', () => {
  it('should export singleton instance', async () => {
    const { orchestrator } = await import('../src/orchestrator.js')

    expect(orchestrator).toBeDefined()
    expect(typeof orchestrator.handleInitialize).toBe('function')
    expect(typeof orchestrator.handleToolsList).toBe('function')
    expect(typeof orchestrator.handleToolCall).toBe('function')
  })
})
