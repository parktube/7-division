# ADR-dxf-002: DXF Format Structure

## Status
**Reference** (참조 문서)

## Date
2026-01-21

## Purpose

DXF 파일 포맷의 구조와 Entity 타입을 정리한 개발 참조 문서.
[dxf-001-import](./dxf-001-import.md) 구현 시 참조.

---

## 1. DXF 파일 구조

```
┌─────────────────────────┐
│  HEADER Section         │  ← 메타데이터 (버전, 단위 등)
├─────────────────────────┤
│  CLASSES Section        │  ← 사용자 정의 클래스
├─────────────────────────┤
│  TABLES Section         │  ← LAYER, LTYPE, STYLE 정의
├─────────────────────────┤
│  BLOCKS Section         │  ← 재사용 가능한 블록 정의
├─────────────────────────┤
│  ENTITIES Section       │  ← 실제 도형 데이터 ⭐
├─────────────────────────┤
│  OBJECTS Section        │  ← 비-그래픽 객체 (R13+)
├─────────────────────────┤
│  THUMBNAILIMAGE Section │  ← 미리보기 이미지 (선택)
└─────────────────────────┘
```

## 2. Group Code 시스템

DXF는 "Group Code + Value" 쌍으로 데이터 표현:

| Group Code | 의미 |
|------------|------|
| 0 | Entity 타입 (LINE, CIRCLE 등) |
| 5 | Handle (고유 ID) |
| 8 | Layer 이름 |
| 10, 20, 30 | X, Y, Z 좌표 (시작점) |
| 11, 21, 31 | X, Y, Z 좌표 (끝점) |
| 40 | 반지름/값 |
| 62 | 색상 번호 (ACI) |

**예시:**
```
0
LINE
5
A1
8
Layer1
10
0.0
20
0.0
11
100.0
21
50.0
```

## 3. Entity 타입 완전 목록

### 2D 기본 Entity

| Entity | 설명 | 지원 |
|--------|------|------|
| LINE | 직선 | ✅ P1 |
| CIRCLE | 원 | ✅ P1 |
| ARC | 호 | ✅ P1 |
| LWPOLYLINE | 가벼운 폴리라인 | ✅ P1 |
| POLYLINE | 폴리라인 (2D/3D) | ✅ P2 |
| POINT | 점 | ✅ P2 |

### 곡선 Entity

| Entity | 설명 | 지원 |
|--------|------|------|
| SPLINE | B-스플라인 곡선 | ✅ P2 |
| ELLIPSE | 타원 | ⚠️ P3 (근사 변환) |

### 텍스트/주석 Entity

| Entity | 설명 | 지원 |
|--------|------|------|
| TEXT | 단일 행 텍스트 | ✅ P2 |
| MTEXT | 다중 행 텍스트 | ⚠️ P3 |
| DIMENSION | 치수선 | ❌ P4 |

### 블록/참조 Entity

| Entity | 설명 | 지원 |
|--------|------|------|
| INSERT | 블록 삽입 | ✅ P2 |
| ATTRIB | 블록 속성 | ⚠️ P3 |

### 영역/해치 Entity

| Entity | 설명 | 지원 |
|--------|------|------|
| HATCH | 해치 패턴 | ⚠️ P3 |
| SOLID | 2D 솔리드 | ✅ P2 |

### 3D Entity

| Entity | 설명 | 지원 |
|--------|------|------|
| 3DFACE | 3D 면 | ❌ P4 |
| 3DSOLID | 3D 솔리드 | ❌ P4 |
| MESH | 메쉬 | ❌ P4 |

## 4. ACI 색상 변환 (AutoCAD Color Index)

```typescript
const ACI_TO_RGBA: Record<number, [number, number, number, number]> = {
  0:   [0, 0, 0, 1],       // BYBLOCK
  1:   [1, 0, 0, 1],       // Red
  2:   [1, 1, 0, 1],       // Yellow
  3:   [0, 1, 0, 1],       // Green
  4:   [0, 1, 1, 1],       // Cyan
  5:   [0, 0, 1, 1],       // Blue
  6:   [1, 0, 1, 1],       // Magenta
  7:   [1, 1, 1, 1],       // White/Black
  256: [0, 0, 0, 1],       // BYLAYER
};
```

## 5. npm 라이브러리 비교

| 라이브러리 | Entity 지원 | SVG 출력 | 추천 |
|-----------|-------------|----------|------|
| **dxf** | LINE, CIRCLE, ARC, POLYLINE, SPLINE | ✅ | ⭐ 채택 |
| **@dxfjs/parser** | 전체 Entity | ❌ | 보완용 |
| **dxf-parser** | 기본 2D | ❌ | - |

### dxf 라이브러리 사용법

```javascript
import Helper from 'dxf';

const helper = new Helper(dxfString);
helper.parsed;       // 파싱된 객체
helper.denormalised; // 블록 확장된 전체 엔티티
helper.toSVG();      // SVG 문자열
helper.toPolylines(); // 폴리라인 배열
```

## References

- [Autodesk DXF Reference](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-235B22E0-A567-4CF6-92D3-38A2306D73F3)
- [ezdxf 문서 (Python)](https://ezdxf.readthedocs.io/)
- [dxf npm 패키지](https://github.com/bjnortier/dxf)
