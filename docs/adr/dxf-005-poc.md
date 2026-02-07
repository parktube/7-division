# ADR-dxf-005: PoC (Proof of Concept)

## Status
**Completed** ✅

## Date
2026-01-21

## Purpose

DXF Import 구현 전에 핵심 가정들을 검증.

## PoC 체크리스트

### 1. 환경 준비
- [x] `dxf` npm 패키지 설치 (`cad-tools/dxf-poc/`)
- [x] 샘플 DXF 파일 생성 (LINE, CIRCLE, ARC 포함)

### 2. 파싱 검증
- [x] 기본 Entity 파싱 (LINE, CIRCLE, ARC)
- [x] 레이어 정보 파싱 (`layer: "0"`)
- [x] 색상(ACI) 정보 파싱 - ⏸️ PoC 범위 외 (구현 Phase에서 처리 예정)

### 3. Code Generator 프로토타입
- [x] Entity → JS 코드 변환 함수
- [x] 생성된 코드 Sandbox 실행 테스트 ✅

---

## PoC 결과

### 1. 환경 준비

```bash
mkdir -p cad-tools/dxf-poc && cd cad-tools/dxf-poc
npm init -y && npm install dxf
```

**테스트 파일:** `cad-tools/dxf-poc/sample.dxf`, `cad-tools/dxf-poc/test.mjs`

---

### 2. 파싱 결과

**Entity 파싱 성공:**
```
Entities: 3
[0] Type: LINE    - start: {x:0, y:0}, end: {x:100, y:50}
[1] Type: CIRCLE  - x:50, y:50, r:30
[2] Type: ARC     - x:100, y:100, r:25, startAngle:0, endAngle:90°
```

**발견 사항:**
- Entity 필드는 `TYPE` 아닌 `type` (소문자) 사용
- Arc 각도는 **라디안**으로 반환됨 (1.5707... = 90°)

---

### 3. Code Generator 프로토타입

**변환 함수 핵심:**
```javascript
switch (entity.type) {
  case 'LINE':
    code += `drawLine('${name}', ${entity.start.x}, ${entity.start.y}, ${entity.end.x}, ${entity.end.y});\n`;
    break;
  case 'CIRCLE':
    code += `drawCircle('${name}', ${entity.x}, ${entity.y}, ${entity.r});\n`;
    break;
  case 'ARC':
    code += `drawArc('${name}', ${entity.x}, ${entity.y}, ${entity.r}, ${entity.startAngle}, ${entity.endAngle});\n`;
    break;
}
```

**생성된 JS 코드:**
```javascript
// Generated from DXF
drawLine('line_1', 0, 0, 100, 50);
drawCircle('circle_2', 50, 50, 30);
drawArc('arc_3', 100, 100, 25, 0, 1.5707963267948966);
```

---

### 4. Sandbox 통합 테스트

**테스트 파일:** `cad-tools/dxf-poc/test-sandbox.mjs`

**결과:**
```
LINE:   ✅ line_1
CIRCLE: ✅ circle_2
ARC:    ✅ arc_3

총 Entity 수: 3
Scene JSON 크기: 4762 bytes
```

**발견 사항:**
- CADExecutor `draw_arc`는 `cx`, `cy` 파라미터 사용 (dxf 라이브러리는 `x`, `y`)
- Code Generator에서 파라미터 매핑 필요

---

## 결론

**검증 결과:** ✅ 성공
- `dxf` 라이브러리가 예상대로 동작함
- LINE, CIRCLE, ARC 파싱 정상
- Code Generator 프로토타입 동작 확인

**ADR 수정 필요 여부:**
- dxf-002에 Entity 필드명 `type` (소문자) 추가 권장

**다음 단계:**
1. 생성된 코드를 실제 Sandbox에서 실행 테스트
2. 추가 Entity 지원 (LWPOLYLINE, SPLINE 등)
3. MCP 도구 통합

## References

- [테스트 코드](../../cad-tools/dxf-poc/test.mjs)
- [dxf-001: Import](./dxf-001-import.md)
- [dxf-003: Library Selection](./dxf-003-library-selection.md)
