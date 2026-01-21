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
    description: `🤝 Save a decision or checkpoint to MAMA's reasoning graph.

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

type='decision': choices & lessons (same topic = evolution chain)
type='checkpoint': session state for resumption (ALSO requires search first!)`,
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: "What to save: 'decision' or 'checkpoint'",
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
          items: { type: 'string' },
        },
      },
      required: ['action'],
    },
  },
}

/**
 * Get all MAMA tools as array
 */
export function getMAMATools(): ToolSchema[] {
  return Object.values(MAMA_TOOLS)
}
