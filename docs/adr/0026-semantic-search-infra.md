# ADR-0026: 시맨틱 검색 인프라

## Status

**Proposed**

## Date

2026-01-21

## Context

CAD MAMA 통합에서 시맨틱 검색은 핵심 기능이다. MAMA의 가치는 "LLM이 이전 결정을 의미 기반으로 검색할 수 있다"는 것에 있다. 단순 키워드 검색으로는 유사한 설계 결정을 찾을 수 없다.

**검토한 옵션:**

1. 키워드 검색만 (임베딩 없음)
2. 외부 임베딩 API (OpenAI, Voyage 등)
3. 로컬 임베딩 (@huggingface/transformers) + sqlite-vec

## Decision

**옵션 3: 로컬 임베딩 + sqlite-vec 채택**

### 기술 스택

| 컴포넌트 | 선택 | 이유 |
|---------|------|------|
| 임베딩 모델 | `Xenova/multilingual-e5-small` | 한영 크로스링구얼, 384-dim, 로컬 실행 |
| 벡터 DB | `sqlite-vec` | SQLite 확장, 별도 서버 불필요 |
| 임베딩 생성 | `@huggingface/transformers` | ONNX 런타임, Node.js 네이티브 |

### 아키텍처

```
Decision 저장 (mama_save)
    ↓
임베딩 생성 (@huggingface/transformers)
    ↓
decisions 테이블에 저장
    ↓
vss_memories 가상 테이블에 벡터 저장 (sqlite-vec)

검색 (mama_search)
    ↓
쿼리 임베딩 생성
    ↓
sqlite-vec 벡터 검색 (cosine similarity)
    ↓
similarity 점수와 함께 결과 반환
```

### 성능 요구사항

| 항목 | 목표 | 비고 |
|------|------|------|
| 임베딩 생성 | < 50ms | 모델 로드 후 (warm) |
| 검색 응답 | < 100ms | 1000개 결정 기준 |
| 모델 초기 로드 | < 3s | 콜드 스타트 |

### 임베딩 캐시

```typescript
// LRU 캐시로 중복 임베딩 생성 방지
const embeddingCache = new LRUCache<string, Float32Array>({
  max: 1000,
  ttl: 1000 * 60 * 60  // 1시간
});
```

### Graceful Degradation (Tier 시스템)

| Tier | 조건 | 동작 |
|------|------|------|
| Tier 1 | sqlite-vec + 임베딩 정상 | 전체 시맨틱 검색 |
| Tier 2 | sqlite-vec 없음 | 키워드 기반 fallback |
| Tier 3 | 임베딩 실패 | 최근 항목만 반환 |

## Consequences

### Positive

- 네트워크 없이 완전 로컬 동작
- 한영 크로스링구얼 검색 지원
- MAMA 원본 패턴 재사용 (검증된 구현)
- 별도 벡터 DB 서버 불필요

### Negative

- 패키지 크기 증가 (~50MB for ONNX runtime)
- 첫 실행 시 모델 다운로드 필요 (~90MB)
- sqlite-vec 네이티브 바이너리 의존성

### Risks

- sqlite-vec가 특정 플랫폼에서 빌드 실패 가능 → Tier 2 fallback으로 대응
- 모델 다운로드 실패 → 오프라인 번들 옵션 고려

## Alternatives Considered

### Option 1: 키워드 검색만

- **장점:** 단순, 의존성 없음
- **단점:** MAMA 핵심 가치 상실, 유사 결정 검색 불가
- **결론:** 기각 - 다운그레이드가 아닌 업그레이드 필요

### Option 2: 외부 임베딩 API

- **장점:** 패키지 크기 작음, 최신 모델 사용 가능
- **단점:** 네트워크 의존, API 비용, 오프라인 불가
- **결론:** 기각 - 로컬 우선 원칙 위반

## References

- [MAMA 원본 임베딩 구현](~/MAMA/packages/claude-code-plugin/src/core/embeddings.js)
- [MAMA sqlite-vec 어댑터](~/MAMA/packages/claude-code-plugin/src/core/db-adapter/sqlite-adapter.js)
- [sqlite-vec GitHub](https://github.com/asg017/sqlite-vec)
- [ADR-0011: MAMA Core 4 Tools 재사용](0011-mama-core-reuse.md)
- [ADR-0016: 단일 DB + Topic Prefix](0016-project-specific-db.md)
