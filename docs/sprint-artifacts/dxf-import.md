# Sprint: DXF Import 구현

## 개요

| 항목 | 값 |
|------|-----|
| Epic | DXF Import |
| 상태 | Planning |
| 시작일 | TBD |
| ADR 참조 | [dxf-001](../adr/dxf-001-import.md) ~ [dxf-005](../adr/dxf-005-poc.md) |
| PoC | ✅ 완료 ([dxf-005-poc](../adr/dxf-005-poc.md)) |

## 목표

외부 DXF 파일을 Sandbox JS 코드로 변환하여 CAD 시스템에서 편집 가능하게 만듦.

## 스토리

### Story 1: DXF Parser 모듈 (2-3일)

**파일:** `apps/cad-mcp/src/parsers/dxf-parser.ts`

- [ ] `dxf` npm 패키지 의존성 추가
- [ ] `DxfParser` 클래스 구현
  - `parse(content: string)`: DXF 파싱
  - `getEntities()`: Entity 목록 반환
  - `getLayers()`: 레이어 목록 반환
- [ ] Entity 타입별 파싱 (LINE, CIRCLE, ARC, LWPOLYLINE)
- [ ] 단위 테스트

**AC:** 샘플 DXF 파일(LINE, CIRCLE, ARC 포함)을 파싱하여 Entity 배열 반환, 단위 테스트 통과

---

### Story 2: Code Generator 모듈 (2-3일)

**파일:** `apps/cad-mcp/src/parsers/code-generator.ts`

- [ ] `CodeGenerator` 클래스 구현
  - `generate(entities)`: JS 코드 문자열 반환
- [ ] Entity → CADExecutor API 매핑
  | DXF Entity | CADExecutor API |
  |------------|-----------------|
  | LINE | `drawLine(name, [x1, y1, x2, y2])` |
  | CIRCLE | `drawCircle(name, x, y, radius)` |
  | ARC | `drawArc(name, cx, cy, radius, start, end)` |
  | LWPOLYLINE | `drawLine` / `drawPolygon` |
- [ ] 네이밍 규칙 (`dxf_line_1`, `dxf_circle_2` 등)
- [ ] 레이어 → 주석 변환
- [ ] 단위 테스트

**AC:** Entity 배열을 실행 가능한 JS 코드로 변환, Sandbox에서 실행 성공, 단위 테스트 통과

---

### Story 3: MCP 도구 통합 (1일)

**파일:** `apps/cad-mcp/src/tools/import.ts`

- [ ] `import_dxf` 명령어 구현
  ```typescript
  bash({ command: 'import_dxf', path: '/path/to/file.dxf' })
  ```
- [ ] 응답 형식
  ```json
  {
    "success": true,
    "code": "drawLine(...); drawCircle(...);",
    "stats": { "entities": 10, "layers": ["0"] }
  }
  ```
- [ ] 통합 테스트

**AC:** MCP 도구로 DXF 파일 경로 전달 시 JS 코드 반환, 통합 테스트 통과

---

### Story 4: 확장 Entity 지원 (2-3일)

- [ ] SPLINE → `drawBezier()` 변환
- [ ] TEXT/MTEXT → `drawText()` 변환
- [ ] INSERT (블록) 처리
- [ ] ACI 색상 → RGBA 변환

---

## 파라미터 매핑 (PoC에서 발견)

| DXF 필드 | CADExecutor 필드 | 비고 |
|----------|------------------|------|
| `entity.type` | 소문자 사용 | `LINE`, `CIRCLE` 등 |
| `entity.x`, `entity.y` | `cx`, `cy` (ARC) | 파라미터 이름 다름 |
| `entity.start`, `entity.end` | `points` 배열 (LINE) | 구조 변환 필요 |
| `entity.startAngle` | 라디안 그대로 사용 | |

## 의존성

```json
{
  "dependencies": {
    "dxf": "^5.3.1"
  }
}
```

## 테스트 계획

1. **단위 테스트**: 각 Entity 타입별 파싱/변환
2. **통합 테스트**: DXF → MCP → Sandbox → Viewer
3. **샘플 파일**: `cad-tools/dxf-poc/sample.dxf`

## 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 복잡한 SPLINE 변환 | 중 | Bezier 근사 알고리즘 |
| 대용량 파일 성능 | 낮 | 청크 처리 |

## 참조

- [dxf-001: Import 계획](../adr/dxf-001-import.md)
- [dxf-003: Library Selection](../adr/dxf-003-library-selection.md)
- [dxf-005: PoC 결과](../adr/dxf-005-poc.md)
- [PoC 테스트 코드](../../cad-tools/dxf-poc/)
