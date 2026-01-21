# Story 11.16: Terminology Evolution

Status: Done

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

> **정량화 기준**:
> - **점수 계산**: 구체성(키워드 수) + 전문성(매핑 사전 매치) → 0~100 스케일
> - **향상 판정**: 최근 3회 평균 대비 +10% 이상 또는 절대 점수 +5점 이상
> - **기록 대상**: `growth_metrics` 테이블에 `type='question_quality_improved'` 기록

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

- [x] Task 1: terminology_evolution 테이블 생성 (AC: #1, #2)
  - [x] 1.1 스키마 정의 (user_id, before_term, after_term, domain, learning_id, detected_at)
  - [x] 1.2 SQLite 마이그레이션 (007-terminology-evolution.sql)
  - [x] 1.3 TypeScript 타입 정의 (TerminologyEvolutionRow)

- [x] Task 2: 용어 변화 감지 로직 (AC: #1, #5)
  - [x] 2.1 용어 매핑 사전 (TERM_MAPPING: style, color, spatial, quality)
  - [x] 2.2 extractSpecificTerms() - 메시지에서 전문 용어 추출
  - [x] 2.3 detectEvolution() - 이전/현재 메시지 비교

- [x] Task 3: 학습 연결 (AC: #2)
  - [x] 3.1 recordEvolution() - 용어 변화와 learning 자동 매칭
  - [x] 3.2 getLearning() 연동으로 learning_id 자동 연결
  - [x] 3.3 formatTerminologySection에서 "(관련 학습 후)" 표시

- [x] Task 4: 질문 품질 감지 (AC: #3)
  - [x] 4.1 calculateQuestionQuality() - 구체성/전문성 점수
  - [x] 4.2 hasQuestionQualityImproved() - +10% 또는 +5점 판정
  - [x] 4.3 recordQuestionQualityImprovement() - growth_metrics 연동

- [x] Task 5: 성장 리포트 통합 (AC: #4)
  - [x] 5.1 getEvolutionsForReport() - terminology_evolution 조회
  - [x] 5.2 formatTerminologySection() - "💬 언어의 변화" 섹션
  - [x] 5.3 GrowthSummary에 terminologyEvolutions 추가

- [x] Task 6: 테스트 작성 (11개 테스트)
  - [x] 6.1 도메인 감지 테스트 (detectTermDomain)
  - [x] 6.2 vague/specific 용어 감지 테스트
  - [x] 6.3 용어 추출 및 진화 감지 테스트
  - [x] 6.4 질문 품질 점수 테스트
  - [x] 6.5 성장 리포트 통합 테스트

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

### Completion Notes

- Implementation completed: 2026-01-21
- term-mapping.ts를 별도 파일로 분리하지 않고 terminology-tracker.ts에 TERM_MAPPING 상수로 통합 (모듈 응집도)
- growth-report.ts 대신 growth-tracker.ts에서 직접 terminology 통합

### File List (Actual Implementation)

- `apps/cad-mcp/src/mama/migrations/007-terminology-evolution.sql` (신규 - 테이블 DDL)
- `apps/cad-mcp/src/mama/db.ts` (수정 - TerminologyEvolutionRow 타입, CRUD 함수)
- `apps/cad-mcp/src/mama/terminology-tracker.ts` (신규 - 핵심 모듈)
- `apps/cad-mcp/src/mama/growth-tracker.ts` (수정 - GrowthSummary에 terminologyEvolutions 추가)
- `apps/cad-mcp/src/mama/index.ts` (수정 - terminology-tracker export)
- `apps/cad-mcp/tests/mama.test.ts` (수정 - Terminology Evolution 테스트 11개)
