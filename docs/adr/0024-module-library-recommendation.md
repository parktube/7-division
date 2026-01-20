# ADR 0024: Module Library & Semantic Recommendation

**Status:** Proposed
**Date:** 2026-01-10
**Context:** Epic 11 MAMA Integration - Module Learning

---

## 1. 요약

사용자가 만든 CAD 모듈(House, Tree, Cat 등)을 **라이브러리로 관리**하고, MAMA 임베딩을 활용하여 **의미적으로 추천**하는 시스템을 설계합니다.

---

## 2. 문제

현재 모듈 시스템의 한계:
- 모듈 목록만 제공 (`run_cad_code` → files)
- 어떤 상황에서 어떤 모듈을 쓸지 가이드 없음
- 모듈이 늘어나면 찾기 어려움
- 사용 패턴 학습 없음

---

## 3. 해결책: MAMA 기반 모듈 라이브러리

### 3.1 모듈 메타데이터

```javascript
/**
 * @module house_lib
 * @description 집, 건물을 생성하는 모듈. 벽, 지붕, 문, 창문 포함.
 * @tags building, architecture, village
 * @example new House('h1', 0, 0).build()
 */
class House {
  // ...
}
```

### 3.2 MAMA 저장 구조

```javascript
{
  id: "module_house_lib",
  type: "module",
  name: "house_lib",
  description: "집, 건물을 생성하는 모듈. 벽, 지붕, 문, 창문 포함.",
  tags: ["building", "architecture", "village"],
  example: "new House('h1', 0, 0).build()",
  embedding: Float32Array,  // description 임베딩 (384-dim)
  usage_count: 15,
  last_used: "2026-01-10",
  co_used_with: ["tree_lib"]  // 함께 사용된 모듈
}
```

### 3.3 추천 알고리즘

```
Score = (semantic_similarity × 0.6) + (usage_frequency × 0.3) + (recency × 0.1)
```

| 요소 | 가중치 | 설명 |
|------|--------|------|
| semantic_similarity | 0.6 | 쿼리와 description 임베딩 유사도 |
| usage_frequency | 0.3 | 사용 횟수 정규화 |
| recency | 0.1 | 최근 사용일 기준 |

> **가중치 검증 필요**: 위 값은 초기 추정치. 실제 사용 데이터 수집 후 A/B 테스트로 최적화 권장.

---

## 4. 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                 모듈 라이브러리 시스템                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [모듈 저장 시]                                                  │
│  run_cad_code house_lib "class House {...}"                     │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ 메타데이터 추출 (JSDoc 파싱)                         │       │
│  │ → description, tags, example                        │       │
│  └─────────────────────────────────────────────────────┘       │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ MAMA 임베딩 생성 (multilingual-e5, 30ms)            │       │
│  │ → embedding = embed(description)                    │       │
│  └─────────────────────────────────────────────────────┘       │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ MAMA DB 저장 (SQLite)                               │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  [추천 시] ~30ms                                                 │
│  User: "마을을 만들고 싶어"                                      │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ 1. embed("마을을 만들고 싶어") → query_emb          │       │
│  │ 2. cosine_similarity(query_emb, all_modules)        │       │
│  │ 3. apply weights (semantic + usage + recency)       │       │
│  │ 4. return top N                                     │       │
│  └─────────────────────────────────────────────────────┘       │
│         │                                                       │
│         ▼                                                       │
│  추천: house_lib(0.87), tree_lib(0.72), cat_lib(0.23)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. UI: LibraryPanel

뷰어에 새로운 패널 추가:

```
┌─────────────────────────┐
│ 📚 Library              │
├─────────────────────────┤
│ 🔥 추천 (MAMA 기반)      │
│ ┌─────────────────────┐ │
│ │ 🏠 house_lib   0.87 │ │ ← 클릭: 예제 복사
│ │ 🌲 tree_lib    0.72 │ │ ← 더블클릭: 실행
│ └─────────────────────┘ │
│                         │
│ 📦 전체 모듈             │
│ ┌─────────────────────┐ │
│ │ 🐱 cat_lib     ★3   │ │ ← ★: 사용 횟수
│ │ 🤖 robot_lib   ★1   │ │
│ │ 🏠 house_lib   ★15  │ │
│ └─────────────────────┘ │
│                         │
│ 🔍 [검색...]            │
└─────────────────────────┘
```

### 인터랙션

| 동작 | 결과 |
|------|------|
| 호버 | 모듈 설명 툴팁 |
| 클릭 | 예제 코드 클립보드 복사 |
| 더블클릭 | main에 추가 후 실행 |
| 드래그 | 캔버스 드롭 → 해당 위치에 생성 |

---

## 6. 데이터 흐름

```
[씬 변경] → [MAMA 쿼리] → [임베딩 유사도] → [UI 업데이트]
   │            │              │               │
   │            │              │               └─ LibraryPanel 갱신
   │            │              └─ ~30ms 소요
   │            └─ POST /recommend-modules
   └─ WebSocket 이벤트
```

### 트리거 시점

| 트리거 | 동작 | 지연 |
|--------|------|------|
| 뷰어 시작 | 전체 모듈 목록 로드 | 즉시 |
| 씬 변경 | 추천 모듈 갱신 | 30ms |
| 사용자 검색 | 검색어 필터 + 추천 | 30ms |
| 모듈 사용 | usage_count++ | 즉시 |

---

## 7. 학습 기능

### 7.1 사용 패턴 기록

```javascript
// 모듈 사용 시
function recordModuleUsage(moduleName, context) {
  mama.update({
    id: `module_${moduleName}`,
    usage_count: increment,
    last_used: now(),
    contexts: append(context)  // "마을 만들기"
  });
}
```

### 7.2 Co-occurrence 학습

```javascript
// house_lib와 tree_lib가 같은 세션에서 사용됨
// → co_used_with 업데이트
// → "마을" 관련 쿼리 시 두 모듈 함께 추천
```

---

## 8. 구현 단계

| 단계 | 내용 | 예상 |
|------|------|------|
| 1 | 모듈 메타데이터 파싱 (JSDoc) | 0.5일 |
| 2 | MAMA 모듈 저장 API | 0.5일 |
| 3 | 임베딩 기반 추천 API | 0.5일 |
| 4 | LibraryPanel UI | 1일 |
| 5 | 사용 패턴 학습 | 0.5일 |

**총 예상: 3일**

---

## 9. 기존 인프라 활용

| 필요 기능 | 기존 인프라 | 상태 |
|----------|------------|------|
| 임베딩 생성 | MAMA multilingual-e5 | ✅ 있음 |
| Semantic Search | MAMA cosine similarity | ✅ 있음 |
| HTTP API | MAMA Server (port 3847) | ✅ 있음 |
| WebSocket | Viewer 통신 | ✅ 있음 |
| 모듈 목록 | run_cad_code | ✅ 있음 |

---

## 10. MAMA 훅 통합

모듈 라이브러리는 MAMA Decision과 동일한 패턴으로 훅에 통합됩니다.

### 10.1 UserPromptSubmit 훅 확장

```javascript
// memory-inject.js 확장
async function injectDecisionContext(userMessage) {
  // 1. Decision 검색 (기존)
  const decisions = await vectorSearch('decisions', userMessage);

  // 2. Module 검색 (NEW!)
  const modules = await vectorSearch('modules', userMessage);

  // 3. 포맷팅
  return formatContext({ decisions, modules });
}
```

### 10.2 Context Injection 포맷

```
💡 MAMA found 1 related decision:
   - cad:rect_center_based (0.82): rect는 center-based 좌표

📦 MAMA found 2 related modules:
   - house_lib (0.87): new House('h1', x, y).build()
   - tree_lib (0.72): new Tree('t1', x, y).build()
```

### 10.3 뷰어 연동

MAMA 검색 결과를 WebSocket으로 뷰어에 전송하여 LibraryPanel에 실시간 표시:

```
┌─────────────────────────┐
│ 📚 Library              │
├─────────────────────────┤
│ 🔍 MAMA 추천 (실시간)    │
│ ┌─────────────────────┐ │
│ │ 🏠 house_lib   0.87 │ │ ← 유사도 순 정렬
│ │ 🌲 tree_lib    0.72 │ │
│ │ 🐱 cat_lib     0.23 │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

## 11. 2-Layer 추천 시스템

임베딩만으로 부족할 수 있으므로, LLM이 최종 추천을 결정합니다.

### 11.1 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                 2-Layer 추천 시스템                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Layer 1] 임베딩 검색 (30ms) - 후보 필터링                      │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ MAMA: "마을" → house(0.87), tree(0.72), cat(0.23)   │       │
│  │                                                      │       │
│  │ → 뷰어 LibraryPanel에 유사도 순으로 표시             │       │
│  └─────────────────────────────────────────────────────┘       │
│                        │                                        │
│                        ▼                                        │
│  [Layer 2] LLM 추천 (선택적) - 최종 결정                         │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ Claude: "마을에는 house와 tree가 필수입니다.         │       │
│  │          먼저 House로 기본 구조를 만들고,            │       │
│  │          Tree로 자연 요소를 추가하세요."             │       │
│  │                                                      │       │
│  │ 추천: ⭐ house_lib (필수), ⭐ tree_lib (권장)        │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 역할 분담

| Layer | 역할 | 속도 | 정확도 |
|-------|------|------|--------|
| **임베딩** | 후보 필터링 (Top N) | 30ms | 중간 |
| **LLM** | 최종 추천 + 이유 설명 | - | 높음 |

### 11.3 LLM 추천 트리거

| 트리거 | 동작 |
|--------|------|
| 사용자 질문 | "어떤 모듈을 쓰면 좋을까?" |
| 모호한 요청 | 임베딩 결과가 비슷한 점수일 때 |
| 복잡한 워크플로우 | 여러 모듈 조합이 필요할 때 |

---

## 12. 기존 인프라 재사용

| 필요 기능 | 기존 인프라 | 재사용률 |
|----------|------------|----------|
| 임베딩 생성 | MAMA embeddings.js | 100% |
| Vector Search | MAMA memory-store.js | 100% |
| 훅 시스템 | MAMA memory-inject.js | 90% (모듈 검색 추가) |
| HTTP API | MAMA Server (port 3847) | 100% |
| 포맷팅 | decision-formatter.js | 80% (모듈 포맷 추가) |

**총 재사용률: ~90%** - 모듈 테이블과 검색 로직만 추가

---

## 13. 관련 문서

- [ADR 0023: LLM-Agnostic Agent Architecture](./0023-llm-agnostic-agent-architecture.md)
- [Story 11.3.5: Module Library Recommendation](../sprint-artifacts/11-3-5-module-library.md)
