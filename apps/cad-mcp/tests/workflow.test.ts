/**
 * Design Workflow System Tests
 *
 * Story 11.21: Design Workflow System (FR92-FR96)
 * - mama_workflow MCP 도구
 * - 워크플로우 상태 전환
 * - 산출물 저장/복원
 * - DesignHints 활성화
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  handleMamaWorkflow,
  handleStart,
  handleStatus,
  handleNext,
  handleGoto,
  handleList,
  handleArtifact,
  getWorkflowStatusForSession,
  type StartResult,
  type StatusResult,
  type NextResult,
  type GotoResult,
  type ListResult,
  type ArtifactResult,
} from '../src/mama/workflow.js'
import {
  initDatabase,
  closeDatabase,
  getActiveProject,
  deleteProject,
  getProjectArtifacts,
} from '../src/mama/db.js'
import { getPhaseDesignHints } from '../src/mama/design-hints.js'

// ============================================================
// Test Setup
// ============================================================

describe('Design Workflow System', () => {
  let testProjectId: string | null = null

  beforeEach(() => {
    initDatabase()
    testProjectId = null

    // 기존 active project가 있으면 삭제 (테스트 격리)
    const existingProject = getActiveProject()
    if (existingProject) {
      try {
        deleteProject(existingProject.id)
      } catch (e) {
        // Log cleanup errors for debugging
        console.debug(`Cleanup failed for project ${existingProject.id}:`, e)
      }
    }
  })

  afterEach(() => {
    // Clean up test project
    if (testProjectId) {
      try {
        deleteProject(testProjectId)
      } catch {
        // Ignore cleanup errors
      }
    }
    closeDatabase()
  })

  // ============================================================
  // mama_workflow: start command
  // ============================================================

  describe('start command', () => {
    it('should create a new project', () => {
      const result = handleStart({
        command: 'start',
        project_name: 'Test Project',
        description: 'A test project',
      })

      expect(result.success).toBe(true)
      const data = result.data as StartResult
      expect(data.project_id).toBeDefined()
      expect(data.current_phase).toBe('discovery')
      expect(data.phases).toEqual(['discovery', 'planning', 'architecture', 'creation', 'completed'])
      expect(data.questions).toHaveLength(3)

      testProjectId = data.project_id
    })

    it('should return DesignHints for discovery phase', () => {
      const result = handleStart({
        command: 'start',
        project_name: 'Test Project',
      })

      expect(result.success).toBe(true)
      const data = result.data as StartResult
      expect(data.design_hints).toBeDefined()
      expect(data.design_hints?.next_concepts).toHaveLength(2)

      testProjectId = data.project_id
    })

    it('should fail without project_name', () => {
      const result = handleStart({
        command: 'start',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('project_name is required')
    })
  })

  // ============================================================
  // mama_workflow: status command
  // ============================================================

  describe('status command', () => {
    it('should return status of active project', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'Status Test Project',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const result = handleStatus()

      expect(result.success).toBe(true)
      const data = result.data as StatusResult
      expect(data.project_name).toBe('Status Test Project')
      expect(data.current_phase).toBe('discovery')
      expect(data.progress).toBe('1/5')
      expect(data.completed_phases).toEqual([])
    })

    it('should fail if no active project', () => {
      const result = handleStatus()

      expect(result.success).toBe(false)
      expect(result.error).toContain('No active project')
    })
  })

  // ============================================================
  // mama_workflow: next command
  // ============================================================

  describe('next command', () => {
    it('should advance to next phase', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'Next Test Project',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const result = handleNext({
        command: 'next',
      })

      expect(result.success).toBe(true)
      const data = result.data as NextResult
      expect(data.previous_phase).toBe('discovery')
      expect(data.current_phase).toBe('planning')
      expect(data.design_hints).toBeDefined()
      expect(data.questions).toHaveLength(3)
    })

    it('should save artifact when content provided', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'Artifact Test Project',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const content = '# Design Brief\n\nTest content'
      const result = handleNext({
        command: 'next',
        content,
      })

      expect(result.success).toBe(true)
      const data = result.data as NextResult
      expect(data.artifact_saved).toBe('design-brief')

      // Verify artifact was saved
      const artifacts = getProjectArtifacts(testProjectId)
      expect(artifacts.length).toBe(1)
      expect(artifacts[0].content).toBe(content)
    })

    it('should fail after completed phase (project no longer active)', () => {
      // Create and advance to completed
      const startResult = handleStart({
        command: 'start',
        project_name: 'End Test Project',
      })
      testProjectId = (startResult.data as StartResult).project_id

      handleNext({ command: 'next' }) // discovery -> planning
      handleNext({ command: 'next' }) // planning -> architecture
      handleNext({ command: 'next' }) // architecture -> creation
      handleNext({ command: 'next' }) // creation -> completed (project becomes inactive)

      const result = handleNext({ command: 'next' })

      // Completed projects are no longer returned by getActiveProject()
      expect(result.success).toBe(false)
      expect(result.error).toContain('No active project')
    })
  })

  // ============================================================
  // mama_workflow: goto command
  // ============================================================

  describe('goto command', () => {
    it('should jump to specific phase', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'Goto Test Project',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const result = handleGoto({
        command: 'goto',
        phase: 'architecture',
      })

      expect(result.success).toBe(true)
      const data = result.data as GotoResult
      expect(data.previous_phase).toBe('discovery')
      expect(data.current_phase).toBe('architecture')
      expect(data.skipped_phases).toEqual(['planning'])
    })

    it('should fail with invalid phase', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'Invalid Phase Test',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const result = handleGoto({
        command: 'goto',
        phase: 'invalid_phase',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid phase')
    })

    it('should fail without phase parameter', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'No Phase Test',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const result = handleGoto({
        command: 'goto',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('phase is required')
    })
  })

  // ============================================================
  // mama_workflow: list command
  // ============================================================

  describe('list command', () => {
    it('should list all projects', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'List Test Project',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const result = handleList()

      expect(result.success).toBe(true)
      const data = result.data as ListResult
      expect(data.projects.length).toBeGreaterThan(0)
      expect(data.active_project).toBe(testProjectId)
    })

    it('should include project details in list', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'Detail Test Project',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const result = handleList()

      expect(result.success).toBe(true)
      const data = result.data as ListResult
      const project = data.projects.find((p) => p.id === testProjectId)
      expect(project).toBeDefined()
      expect(project?.name).toBe('Detail Test Project')
      expect(project?.phase).toBe('discovery')
    })
  })

  // ============================================================
  // mama_workflow: artifact command
  // ============================================================

  describe('artifact command', () => {
    it('should save artifact', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'Save Artifact Test',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const content = '# Style PRD\n\nColor palette...'
      const result = handleArtifact({
        command: 'artifact',
        artifact_type: 'style-prd',
        content,
      })

      expect(result.success).toBe(true)
      const data = result.data as ArtifactResult
      expect(data.saved).toBe(true)
    })

    it('should retrieve artifact', () => {
      // Create a project and save artifact
      const startResult = handleStart({
        command: 'start',
        project_name: 'Retrieve Artifact Test',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const content = '# Design Architecture\n\nComponents...'
      handleArtifact({
        command: 'artifact',
        artifact_type: 'design-architecture',
        content,
      })

      // Retrieve artifact
      const result = handleArtifact({
        command: 'artifact',
        artifact_type: 'design-architecture',
      })

      expect(result.success).toBe(true)
      const data = result.data as ArtifactResult
      expect(data.content).toBe(content)
    })

    it('should fail without artifact_type', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'No Type Test',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const result = handleArtifact({
        command: 'artifact',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('artifact_type is required')
    })
  })

  // ============================================================
  // mama_workflow: main handler
  // ============================================================

  describe('handleMamaWorkflow', () => {
    it('should route to correct command handler', () => {
      const result = handleMamaWorkflow({
        command: 'start',
        project_name: 'Router Test',
      })

      expect(result.success).toBe(true)
      testProjectId = (result.data as StartResult).project_id
    })

    it('should fail with unknown command', () => {
      const result = handleMamaWorkflow({
        command: 'unknown' as any,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown command')
    })
  })

  // ============================================================
  // getPhaseDesignHints
  // ============================================================

  describe('getPhaseDesignHints', () => {
    it('should return DesignHints for discovery phase', () => {
      const hints = getPhaseDesignHints('discovery')

      expect(hints).toBeDefined()
      expect(hints?.next_concepts).toHaveLength(2)
      expect(hints?.questions).toHaveLength(2)
      expect(hints?.principle).toBeDefined()
    })

    it('should return DesignHints for planning phase', () => {
      const hints = getPhaseDesignHints('planning')

      expect(hints).toBeDefined()
      expect(hints?.principle).toContain('60-30-10')
    })

    it('should return null for invalid phase', () => {
      const hints = getPhaseDesignHints('invalid')

      expect(hints).toBeNull()
    })
  })

  // ============================================================
  // getWorkflowStatusForSession
  // ============================================================

  describe('getWorkflowStatusForSession', () => {
    it('should return empty when no active project', () => {
      const status = getWorkflowStatusForSession()

      expect(status.hasActiveProject).toBe(false)
    })

    it('should return project info when active', () => {
      // Create a project first
      const startResult = handleStart({
        command: 'start',
        project_name: 'Session Status Test',
      })
      testProjectId = (startResult.data as StartResult).project_id

      const status = getWorkflowStatusForSession()

      expect(status.hasActiveProject).toBe(true)
      expect(status.project?.name).toBe('Session Status Test')
      expect(status.project?.phase).toBe('discovery')
      expect(status.project?.progress).toBe('1/5')  // 5 phases: discovery, planning, architecture, creation, completed
      expect(status.nextSteps?.length).toBeGreaterThan(0)
    })
  })
})
