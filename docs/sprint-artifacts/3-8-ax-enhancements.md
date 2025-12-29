# Story 3.8: AX Enhancements

Status: done

## Story

As a **LLM 에이전트**,
I want **각 도구 호출 후 actionable hints와 rich context를 받을 수 있도록**,
So that **다음에 무엇을 해야 할지 더 나은 결정을 내릴 수 있다**.

## Acceptance Criteria

### AC1: Domain Descriptions
**Given** CLI가 준비된 상태
**When** `npx tsx cad-cli.ts domains` 실행
**Then** 사용 가능한 도메인 목록이 표시된다

### AC2: Domain 상세 설명
**Given** 특정 도메인을 알고 싶은 상태
**When** `npx tsx cad-cli.ts describe primitives` 실행
**Then** ACTIONS, WORKFLOW, TIPS 섹션이 포함된 상세 설명이 표시된다

### AC3: ActionHints
**Given** 도형을 그린 상태
**When** `draw_circle` 명령 실행
**Then** 응답에 `actionHints` 배열이 포함된다 (예: ["set_fill로 색상 추가", "translate로 위치 이동"])

### AC4: Scene Context
**Given** 여러 엔티티가 있는 상태
**When** 임의의 명령 실행
**Then** 응답에 `scene` 객체가 포함된다 (entityCount, lastOperation, bounds)

### AC5: Viewer Operation Log
**Given** 뷰어가 열린 상태
**When** CLI로 여러 명령 실행
**Then** 우측 패널에 스크롤 가능한 작업 로그가 표시된다

## Tasks / Subtasks

- [x] **Task 1: Domain Descriptions** (AC: #1, #2)
  - [x] 1.1: DOMAIN_DESCRIPTIONS 상수 정의
  - [x] 1.2: `domains` 명령어 구현
  - [x] 1.3: `describe <domain>` 명령어 구현

- [x] **Task 2: ActionHints** (AC: #3)
  - [x] 2.1: ACTION_HINTS 매핑 정의
  - [x] 2.2: getActionHints() 함수 구현
  - [x] 2.3: enrichResult()에서 actionHints 포함

- [x] **Task 3: Scene Context** (AC: #4)
  - [x] 3.1: get_scene_info 결과 파싱
  - [x] 3.2: enrichResult()에서 scene 정보 포함

- [x] **Task 4: Viewer 개선** (AC: #5)
  - [x] 4.1: index.html에 Operation Log 패널 추가
  - [x] 4.2: renderer.js에 operationHistory 배열 추가
  - [x] 4.3: Bounds 표시 영역 추가
  - [x] 4.4: Entity 목록 표시 영역 추가

## Dev Notes

### Domain Descriptions Format (AX Pattern)

```
📦 PRIMITIVES - 기본 도형 그리기

📋 ACTIONS
- draw_circle [name, x, y, radius]: 원 (머리, 관절, 버튼 등)
...

🎯 WORKFLOW
1. list_entities → 현재 상태 확인
...

💡 TIPS
- 이름은 의미있게: "head", "left_arm", "door" 등
...
```

### Enriched Response Format

```json
{
  "success": true,
  "entity": "head",
  "scene": {
    "entityCount": 5,
    "lastOperation": "draw_circle(head, 0, 100, 30)",
    "bounds": {"min": [-50, 0], "max": [100, 130]}
  },
  "actionHints": ["set_fill로 색상 추가", "translate로 위치 이동"]
}
```

### Viewer Operation Log

- 우측 패널에 스크롤 가능한 작업 로그 추가
- Bounds 정보 실시간 표시
- Entity 목록 표시
- 타임스탬프 포함

### Dependencies

- Story 3.7 (CLI Direct Integration)

## References

- [Source: docs/ax-design-guide.md - AX 설계 원칙]
- [Source: SpineLift MCP - Domain-based descriptions 패턴]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Completion Notes List

- 완료일: 2025-12-29
- SpineLift AX 패턴 적용 완료
- 14개 엔티티 복합 씬 테스트 성공 (집, 사람, 나무, 태양)

### File List

- cad-tools/cad-cli.ts (수정 - Domain descriptions, ActionHints, enrichResult)
- viewer/index.html (수정 - Operation Log, Bounds, Entity List UI)
- viewer/renderer.js (수정 - computeBounds, operationHistory, log updates)
