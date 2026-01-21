# Architecture Decision Records (ADR)

AI-Native CAD 프로젝트의 아키텍처 결정 기록.

## ADR 목록

### Epic 1-10 (완료)

| ADR | 제목 | 상태 |
|-----|------|------|
| [ADR-001](001-group-system.md) | Group System | Accepted |
| [ADR-002](002-pivot-system.md) | Pivot System | Accepted |
| [ADR-003](003-claude-code-integration.md) | Claude Code Integration | Accepted |
| [ADR-004](004-llm-scene-understanding.md) | LLM Scene Understanding | Accepted |
| [ADR-005](005-coordinate-system.md) | Coordinate System | Accepted |
| [ADR-006](006-geometry-engine.md) | Manifold Geometry Engine | Accepted |
| [ADR-007](007-web-architecture.md) | Web Architecture | Accepted |
| [ADR-008](008-tool-pattern-alignment.md) | Tool Pattern Alignment | Accepted |

### Epic 11: MAMA Integration (구현 중)

| ADR | 제목 | 상태 | Phase | Story |
|-----|------|------|-------|-------|
| [ADR-0010](0010-partnership-philosophy.md) | Partnership Philosophy | Accepted | Core | - |
| [ADR-0011](0011-mama-core-reuse.md) | MAMA Core 4 Tools Reuse | Accepted | Core | 11.1 |
| [ADR-0012](0012-persuader-pattern.md) | Persuader Pattern | Accepted | Core | - |
| [ADR-0013](0013-edge-types-reasoning.md) | Edge Types via Reasoning | Accepted | Core | 11.2 |
| [ADR-0014](0014-progressive-workflow.md) | Progressive Workflow | Accepted | Hook | 11.7 |
| [ADR-0015](0015-dynamic-hint-injection.md) | Dynamic Hint Injection | Accepted | Hook | 11.6, 11.15 |
| [ADR-0016](0016-project-specific-db.md) | Single DB + Topic Prefix | Accepted | Core | 11.3 |
| [ADR-0017](0017-configurable-context.md) | Configurable Context | Accepted | Hook | 11.5, 11.9 |
| [ADR-0018](0018-llm-agnostic-hooks.md) | LLM-Agnostic Hooks | Accepted | Hook | 11.8 |
| [ADR-0019](0019-graph-health-metrics.md) | Graph Health Metrics | Accepted | Intelligence | 11.11 |
| [ADR-0020](0020-adaptive-mentoring.md) | Adaptive Mentoring | Accepted | Intelligence | 11.10 |
| [ADR-0021](0021-anti-echo-chamber.md) | Anti-Echo Chamber | Accepted | Intelligence | 11.12 |
| [ADR-0022](0022-meta-tooling.md) | run_cad_code (JS Execution) | Revised | - | - |
| [ADR-0023](0023-llm-agnostic-agent-architecture.md) | LLM-Agnostic Agent Architecture | Proposed | Platform | 11.18 (대기) |
| [ADR-0024](0024-module-library-recommendation.md) | Module Library Recommendation | Proposed | Platform | 11.19 (대기) |
| [ADR-0025](0025-learning-track.md) | Learning Track | Accepted | Learning | 11.13~11.17 |
| [ADR-0026](0026-semantic-search-infra.md) | Semantic Search Infrastructure | Accepted | Core | 11.1 |

## ADR 템플릿

새 ADR 작성 시 [MADR 템플릿](https://adr.github.io/madr/)을 따릅니다:

```markdown
# ADR-XXXX: 제목

## Status
**Proposed** | **Accepted** | **Deprecated** | **Superseded by [ADR-YYYY]**

## Date
YYYY-MM-DD

## Context
결정이 필요한 배경과 문제 상황

## Decision
채택한 결정과 그 이유

## Consequences
### Positive
### Negative
### Neutral

## Alternatives Considered
### Option A: ...
### Option B: ...

## References
```

## 관련 문서

- [Architecture](../architecture.md) - 전체 아키텍처
- [PRD](../prd.md) - 제품 요구사항
- [Epics](../epics.md) - 에픽 & 스토리
