# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.3.0] - 2026-01-14

### Added

#### 웹 아키텍처 전환 (Epic 9)
- **GitHub Pages 배포**: Electron 의존성 제거, 브라우저에서 직접 접근
  - https://parktube.github.io/7-division/
- **npm 패키지 배포**: `npx @ai-native-cad/mcp start`로 MCP 서버 즉시 실행
- **공유 타입 패키지**: `@ai-native-cad/shared` (Zod 스키마 기반)
  - Viewer ↔ MCP 간 타입 안전성 보장

#### 버전 호환성 체크
- **Semantic Versioning 기반 호환성 검사**
  - Major 불일치: 에러, 연결 차단
  - Minor 불일치: 경고, 연결 허용
  - Patch 차이: 무시
- **연결 시 버전 정보 교환**: Viewer/MCP 버전 표시

#### 부분 편집 모드 (old_code/new_code)
- **run_cad_code MCP**: `old_code` → `new_code` 교체 지원
  - 전체 파일 덮어쓰기 없이 특정 부분만 수정
  - old_code 미발견 시 에러 반환

#### 경로 통합
- **CLI/MCP 동일 경로**: `~/.ai-native-cad/`
  - scene.json, scene.code.js, modules/ 공유
  - 별도 동기화 불필요

### Changed

- Viewer: Electron 제거, 순수 React 웹앱으로 전환
- MCP: stdio 기반 서버로 통합 (HTTP 제거)
- WebSocket: 연결 상태 UI 개선 (연결됨/연결 중/오프라인)
- 버전 관리: package.json에서 동적 로드 (하드코딩 제거)

### Removed

- Electron 관련 코드 및 의존성
- HTTP 서버 엔드포인트 (WebSocket으로 대체)

### Documentation

- [Story 9-10](docs/sprint-artifacts/9-10-electron-cleanup.md): Electron 정리 완료
- CLAUDE.md: 웹 아키텍처 Quick Start 업데이트

---

## [0.2.0] - 2026-01-13

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
  - 반환: `{ scale, offsetX, offsetY, code }` (code는 복사 가능한 scale() 호출문)

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

- [ADR-006](docs/adr/006-geometry-engine.md): Manifold 기하 엔진 구현 상태 추가
- Epic 8: LLM DX 개선 스토리 추가
- [CLAUDE.md](CLAUDE.md): 새 API 문서화 (fitToViewport, --clear-sketch, 트랜잭션)
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

*작성: 2026-01-09 | 최종 업데이트: 2026-01-14*
