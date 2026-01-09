# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] - feature/manifold-integration

### Added

#### Manifold 기하 엔진 통합
- **Boolean 연산**: `booleanUnion`, `booleanDifference`, `booleanIntersect`
  - Circle, Rect, Polygon, Arc 지원
  - Polygon holes 자동 처리
- **기하 분석**: `offsetPolygon`, `getArea`, `convexHull`, `decompose`
  - offset: 폴리곤 확장/축소 (round, square, miter 옵션)
  - area: 면적 계산
  - convexHull: 볼록 껍질 생성
  - decompose: 분리된 컴포넌트 추출

#### 텍스트 렌더링 (opentype.js)
- **drawText**: 텍스트를 베지어 경로로 변환하여 렌더링
  - fontSize, fontPath, align, color 옵션
  - 한글/영문 지원 (TTF/OTF)
- **getTextMetrics**: 텍스트 치수 미리 계산

#### 엔티티 복제/미러
- **duplicate**: 엔티티 완전 복제 (geometry, transform, style)
  - Group 재귀 복제 지원
- **mirror**: 축 기준 대칭 복제
  - axis: 'x' (좌우) | 'y' (상하)
  - Arc/Bezier/Group 지원

#### Polygon Holes 지원
- `draw_polygon_with_holes`: 구멍이 있는 폴리곤 생성
- Boolean 연산 결과에서 holes 자동 생성

#### Epic 8: LLM DX 개선
- **트랜잭션 패턴**: 코드 실행 실패 시 파일 자동 롤백
  - 변수 재정의 에러 시 명확한 안내 메시지
  - 추가 모드에서 기존 변수 직접 참조 가능
- **스케치 자동 클리어**: `--clear-sketch` 플래그
  - 코드 실행 후 또는 캡처 후 sketch.json 자동 초기화
- **자동 스케일 계산**: `fitToViewport(width, height, options?)`
  - 실제 치수를 뷰포트에 맞는 스케일로 변환
  - 복사 가능한 코드 스니펫 반환

#### 도메인 구조 재설계 (AX 개선)
- **sandbox 도메인 분리**: 기능별 독립 도메인으로 Progressive Disclosure 강화
  - `boolean` - Boolean 연산 (union, difference, intersect)
  - `geometry` - 기하 분석 (offset, area, convexHull, decompose)
  - `text` - 텍스트 렌더링 (drawText, getTextMetrics)
- **도메인 목록 카테고리화**: 도형 생성 / 도형 조작 / 스타일 & 구조 / 조회 & 내보내기
- **transforms 도메인 확장**: duplicate, mirror, pivot 추가
- **각 도메인에 `(run_cad_code로 사용)` 힌트 추가**

### Changed

- capture.ts: 줌 레벨 3x → 1x로 변경 (정밀 캡처용)
- Manifold WASM: lazy 초기화 (Boolean/기하 연산 사용 시에만 로드)
- Manifold 감지 정규식 최적화 (성능 개선)

### Fixed

- duplicate: Polygon holes 복사 버그 수정
- mirror: Arc 각도 미러링 정확도 개선
- transform: 로컬 좌표 변환 버그 수정

### Documentation

- ADR-006: Manifold 기하 엔진 구현 상태 추가
- Epic 8: LLM DX 개선 스토리 추가
- CLAUDE.md: 새 API 문서화 (fitToViewport, --clear-sketch, 트랜잭션)
- 데모 스크린샷: Manifold Boolean, Polygon holes

---

## [0.1.0] - 2026-01-08

### Added

- Epic 1-7 MVP 구현 완료
- Rust CAD 엔진 (WASM)
- React Viewer (3-패널 레이아웃)
- Electron 데스크탑 앱
- 스케치 모드
- Z-Order 관리 (drawOrder API)
- Dual Coordinate API (local/world)

---

*작성: 2026-01-09*
