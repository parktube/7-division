# Story 11.16: Terminology Evolution

Status: ready-for-dev

## Story

As a **시스템**,
I want **사용자의 언어 변화를 추적하기를**,
So that **성장을 가시화할 수 있다** (FR84).

## Acceptance Criteria

### AC1: 전문 용어 사용 감지
**Given** 초기에 사용자가 "미니멀하게"라고 말했을 때
**When** 나중에 "Japandi 스타일로"라고 표현하면
**Then** terminology_evolution에 before='미니멀하게', after='Japandi 스타일로' 기록

### AC2: 학습과 연결
**Given** 용어 변화가 감지되었을 때
**When** 관련 학습(Japandi 개념)이 있으면
**Then** learning_id와 함께 기록된다

### AC3: 질문 품질 향상 감지
**Given** 초기에 "색감 어떻게?"라고 물었을 때
**When** 나중에 "60-30-10 비율 맞춰서"라고 표현하면
**Then** 질문 품질 향상으로 기록된다

### AC4: 성장 리포트에 언어 변화 포함
**Given** 30일 성장 리포트를 생성할 때
**When** 언어 변화가 있으면
**Then** "💬 언어의 변화" 섹션에 before→after 목록이 포함된다

### AC5: 자동 감지 로직
**Given** 사용자 메시지가 입력될 때
**When** 같은 의미의 더 전문적인 용어를 사용하면
**Then** 자동으로 terminology_evolution에 기록된다

> **감지 기준** (우선순위, 순차 적용):
> 1. **1차: 매핑 사전 매치** - 도메인별 용어 매핑 사전에서 정확 매칭 시도 (예: `domains/interior/term-mapping.json`)
> 2. **2차: 임베딩 폴백** - 매핑 실패 시 cosine similarity ≥ 0.85 + 전문성 점수 증가로 유사 용어 감지

## Tasks / Subtasks

- [ ] Task 1: terminology_evolution 테이블 생성 (AC: #1, #2)
  - [ ] 1.1 스키마 정의 (user_id, before_term, after_term, learning_id, detected_at, idx_terminology_user 인덱스)
  - [ ] 1.2 SQLite 마이그레이션
  - [ ] 1.3 TypeScript 타입 정의

- [ ] Task 2: 용어 변화 감지 로직 (AC: #1, #5)
  - [ ] 2.1 용어 매핑 사전 (미니멀 → Japandi/Bauhaus/Muji)
  - [ ] 2.2 사용자 메시지에서 전문 용어 추출
  - [ ] 2.3 이전 용어 사용 이력 비교

- [ ] Task 3: 학습 연결 (AC: #2)
  - [ ] 3.1 용어 변화와 관련 learning 매칭
  - [ ] 3.2 learning_id 자동 연결
  - [ ] 3.3 "이 용어는 X 개념 학습 후 사용 시작"

- [ ] Task 4: 질문 품질 감지 (AC: #3)
  - [ ] 4.1 질문 패턴 분석
  - [ ] 4.2 구체성/전문성 점수 계산
  - [ ] 4.3 향상 시 growth_metrics에도 기록

- [ ] Task 5: 성장 리포트 통합 (AC: #4)
  - [ ] 5.1 terminology_evolution 조회
  - [ ] 5.2 "💬 언어의 변화" 섹션 포맷
  - [ ] 5.3 Story 11.14 성장 리포트와 통합

- [ ] Task 6: 테스트 작성
  - [ ] 6.1 용어 변화 감지 테스트
  - [ ] 6.2 학습 연결 테스트
  - [ ] 6.3 성장 리포트 포함 테스트

## Dev Notes

### Technical Requirements

**terminology_evolution 테이블:**
```sql
CREATE TABLE terminology_evolution (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  before_term TEXT NOT NULL,     -- '미니멀하게'
  after_term TEXT NOT NULL,      -- 'Japandi 스타일로'
  learning_id TEXT,              -- 관련 학습
  detected_at INTEGER,           -- Unix timestamp (seconds)
  FOREIGN KEY (learning_id) REFERENCES learnings(id)
);

CREATE INDEX idx_terminology_user ON terminology_evolution(user_id);
```

**용어 매핑 예시:**
```typescript
const termMapping = {
  style: {
    vague: ['미니멀하게', '깔끔하게', '심플하게'],
    specific: ['Japandi', 'Bauhaus', 'Muji', 'Scandinavian']
  },
  color: {
    vague: ['따뜻하게', '색감 어떻게'],
    specific: ['60-30-10 비율', '웜톤 팔레트', '보색 대비']
  },
  spatial: {
    vague: ['여기', '저기', '어디에'],
    specific: ['동선', '시선 흐름', '개방감', 'focal point']
  }
};
```

**확장성 고려:**
- 매핑은 DB 또는 JSON 파일로 분리 가능 (`domains/interior/term-mapping.json`)
- 도메인별 확장: `voxel/`, `furniture/`, `interior/` 각각 별도 매핑
- 폴백: 매핑에 없는 용어는 MAMA 임베딩으로 의미적 유사도 감지

**성장 리포트 언어 변화 섹션:**
```
💬 언어의 변화:
├── "미니멀하게" → "Japandi 스타일로" (style 개념 학습 후)
├── "따뜻하게" → "우드톤 30% 정도로" (60-30-10 법칙 학습 후)
├── "소파 어디?" → "동선 고려하면..." (동선 개념 학습 후)
└── "이거 괜찮아요?" → "트레이드오프가 있지만..." (비판적 사고 성장)
```

### References

- [Source: docs/adr/0025-learning-track.md]
- [Source: docs/epics.md#story-11.4.4]

### Dependencies

- **선행**: Story 11.13 (Learning Progress) - learnings 테이블 참조
- **선행**: Story 11.14 (Growth Metrics) - 성장 리포트 통합

### File List

- `apps/cad-mcp/src/mama/db.ts` (수정 - terminology_evolution 테이블)
- `apps/cad-mcp/src/mama/schema.ts` (수정 - TerminologyEvolution 타입)
- `apps/cad-mcp/src/mama/terminology-tracker.ts` (신규)
- `apps/cad-mcp/src/mama/term-mapping.ts` (신규 - 용어 매핑 사전)
- `apps/cad-mcp/src/mama/growth-report.ts` (수정 - 언어 변화 섹션)
