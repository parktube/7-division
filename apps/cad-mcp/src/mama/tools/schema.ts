/**
 * MAMA MCP Tool Schemas
 *
 * Story 11.1: MAMA Core 4 Tools MCP 통합
 *
 * Core 4 Tools:
 * - mama_save: Save decision or checkpoint
 * - mama_search: Semantic search for decisions
 * - mama_update: Update decision outcome
 * - mama_load_checkpoint: Resume from checkpoint
 */

import type { ToolSchema } from '../../schema.js'

/**
 * MAMA MCP Tool Schemas
 */
export const MAMA_TOOLS: Record<string, ToolSchema> = {
  // === mama_save: Save decision or checkpoint ===
  mama_save: {
    name: 'mama_save',
    description: `🤝 Save a decision, checkpoint, or learning to MAMA's reasoning graph.

⚡ TRIGGERS - Call this when:
• User says: "기억해줘", "remember", "decided", "결정했어"
• Lesson learned: "깨달았어", "알게됐어", "this worked/failed"
• Architectural choice made
• Session ending → use type='checkpoint'

🔗 REQUIRED WORKFLOW (Don't create orphans!):
1. Call 'mama_search' FIRST to find related decisions
2. Check if same topic exists (yours will supersede it)
3. MUST include link in reasoning/summary field

📎 LINKING FORMAT:
• [Decision] reasoning: End with 'builds_on: <id>' or 'debates: <id>' or 'synthesizes: [id1, id2]'
• [Checkpoint] summary: Include 'Related decisions: decision_xxx, decision_yyy'

📚 LEARNING TYPES (Story 11.17):
• type='learning': AI가 사용자에게 새 개념을 설명할 때 호출
• type='understood': 사용자가 이해를 표현할 때 호출 (예: "아 이해됐어", "알겠어")
• type='applied': 사용자가 배운 개념을 실제로 사용할 때 호출

type='decision': choices & lessons (same topic = evolution chain)
type='checkpoint': session state for resumption (ALSO requires search first!)`,
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: "What to save: 'decision', 'checkpoint', 'learning', 'understood', or 'applied'",
        },
        topic: {
          type: 'string',
          description: "[Decision] Topic identifier (e.g., 'auth_strategy'). ⚡ REUSE same topic = supersedes previous, creating evolution chain.",
        },
        decision: {
          type: 'string',
          description: "[Decision] The decision made (e.g., 'Use JWT with refresh tokens').",
        },
        reasoning: {
          type: 'string',
          description: "[Decision] Why this decision was made. Include 5-layer narrative: (1) Context - what problem/situation; (2) Evidence - what proves this works; (3) Alternatives - what other options were considered; (4) Risks - known limitations; (5) Rationale - final reasoning. ⚠️ REQUIRED: End with 'builds_on: <id>' or 'debates: <id>' to link related decisions.",
        },
        confidence: {
          type: 'number',
          description: '[Decision] Confidence 0.0-1.0. Default: 0.5',
          minimum: 0,
          maximum: 1,
        },
        summary: {
          type: 'string',
          description: "[Checkpoint] Session state summary. Use 4-section format: (1) 🎯 Goal & Progress; (2) ✅ Evidence; (3) ⏳ Unfinished & Risks; (4) 🚦 Next Agent Briefing. ⚠️ Include 'Related decisions: decision_xxx' to link context.",
        },
        open_files: {
          type: 'array',
          description: '[Checkpoint] Currently relevant files.',
          items: { type: 'string', description: 'File path' },
        },
        next_steps: {
          type: 'string',
          description: '[Checkpoint] Instructions for next session: DoD, quick verification commands, constraints/cautions.',
        },
        concept: {
          type: 'string',
          description: "[Learning] Concept name (e.g., '60-30-10 rule', 'Japandi style'). Required for type='learning', 'understood', 'applied'.",
        },
        domain: {
          type: 'string',
          description: "[Learning] Domain category (e.g., 'color_theory', 'spatial', 'style'). Optional.",
        },
        user_explanation: {
          type: 'string',
          description: "[understood] 사용자가 이해한 내용을 자신의 말로 설명한 것. Optional.",
        },
      },
      required: ['type'],
    },
  },

  // === mama_search: Semantic search for decisions ===
  mama_search: {
    name: 'mama_search',
    description: `🔍 Search the reasoning graph before acting.

⚡ TRIGGERS - Call this BEFORE:
• ⚠️ REQUIRED before 'mama_save' (find links first!)
• Making architectural choices (check prior art)
• Debugging (find past failures on similar issues)
• Starting work on a topic (load context)
• User asks: "뭐였더라", "what did we decide", "이전에"

🔗 USE FOR REASONING GRAPH:
• Find decisions to supersede (same topic)
• Find decisions to link (builds_on, debates, synthesizes)
• Understand decision evolution (time-ordered results)

🏷️ DOMAIN FILTERING:
• Use domain parameter to filter by topic prefix (e.g., 'voxel', 'cad')
• Topic format: {domain}:{entity}:{aspect}
• Use list_domains=true to see available domains

Cross-lingual: Works in Korean and English.
⚠️ High similarity (>0.8) = MUST link with builds_on/debates/synthesizes.`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (optional). Semantic search finds related decisions even with different wording. If empty, returns recent items sorted by time.',
        },
        limit: {
          type: 'number',
          description: 'Maximum results. Default: 10',
        },
        type: {
          type: 'string',
          description: "Filter by type: 'decision' for architectural choices, 'checkpoint' for session states, 'all' for both. Default: 'all'",
        },
        domain: {
          type: 'string',
          description: "Filter by domain prefix (e.g., 'voxel', 'cad', 'furniture'). Only returns topics starting with this domain.",
        },
        group_by_topic: {
          type: 'boolean',
          description: 'If true, returns only the latest decision per topic (respects supersedes chain). Default: false',
        },
        list_domains: {
          type: 'boolean',
          description: 'If true, returns list of unique domains instead of decisions. Default: false',
        },
        outcome_filter: {
          type: 'string',
          description: "Filter by outcome: 'success', 'failed', 'partial', or 'pending' (not yet validated). Default: all outcomes",
        },
      },
      required: [],
    },
  },

  // === mama_update: Update decision outcome ===
  mama_update: {
    name: 'mama_update',
    description: `📝 Update decision outcome after real-world validation.

⚡ TRIGGERS - Call this when:
• Days/weeks later: issues discovered → mark 'failed' + reason
• Production success confirmed → mark 'success'
• Partial results with caveats → mark 'partial'
• User says: "이거 안됐어", "this didn't work", "성공했어"

🔗 REASONING GRAPH IMPACT:
• 'failed' outcomes teach future LLMs what to avoid
• After failure → save NEW decision with same topic to supersede

💡 TIP: Don't just update - if approach changed, save a NEW decision with same topic. This creates evolution history.`,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Decision ID to update.',
        },
        outcome: {
          type: 'string',
          description: "New outcome status (case-insensitive): 'success' or 'SUCCESS', 'failed' or 'FAILED', 'partial' or 'PARTIAL'.",
        },
        reason: {
          type: 'string',
          description: 'Why it succeeded/failed/was partial. Include specific evidence: error logs, metrics, user feedback, or what broke.',
        },
      },
      required: ['id', 'outcome'],
    },
  },

  // === mama_load_checkpoint: Resume from checkpoint ===
  mama_load_checkpoint: {
    name: 'mama_load_checkpoint',
    description: `🔄 Resume a previous session with full context.

⚡ TRIGGERS - Call this:
• At session start
• User says: "이어서", "continue", "where were we", "지난번"
• After long break from project

🔗 AFTER LOADING:
1. Verify Evidence items (code may have changed!)
2. Run health checks from next_steps first
3. Call 'mama_search' to refresh related decisions

Returns: summary (4-section), next_steps (DoD + commands), open_files

⚠️ WARNING: Checkpoint may be stale. Always verify before continuing.`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // === mama_configure: View/modify configuration ===
  mama_configure: {
    name: 'mama_configure',
    description: `View or modify MAMA configuration (database, embedding model, tier status).`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: "Action: 'get' (default) or 'set'",
        },
        contextInjection: {
          type: 'string',
          description: "[set] Context injection mode: 'none', 'hint', 'full'",
        },
      },
      required: [],
    },
  },

  // === mama_edit_hint: Manage dynamic hints ===
  mama_edit_hint: {
    name: 'mama_edit_hint',
    description: `Manage dynamic hints that are injected into tool descriptions.

Use this to add, update, or delete hints for specific tools.
Hints appear in tool descriptions with 💡 prefix.

Actions:
- add: Create a new hint for a tool
- update: Modify an existing hint
- delete: Remove a hint
- list: View hints for a tool (or all hints)`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: "Action: 'add', 'update', 'delete', or 'list'",
        },
        tool_name: {
          type: 'string',
          description: "Target tool name (e.g., 'edit', 'write', 'lsp'). Required for add/list.",
        },
        hint_text: {
          type: 'string',
          description: '[add/update] The hint text to display',
        },
        hint_id: {
          type: 'number',
          description: '[update/delete] ID of the hint to modify',
        },
        priority: {
          type: 'number',
          description: '[add/update] Priority 1-10 (higher = shown first). Default: 5',
        },
        tags: {
          type: 'array',
          description: '[add/update] Tags for categorization',
          items: { type: 'string', description: 'Tag string' },
        },
      },
      required: ['action'],
    },
  },

  // === mama_set_skill_level: Set skill level for adaptive mentoring ===
  mama_set_skill_level: {
    name: 'mama_set_skill_level',
    description: `🎓 Set skill level for adaptive mentoring.

Controls the detail level of ActionHints based on user expertise.

Levels:
- beginner: Detailed explanations with examples and tips
- intermediate: Brief descriptions (default)
- expert: Minimal keywords only

Can set global level or per-domain level (primitives, transforms, groups, boolean, query).`,
    parameters: {
      type: 'object',
      properties: {
        level: {
          type: 'string',
          description: "Skill level: 'beginner', 'intermediate', or 'expert'",
        },
        domain: {
          type: 'string',
          description: "Optional: Domain to set level for (e.g., 'primitives', 'transforms'). If omitted, sets global level.",
        },
      },
      required: ['level'],
    },
  },

  // === mama_growth_report: User growth metrics report ===
  mama_growth_report: {
    name: 'mama_growth_report',
    description: `📈 Generate user growth metrics report.

**Metrics Tracked:**
• Independent decisions (AI 제안 없이 결정)
• Concept applications (배운 개념 적용)
• Tradeoff predictions (트레이드오프 예측)
• Terminology usage (전문 용어 사용)

**Report Includes:**
• Independent decision ratio with trend (improving/stable/declining)
• Counts per metric type
• New concepts learned in period
• Skill level upgrade recommendation

Use this to track user growth and adjust mentoring level.`,
    parameters: {
      type: 'object',
      properties: {
        period_days: {
          type: 'number',
          description: 'Period in days for the report. Default: 30',
        },
      },
      required: [],
    },
  },

  // === mama_health: Graph health metrics ===
  mama_health: {
    name: 'mama_health',
    description: `📊 Check the health of the Reasoning Graph.

**Metrics Calculated:**
• Total decisions and edge distribution
• Edge type ratios (supersedes, builds_on, debates, synthesizes)
• Orphan decisions (no relationships)
• Stale decisions (90+ days old)
• Overall health score (0-100)

**Warnings Generated:**
• ⚠️ Echo chamber risk: debates < 10%
• ⚠️ High orphan ratio: > 30% unconnected
• ⚠️ Stale decisions needing review

Use this to monitor knowledge quality and identify areas for improvement.`,
    parameters: {
      type: 'object',
      properties: {
        verbose: {
          type: 'boolean',
          description: 'If true, include detailed edge distribution and stale decision list. Default: false',
        },
      },
      required: [],
    },
  },

  // === mama_recommend_modules: Module library recommendation (Story 11.19) ===
  mama_recommend_modules: {
    name: 'mama_recommend_modules',
    description: `📚 Recommend CAD modules based on semantic query.

**Scoring Algorithm:**
Score = (semantic_similarity × 0.6) + (usage_frequency × 0.3) + (recency × 0.1)

**Use this when:**
• User describes what they want to create (e.g., "draw a chicken")
• Looking for reusable modules for a specific task
• Exploring available module library

**Example:**
query: "draw a chicken character"
→ Returns: chicken, animal_lib, crossy_lib with relevance scores

**Options:**
• limit: Number of results (default: 5)
• min_score: Minimum score threshold (default: 0.1)
• tags: Filter by specific tags
• sync_first: Sync module files before search`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query describing what you want to create (e.g., "draw a chicken", "create farm background")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of recommendations to return. Default: 5',
        },
        min_score: {
          type: 'number',
          description: 'Minimum score threshold (0-1). Default: 0.1',
        },
        tags: {
          type: 'array',
          description: 'Filter modules by specific tags',
          items: { type: 'string', description: 'Tag to filter by' },
        },
        sync_first: {
          type: 'boolean',
          description: 'Sync module files to database before searching. Default: false',
        },
      },
      required: ['query'],
    },
  },

  // === mama_workflow: Design workflow management (Story 11.21) ===
  mama_workflow: {
    name: 'mama_workflow',
    description: `🎨 디자인 워크플로우 관리. 프로젝트 생성/상태 조회/단계 전환.

**워크플로우 단계:**
1. Discovery - 비전과 스타일 탐색
2. Planning - 색상/재료 결정
3. Architecture - 구조와 동선 설계
4. Creation - 실제 제작

**Commands:**
• start: 새 프로젝트 시작
• status: 현재 상태 조회
• next: 다음 단계로 전환
• goto: 특정 단계로 이동
• list: 모든 프로젝트 목록
• artifact: 산출물 저장/조회

**DesignHints 자동 활성화:**
각 단계에 맞는 DesignHints가 응답에 포함됩니다.`,
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: "명령: 'start' | 'status' | 'next' | 'goto' | 'list' | 'artifact'",
        },
        project_name: {
          type: 'string',
          description: "start용: 프로젝트 이름",
        },
        description: {
          type: 'string',
          description: "start용: 프로젝트 설명 (선택)",
        },
        phase: {
          type: 'string',
          description: "goto용: 이동할 단계 ('discovery' | 'planning' | 'architecture' | 'creation')",
        },
        content: {
          type: 'string',
          description: "next/artifact용: 산출물 내용",
        },
        artifact_type: {
          type: 'string',
          description: "artifact용: 산출물 유형 ('design-brief' | 'style-prd' | 'design-architecture')",
        },
      },
      required: ['command'],
    },
  },
}

/**
 * Get all MAMA tools as array
 */
export function getMAMATools(): ToolSchema[] {
  return Object.values(MAMA_TOOLS)
}
