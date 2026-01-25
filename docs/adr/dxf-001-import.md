# ADR-dxf-001: DXF Import

## Status
**Proposed**

## Date
2026-01-21

## Context

외부 DXF 파일을 편집 가능한 JavaScript 코드로 변환하는 기능이 필요함.
AutoCAD, LibreCAD 등에서 만든 도면을 AI-Native CAD 시스템에서 활용하기 위함.

**현재 상태:**
- Export 지원: `bash({ command: 'svg' })`, `bash({ command: 'json' })` ✅
- Import 미지원: DXF → Scene ❌

**Parent RFC:** [import-to-code.md](../rfc/import-to-code.md)

## Decision

### 아키텍처

```
DXF 파일 → dxf 라이브러리 → Entity Mapper → Code Generator → Sandbox JS
```

### 구현 위치

구현 세부사항은 [Sprint 문서](../sprint-artifacts/dxf-import.md)에서 관리.

### Entity 매핑 (우선순위별)

**P1 - 필수 (80% 도면 커버):**
| DXF Entity | JS 코드 |
|------------|---------|
| LINE | `drawLine(name, x1, y1, x2, y2)` |
| CIRCLE | `drawCircle(name, cx, cy, r)` |
| ARC | `drawArc(name, cx, cy, r, start, end)` |
| LWPOLYLINE | `drawLine([points])` / `drawPolygon()` |

**P2 - 확장:**
| DXF Entity | JS 코드 |
|------------|---------|
| POLYLINE | `drawLine([points])` |
| SPLINE | `drawBezier(name, path)` |
| TEXT | `drawText(name, text, x, y, size)` |
| INSERT | 블록 내용 인라인 |

**P3 - 고급:**
| DXF Entity | JS 코드 |
|------------|---------|
| MTEXT | `drawText()` + 줄바꿈 처리 |
| HATCH | `drawPolygon()` + setFill |
| ELLIPSE | 호 근사 변환 |

### MCP 인터페이스

```typescript
bash({ 
  command: 'import_dxf', 
  path: '/path/to/drawing.dxf',
  prefix: 'floor_plan',      // 엔티티 이름 접두사
  layer_filter: ['Walls']    // 특정 레이어만
})
```

### 의존성

```json
{ "dependencies": { "dxf": "^5.3.1" } }
```

## Consequences

### Positive
- 기존 AutoCAD/LibreCAD 도면 재사용 가능
- LLM이 import된 코드를 이해하고 수정 가능
- Source of Truth = main 코드 파일 유지

### Negative
- 일부 Entity 미지원 (DIMENSION, 3D 등)
- 복잡한 SPLINE 변환 시 정밀도 손실 가능

### Neutral
- ACI 256색 → RGBA 변환 테이블 필요
- 대용량 파일(10,000+ entity) 성능 테스트 필요

## Alternatives Considered

### Option A: 데이터 Import (DXF → scene.json)
- 장점: 단순
- 단점: Source of Truth 없음, LLM 수정 어려움
- **기각**: AI-Native 철학과 맞지 않음

### Option B: 코드 Import (DXF → Sandbox JS) ⭐ 채택
- 장점: 코드 기반, LLM이 이해/수정 가능
- 단점: 변환 로직 복잡

## Implementation Plan

### Phase 1: 기본 인프라 (1-2일)
- [ ] `dxf` npm 패키지 설치
- [ ] `DxfParser`, `CodeGenerator` 클래스 구조

### Phase 2: 기본 Entity (2-3일)
- [ ] LINE, CIRCLE, ARC 변환
- [ ] ACI → RGBA 색상 변환
- [ ] 단위 테스트

### Phase 3: MCP 통합 (1일)
- [ ] `import.ts` 도구 구현
- [ ] 통합 테스트

### Phase 4: 확장 Entity (2-3일)
- [ ] POLYLINE, SPLINE, TEXT 변환
- [ ] INSERT (블록) 처리

## References

- [Autodesk DXF Reference](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-235B22E0-A567-4CF6-92D3-38A2306D73F3)
- [dxf npm 패키지](https://github.com/bjnortier/dxf)
- [RFC: import-to-code.md](../rfc/import-to-code.md)
