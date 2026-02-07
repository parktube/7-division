# ADR-dxf-003: DXF Parser Library Selection

## Status
**Proposed**

## Date
2026-01-21

## Context

DXF import 기능 구현을 위해 npm DXF 파싱 라이브러리를 선정해야 함.
직접 파싱 구현은 Group Code 처리, 버전 호환성 등 복잡성이 높아 비효율적.

**요구사항:**
- ⚠️ 라이센스 호환성 (프로젝트 라이선스 미정 - 추후 확정 필요)
- ✅ 기본 2D Entity 지원 (LINE, CIRCLE, ARC, LWPOLYLINE)
- ✅ TypeScript 지원 권장
- ✅ 활발한 유지보수

## Decision

### 후보 라이브러리 비교 (npm/JavaScript)

| 라이브러리 | Stars | 다운로드/주 | 라이센스 | 마지막 업데이트 | Entity 지원 |
|-----------|-------|------------|---------|----------------|-------------|
| **dxf** | 391 ⭐ | ~2,000 | **MIT** ✅ | 활발 | 기본 2D + SVG 변환 |
| dxf-parser | 528 | 28,422 | **MIT** ✅ | 4년 전 ❌ | 기본 2D |
| dxf-json | 115 | N/A | **GPL-3.0** ❌ | 활발 | 전체 Entity (가장 포괄적) |
| @dxfjs/parser | 15 | 34 | MIT | 2년 전 | 기본 2D |

### Rust 라이브러리 (WASM용, 향후 고려)

| 라이브러리 | crates.io | Stars | 라이센스 | 특징 |
|-----------|-----------|-------|---------|------|
| `dxf` (dxf-rs) | [dxf](https://crates.io/crates/dxf) | 125 ⭐ | **MIT** ✅ | C#보다 2-3배 빠름, zero-copy, ASCII/Binary 지원 |

**Rust 사용 시나리오:**
- 대용량 파일(10,000+ Entity) 성능 이슈 발생 시
- Option C: Hybrid 접근법 (Rust 파싱 → JS 코드 생성) - [dxf-004](./dxf-004-parsing-architecture.md) 참조

### 선정: `dxf` (npm: dxf)

**선정 이유:**
1. **MIT 라이센스** - 대부분의 오픈소스 프로젝트와 호환 가능
2. **SVG 변환 내장** - `helper.toSVG()` 활용 가능
3. **Helper 클래스** - 파싱 + 블록 확장 + 폴리라인 변환 제공
4. **활발한 유지보수** - 23명 기여자, 지속 업데이트

### 기각된 옵션

**dxf-parser:**
- ⚠️ 유지보수 비활성 상태 (Inactive)
- ❌ ~3.5년간 업데이트 없음 (npm: 2022년 6월)
- 다운로드 수는 높지만 레거시 사용

**dxf-json:**
- ✅ 가장 포괄적 (AutoCAD 2024 기준, 40+ Entity)
- ✅ TypeScript 지원
- ❌ **GPL-3.0 라이센스** → 제외 (라이선스 제약 회피)
- ❌ 아직 pre-1.0 (불안정)

**@dxfjs/parser:**
- ❌ 사용자 수 매우 적음 (34 다운로드/주)
- ❌ 2년간 업데이트 없음

## API 사용 예시

```typescript
import Helper from 'dxf';

// DXF 파싱
const helper = new Helper(dxfFileContent);

// 파싱된 객체 (원본 구조)
const parsed = helper.parsed;

// 블록 확장된 전체 엔티티
const entities = helper.denormalised;

// SVG 변환
const svg = helper.toSVG();

// 폴리라인 배열 (WebGL 렌더링용)
const polylines = helper.toPolylines();
```

## Consequences

### Positive
- MIT 라이센스로 대부분의 프로젝트와 호환 가능
- SVG 변환 로직 참고 가능
- 안정적인 사용자 기반

### Negative
- MTEXT, DIMENSION 등 고급 Entity 미지원
- 필요시 직접 Entity 파싱 확장 필요

### Neutral
- 미지원 Entity는 경고 로그 후 스킵 처리

## 대안 전략 (향후)

고급 Entity 지원이 필요하면:
1. `dxf` 라이브러리 fork 후 Entity 추가
2. 또는 별도 파서를 추가하여 hybrid 처리

## Test Samples

### 테스트용 DXF 파일 소스

| 소스 | URL | 내용 |
|------|-----|------|
| jscad/sample-files | https://github.com/jscad/sample-files | `floorplan.dxf`, `splines.dxf` 등 |
| dxf 라이브러리 | `test/resources/` 폴더 | 기본 Entity 테스트 파일 |
| GitHub topic | https://github.com/topics/dxf-files | 다양한 커뮤니티 샘플 |
| **3axis.co** | https://3axis.co | 10,000+ 무료 파일, 복잡한 패턴 |
| **Scan2CAD** | https://www.scan2cad.com/dxf/free-downloads/ | CNC용 깔끔한 DXF |
| Autodesk 공식 | https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Sample-files-for-AutoCAD.html | 표준 호환성 테스트 |

### 권장 테스트 샘플

| 용도 | 파일 | Entity 타입 |
|------|------|-------------|
| 기본 테스트 | jscad/sample-files (`circle.dxf`) | LINE, CIRCLE, ARC |
| 폴리라인 | 3axis.co 패턴 파일 | LWPOLYLINE |
| 복잡한 도면 | Autodesk 건축 샘플 | HATCH, DIMENSION, TEXT |

## References

- [dxf GitHub](https://github.com/bjnortier/dxf) - 391 stars, MIT
- [dxf-parser GitHub](https://github.com/gdsestimating/dxf-parser) - 유지보수 비활성
- [dxf-json GitHub](https://github.com/dotoritos-kim/dxf-json) - GPL-3.0, 가장 포괄적
