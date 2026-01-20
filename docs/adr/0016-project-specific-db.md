# ADR-0016: 단일 DB + Topic Prefix 구조

## Status

**Accepted** (Revised)

## Date

2025-12-31 (원안: Project-Specific DB)
2026-01-20 (수정: 단일 DB + Topic Prefix)

## Context

MAMA 메모리 DB의 위치와 구조를 결정해야 한다. 글로벌 단일 DB vs 프로젝트별 독립 DB.

## Decision

**단일 DB + Topic Prefix로 도메인 구분**

```
~/.ai-native-cad/
├── data/
│   └── mama.db          # 단일 DB
└── domains/             # 도메인 지식 (읽기 전용)
    ├── voxel/
    ├── furniture/
    └── interior/
```

**Topic Prefix 규칙:**
- `voxel:chicken_design` - 복셀 아트 결정
- `furniture:chair_ergonomics` - 가구 설계 결정
- `interior:wall_thickness` - 인테리어 설계 결정

**DB 스키마:**
```sql
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,           -- 'voxel:chicken', 'furniture:chair' 등
  decision TEXT NOT NULL,
  reasoning TEXT,
  outcome TEXT,
  confidence REAL DEFAULT 0.5,
  created_at INTEGER
);
```

## Rationale

이전 결정(프로젝트별 DB)에서 변경한 이유:

1. **크로스 도메인 검색**: 단일 DB가 유리 (가구 설계 시 인테리어 결정 참조)
2. **현재 MAMA 코드 재사용**: 기존 구조와 호환
3. **구조 단순화**: DB 관리 오버헤드 감소
4. **예상 사용 패턴**: 초기에는 대부분 사용자가 한 도메인에 집중할 것으로 예상 → 격리 필요성 낮음
   (향후 다중 도메인 사용자가 증가하면 재검토)

## Consequences

### Positive
- 현재 MAMA와 동일 구조로 코드 재사용
- 도메인 간 결정 참조 용이
- 단순한 배포 (단일 DB 파일)

### Negative
- 도메인 간 결정 오염 가능성 (topic prefix로 완화)
- 대규모 데이터 시 쿼리 성능 저하 가능

## Alternatives Considered

### Option A: 프로젝트별 독립 DB (원안)
- 각 프로젝트가 `.cad/memory.db` 소유
- **선택 안 한 이유:** 크로스 도메인 검색 불가, 코드 재사용 어려움

### Option B: 도메인별 분리 DB
- `voxel.db`, `furniture.db` 등
- **선택 안 한 이유:** 복잡도 증가, 관리 어려움

## References

- [ADR-0010: Partnership Philosophy](0010-partnership-philosophy.md)
- [ADR-0011: MAMA Core 4 Tools](0011-mama-core-reuse.md)
- MAMA Decision: `cad:mama_db_architecture`
