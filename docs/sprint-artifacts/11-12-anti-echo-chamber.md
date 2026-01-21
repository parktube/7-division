# Story 11.12: Anti-Echo Chamber

Status: Done

## Story

As a **LLM 에이전트**,
I want **에코챔버 위험이 경고되기를**,
So that **다양한 관점을 유지한다** (FR78).

## Acceptance Criteria

### AC1: 동일 방향 결정 경고
**Given** 최근 결정들이 모두 동일한 방향일 때
**When** 새 결정을 저장하려 하면
**Then** "⚠️ 최근 결정들이 비슷합니다. 대안을 고려해보세요." 경고

### AC2: 오래된 결정 경고
**Given** 90일 이상 된 결정이 있을 때
**When** 검색 결과에 포함되면
**Then** "⚠️ 오래된 결정입니다. 여전히 유효한지 확인하세요." 경고

### AC3: 증거 없는 결정 제안
**Given** 외부 증거 없이 결정을 저장하려 할 때
**When** reasoning에 테스트/벤치마크 언급이 없으면
**Then** "💡 증거를 추가하면 결정이 더 강해집니다." 제안

### AC4: debates 장려
**Given** debates 비율이 낮을 때
**When** 새 결정을 저장하면
**Then** "💡 다른 관점에서 이 결정에 반론해보세요." 제안

### AC5: 경고 무시 옵션
**Given** 경고가 표시될 때
**When** 사용자가 무시하려 하면
**Then** 경고 없이 진행 가능하다

## Tasks / Subtasks

- [x] Task 1: 유사도 분석 (AC: #1)
  - [x] 1.1 최근 N개 결정 임베딩 비교 → 동일 토픽 최근 7일 결정 카운트로 구현
  - [x] 1.2 유사도 임계값 설정 (0.85)
  - [x] 1.3 경고 메시지 생성

- [x] Task 2: 오래된 결정 감지 (AC: #2)
  - [x] 2.1 검색 결과 필터링
  - [x] 2.2 경고 표시 추가 (stale_warning 필드)

- [x] Task 3: 증거 분석 (AC: #3)
  - [x] 3.1 reasoning 필드 키워드 분석
  - [x] 3.2 "test", "benchmark", "verified" 등 검색 (영어+한글)
  - [x] 3.3 제안 메시지 생성

- [x] Task 4: mama_save 경고 통합 (AC: #4)
  - [x] 4.1 저장 전 건강도 체크
  - [x] 4.2 debates 장려 제안

- [x] Task 5: 테스트 작성 (6개 테스트 추가)

## Dev Notes

### Technical Requirements

**경고 레벨 (ADR-0010):**

| Level | 명칭 | 원칙 | 적용 상황 |
|-------|------|------|----------|
| 1 | 설득 (Persuasion) | 넛징 | 워크플로우 제안 |
| 2 | 경고 (Warning) | 능동적 개입 | **에코챔버, 90일 결정** |
| 3 | 강제 (Enforcement) | Hook으로 강제 | 안전, 치명적 오류 |

**증거 키워드:**
```typescript
const EVIDENCE_KEYWORDS = [
  'test', 'tested', 'benchmark', 'verified',
  'measured', 'proven', 'experiment', 'data'
];
```

### References

- [Source: docs/adr/0021-anti-echo-chamber.md]
- [Source: docs/adr/0010-partnership-philosophy.md]
- [Source: docs/epics.md#story-11.3.4]

### Dependencies

- **선행**: Story 11.11 (Graph Health Metrics) - 건강도 기반

### Completion Notes List

- Implementation completed: 2026-01-21

### File List (Actual Implementation)

- `apps/cad-mcp/src/mama/anti-echo.ts` - analyzeDecisionBeforeSave, analyzeSearchResults, getStaleWarning, hasEvidence
- `apps/cad-mcp/src/mama/tools/handlers.ts` (수정 - handleMamaSave에 경고 통합, handleMamaSearch에 stale_warning 추가)
- `apps/cad-mcp/src/mama/index.ts` (수정 - anti-echo 모듈 export)
- `apps/cad-mcp/tests/mama.test.ts` (수정 - Anti-Echo Chamber 테스트 6개)
