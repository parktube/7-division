/**
 * Design Workflow Management
 *
 * Story 11.21: Design Workflow System (FR92-FR96)
 *
 * Phases:
 * - Discovery: 비전과 스타일 탐색
 * - Planning: 색상/재료 결정
 * - Architecture: 구조와 동선 설계
 * - Creation: 실제 제작
 */

import {
  createProject,
  getActiveProject,
  listProjects,
  updateProjectPhase,
  addProjectArtifact,
  getProjectArtifacts,
  updateArtifactContent,
  completeProjectPhase,
  getProjectPhases,
  type WorkflowPhase,
} from './db.js'
import { getPhaseDesignHints, type DesignHints } from './design-hints.js'
import { logger } from '../logger.js'

// ============================================================
// Types
// ============================================================

export type WorkflowCommand = 'start' | 'status' | 'next' | 'goto' | 'list' | 'artifact'

export interface WorkflowInput {
  command: WorkflowCommand
  project_name?: string
  description?: string
  phase?: WorkflowPhase
  content?: string
  artifact_type?: string
}

// Phase order for navigation
const PHASE_ORDER: WorkflowPhase[] = ['discovery', 'planning', 'architecture', 'creation', 'completed']

// Artifact types by phase
const PHASE_ARTIFACTS: Record<WorkflowPhase, string> = {
  discovery: 'design-brief',
  planning: 'style-prd',
  architecture: 'design-architecture',
  creation: 'cad-output',
  completed: '',
}

// Phase questions for guidance
const PHASE_QUESTIONS: Record<WorkflowPhase, string[]> = {
  discovery: [
    '레퍼런스 이미지가 있으신가요? (Pinterest, 인테리어 잡지 등)',
    '"미니멀"하면 떠오르는 이미지는 어떤 건가요? (Japandi/Bauhaus/Muji)',
    '이 공간에서 주로 뭘 하실 건가요?',
  ],
  planning: [
    '60-30-10 색상 법칙 알고 계신가요?',
    '선호하는 재료가 있으신가요? (나무/금속/패브릭)',
    '따뜻한 분위기 vs 차가운 분위기 어느 쪽이 좋으세요?',
  ],
  architecture: [
    '동선에 대해 고려해보셨나요?',
    '어떤 요소들이 필요한지 목록을 작성해볼까요?',
    'z-order(겹침 순서)를 어떻게 잡을까요?',
  ],
  creation: [
    '어디서부터 시작할까요?',
    '가장 중요한 요소는 무엇인가요?',
    '점진적으로 디테일을 추가할까요?',
  ],
  completed: [],
}

// ============================================================
// Result Types
// ============================================================

export interface StartResult {
  project_id: string
  current_phase: WorkflowPhase
  phases: WorkflowPhase[]
  design_hints?: DesignHints
  questions: string[]
}

export interface StatusResult {
  project_id: string
  project_name: string
  current_phase: WorkflowPhase
  completed_phases: WorkflowPhase[]
  progress: string
  artifacts: Record<string, { exists: boolean; updated_at?: number }>
  learnings?: Array<{ concept: string; level: number }>
}

export interface NextResult {
  previous_phase: WorkflowPhase
  current_phase: WorkflowPhase
  artifact_saved?: string
  design_hints?: DesignHints
  questions: string[]
}

export interface GotoResult {
  previous_phase: WorkflowPhase
  current_phase: WorkflowPhase
  skipped_phases: WorkflowPhase[]
  design_hints?: DesignHints
  questions: string[]
}

export interface ListResult {
  projects: Array<{
    id: string
    name: string
    phase: WorkflowPhase
    updated_at: number
  }>
  active_project?: string
}

export interface ArtifactResult {
  artifact_type: string
  content?: string
  created_at?: number
  saved?: boolean
}

export type WorkflowResult =
  | { success: true; data: StartResult | StatusResult | NextResult | GotoResult | ListResult | ArtifactResult }
  | { success: false; error: string }

// ============================================================
// Command Handlers
// ============================================================

/**
 * Start a new design project
 */
export function handleStart(input: WorkflowInput): WorkflowResult {
  if (!input.project_name) {
    return { success: false, error: 'project_name is required for start command' }
  }

  try {
    const project = createProject({
      name: input.project_name,
      description: input.description,
    })

    const designHints = getPhaseDesignHints('discovery')

    logger.info(`Workflow started: ${project.id} (${project.name})`)

    return {
      success: true,
      data: {
        project_id: project.id,
        current_phase: 'discovery',
        phases: PHASE_ORDER,
        design_hints: designHints || undefined,
        questions: PHASE_QUESTIONS.discovery,
      },
    }
  } catch (error) {
    logger.error(`Failed to start workflow: ${error}`)
    return { success: false, error: `Failed to start project: ${error}` }
  }
}

/**
 * Get current project status
 */
export function handleStatus(): WorkflowResult {
  const project = getActiveProject()

  if (!project) {
    return { success: false, error: 'No active project. Use start command to begin.' }
  }

  const phases = getProjectPhases(project.id)
  const artifacts = getProjectArtifacts(project.id)

  // Build completed phases list
  const completedPhases = phases
    .filter((p) => p.completed_at !== null)
    .map((p) => p.phase)

  // Build artifacts status
  const artifactsStatus: Record<string, { exists: boolean; updated_at?: number }> = {}
  for (const phase of PHASE_ORDER) {
    const artifactType = PHASE_ARTIFACTS[phase]
    if (artifactType) {
      const artifact = artifacts.find((a) => a.artifact_type === artifactType)
      artifactsStatus[artifactType] = {
        exists: !!artifact,
        updated_at: artifact?.created_at,
      }
    }
  }

  // Calculate progress
  const currentIndex = PHASE_ORDER.indexOf(project.current_phase as WorkflowPhase)
  const progress = currentIndex >= 0
    ? `${currentIndex + 1}/${PHASE_ORDER.length}`
    : `?/${PHASE_ORDER.length}`

  return {
    success: true,
    data: {
      project_id: project.id,
      project_name: project.name,
      current_phase: project.current_phase as WorkflowPhase,
      completed_phases: completedPhases as WorkflowPhase[],
      progress,
      artifacts: artifactsStatus,
    },
  }
}

/**
 * Move to next phase
 */
export function handleNext(input: WorkflowInput): WorkflowResult {
  const project = getActiveProject()

  if (!project) {
    return { success: false, error: 'No active project. Use start command to begin.' }
  }

  const currentPhase = project.current_phase as WorkflowPhase
  const currentIndex = PHASE_ORDER.indexOf(currentPhase)

  if (currentIndex === -1 || currentIndex >= PHASE_ORDER.length - 1) {
    return { success: false, error: `Cannot advance from phase: ${currentPhase}` }
  }

  const nextPhase = PHASE_ORDER[currentIndex + 1]

  // Save artifact if content provided (allow empty string)
  let savedArtifact: string | undefined
  if (input.content !== undefined) {
    const artifactType = PHASE_ARTIFACTS[currentPhase]
    if (artifactType) {
      addProjectArtifact({
        project_id: project.id,
        phase: currentPhase,
        artifact_type: artifactType,
        content: input.content,
      })
      savedArtifact = artifactType
    }
  }

  // Complete current phase
  completeProjectPhase(project.id, currentPhase)

  // Update to next phase
  updateProjectPhase(project.id, nextPhase)

  const designHints = getPhaseDesignHints(nextPhase)

  logger.info(`Workflow advanced: ${project.id} ${currentPhase} → ${nextPhase}`)

  return {
    success: true,
    data: {
      previous_phase: currentPhase,
      current_phase: nextPhase,
      artifact_saved: savedArtifact,
      design_hints: designHints || undefined,
      questions: PHASE_QUESTIONS[nextPhase],
    },
  }
}

/**
 * Jump to specific phase
 */
export function handleGoto(input: WorkflowInput): WorkflowResult {
  if (!input.phase) {
    return { success: false, error: 'phase is required for goto command' }
  }

  const targetPhase = input.phase as WorkflowPhase
  if (!PHASE_ORDER.includes(targetPhase)) {
    return { success: false, error: `Invalid phase: ${input.phase}. Valid phases: ${PHASE_ORDER.join(', ')}` }
  }

  const project = getActiveProject()

  if (!project) {
    return { success: false, error: 'No active project. Use start command to begin.' }
  }

  const currentPhase = project.current_phase as WorkflowPhase
  const currentIndex = PHASE_ORDER.indexOf(currentPhase)
  const targetIndex = PHASE_ORDER.indexOf(targetPhase)

  // Calculate skipped phases
  const skippedPhases: WorkflowPhase[] = []
  if (targetIndex > currentIndex) {
    for (let i = currentIndex + 1; i < targetIndex; i++) {
      skippedPhases.push(PHASE_ORDER[i])
    }
  }

  // Update phase
  updateProjectPhase(project.id, targetPhase)

  const designHints = getPhaseDesignHints(targetPhase)

  logger.info(`Workflow jumped: ${project.id} ${currentPhase} → ${targetPhase}`)

  return {
    success: true,
    data: {
      previous_phase: currentPhase,
      current_phase: targetPhase,
      skipped_phases: skippedPhases,
      design_hints: designHints || undefined,
      questions: PHASE_QUESTIONS[targetPhase],
    },
  }
}

/**
 * List all projects
 */
export function handleList(): WorkflowResult {
  const projects = listProjects({ limit: 20 })
  const activeProject = getActiveProject()

  return {
    success: true,
    data: {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        phase: p.current_phase as WorkflowPhase,
        updated_at: p.updated_at || p.created_at,
      })),
      active_project: activeProject?.id,
    },
  }
}

/**
 * Save or retrieve artifact
 */
export function handleArtifact(input: WorkflowInput): WorkflowResult {
  if (!input.artifact_type) {
    return { success: false, error: 'artifact_type is required for artifact command' }
  }

  const project = getActiveProject()

  if (!project) {
    return { success: false, error: 'No active project. Use start command to begin.' }
  }

  // Save artifact (explicit undefined check to allow empty string as valid content)
  if (input.content !== undefined) {
    // Determine phase from artifact type
    let phase: WorkflowPhase = project.current_phase as WorkflowPhase
    for (const [p, type] of Object.entries(PHASE_ARTIFACTS)) {
      if (type === input.artifact_type) {
        phase = p as WorkflowPhase
        break
      }
    }

    // Check if artifact exists
    const existing = getProjectArtifacts(project.id, { artifact_type: input.artifact_type })

    if (existing.length > 0) {
      // Update existing
      updateArtifactContent(existing[0].id, input.content)
    } else {
      // Create new
      addProjectArtifact({
        project_id: project.id,
        phase,
        artifact_type: input.artifact_type,
        content: input.content,
      })
    }

    logger.info(`Artifact saved: ${project.id}/${input.artifact_type}`)

    return {
      success: true,
      data: {
        artifact_type: input.artifact_type,
        saved: true,
      },
    }
  }

  // Retrieve artifact
  const artifacts = getProjectArtifacts(project.id, { artifact_type: input.artifact_type })

  if (artifacts.length === 0) {
    return { success: false, error: `No artifact found: ${input.artifact_type}` }
  }

  return {
    success: true,
    data: {
      artifact_type: input.artifact_type,
      content: artifacts[0].content ?? undefined,
      created_at: artifacts[0].created_at,
    },
  }
}

// ============================================================
// Main Handler
// ============================================================

/**
 * Handle mama_workflow command
 */
export function handleMamaWorkflow(input: WorkflowInput): WorkflowResult {
  switch (input.command) {
    case 'start':
      return handleStart(input)
    case 'status':
      return handleStatus()
    case 'next':
      return handleNext(input)
    case 'goto':
      return handleGoto(input)
    case 'list':
      return handleList()
    case 'artifact':
      return handleArtifact(input)
    default:
      return { success: false, error: `Unknown command: ${input.command}` }
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get current workflow status for session init
 */
export function getWorkflowStatusForSession(): {
  hasActiveProject: boolean
  project?: {
    id: string
    name: string
    phase: WorkflowPhase
    progress: string
  }
  nextSteps?: string[]
} {
  const project = getActiveProject()

  if (!project) {
    return { hasActiveProject: false }
  }

  const currentIndex = PHASE_ORDER.indexOf(project.current_phase as WorkflowPhase)
  const progress = currentIndex >= 0
    ? `${currentIndex + 1}/${PHASE_ORDER.length}`
    : `?/${PHASE_ORDER.length}`

  return {
    hasActiveProject: true,
    project: {
      id: project.id,
      name: project.name,
      phase: project.current_phase as WorkflowPhase,
      progress,
    },
    nextSteps: PHASE_QUESTIONS[project.current_phase as WorkflowPhase],
  }
}
