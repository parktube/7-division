# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.5.0] - 2026-01-22

### Added

#### Epic 11: MAMA Integration (Memory-Augmented Meta Agent)

AI 에이전트의 세션 간 컨텍스트 유지, 결정 추적, 학습 관리를 위한 통합 시스템입니다.

- **Reasoning Graph**: 결정 간 관계를 추적하는 지식 그래프
  - `mama_save` - 결정/체크포인트/학습 저장
  - `mama_search` - 시맨틱 검색 (임베딩 기반)
  - `mama_update` - 결정 결과 업데이트 (success/failed/partial)
  - 엣지 타입: `supersedes`, `builds_on`, `debates`, `synthesizes`

- **Session Continuity**: 세션 간 컨텍스트 복원
  - `mama_load_checkpoint` - 마지막 체크포인트 로드
  - 자동 세션 초기화 훅 (contextInjection: none/hint/full)
  - 프로액티브 인사 지침 (새 세션 시작 시)

- **Learning Tracker**: 사용자 학습 진행 추적
  - `learning` → `understood` → `applied` → `mastered` 단계
  - `mama_growth_report` - 사용자 성장 리포트
  - 스킬 레벨 기반 적응형 멘토링

- **Design Workflow**: 4단계 디자인 프로세스
  - `mama_workflow` - 프로젝트 생성/상태/단계 전환
  - Discovery → Planning → Architecture → Creation
  - 단계별 디자인 힌트 자동 주입

- **Module Recommendation**: 시맨틱 모듈 추천
  - `mama_recommend_modules` - 쿼리 기반 모듈 검색
  - Score = (semantic × 0.6) + (usage × 0.3) + (recency × 0.1)

- **Graph Health**: 추론 그래프 품질 모니터링
  - `mama_health` - 건강도 점수 (0-100)
  - 에코챔버 경고, 고아 결정 탐지, 오래된 결정 알림

- **Builtin Modules**: 내장 모듈 시스템
  - `~/.ai-native-cad/builtin/` 디렉토리
  - user 모듈이 builtin 오버라이드
  - `glob` 출력에 source 표시 (user/builtin)
  - 기본 제공: isometric 인테리어, Crossy Road 스타일

### Changed

- **Session Init Hook**: MAMA 컨텍스트 자동 주입
- **glob/read/edit/write**: dual-source 지원 (user + builtin)

### Documentation

- [ADR-027](docs/adr/0027-builtin-assets.md): Builtin Assets 결정
- 21개 Sprint Artifact 문서 (11-1 ~ 11-21)

---

## [0.4.1] - 2026-01-19

### Fixed

#### 코드 리뷰 피드백 반영

- **capture.ts 보안 개선**
  - `--no-sandbox`: 로컬 URL 또는 CI 환경에서만 사용
  - `--allow-running-insecure-content`: HTTPS 페이지에서만 사용
  - `__injectScene` 실패 시 에러 throw (빈 스크린샷 방지)
  - 동적 픽셀 샘플링으로 배경 감지

- **씬 복원 안정성 강화**
  - `restoreSceneFromMainCode`: 실패 시 fallback 씬 복원
  - `undo/redo`: reset 전 씬 백업으로 실패 시 복구

- **edit.ts 보안**
  - `rollbackEdit`: path traversal 방어 (isValidFileName 검증)
  - `replace` → `replaceAll` 일관성 적용

### Documentation

- **functions-style.md**: setFill, setStroke, drawOrder, createGroup, addToGroup, getDrawOrder, exists, getEntity, getWorldBounds 반환값 문서화
- **tools-mcp.md**: snapshot/undo/redo, glob 패턴, edit 멀티라인, 에러 복구 워크플로우 추가
- **SKILL.md**: edit 예시 수정, MCP 도구명 매핑 노트, reset 경고 강화
- **CLAUDE.md**: CAD_VIEWER_URL 환경변수 문서화
- **AGENTS.md**: 환경변수 섹션 추가

---

## [0.4.0] - 2026-01-17

### Added

#### Epic 10: AX 문서화 + Claude Code 도구 패턴 정렬

- **MCP 도구 재설계**: Claude Code 패턴과 완전 일치
  - `glob` - 파일 목록 조회
  - `read` - 파일 읽기 (edit/write 전 필수)
  - `edit` - 파일 부분 수정 → 자동 실행 → 실패 시 롤백
  - `write` - 파일 전체 작성 → 자동 실행 → 실패 시 롤백
  - `lsp` - 코드 인텔리전스 (domains, describe, schema, symbols)
  - `bash` - 명령 실행 (tree, capture, svg, json, reset, undo/redo)

- **HMR 스타일 코드 실행**: edit/write 시 자동으로 씬 reset + 전체 코드 재실행
  - 코드 검증 실패 시 빈 씬 방지 (validation-before-reset)
  - 실행 실패 시 파일 + 씬 자동 롤백

- **스냅샷 시스템**: undo/redo 지원
  - `bash({ command: 'snapshot' })` - 스냅샷 저장
  - `bash({ command: 'undo' })` / `bash({ command: 'redo' })`

- **Agent Skills 구조**: Vercel 패턴 채택
  - `skills/cad-voxel/` - Crossy Road 스타일 복셀 아트 가이드
  - SKILL.md + rules/ 디렉토리 구조

- **엔티티 좌표 조회**: `bash({ command: 'entity', name: '...' })`
  - local/world 좌표 모두 반환

### Changed

- **레거시 도구 제거**: cad_code, discovery, scene, export, module
- **문서 업데이트**: AGENTS.md, README.md, CONTRIBUTING.md - 새 도구 패턴 반영
- **ADR-008**: MCP Tool Pattern Alignment 결정 문서화

### Fixed

- **restoreSceneFromMainCode**: reset 전 validation으로 빈 씬 방지
- **scale around:center**: JSON.parse 예외 처리 추가
- **write/rollback**: 예외 안전 처리

### Documentation

- [ADR-008](docs/adr/008-tool-pattern-alignment.md): Claude Code 도구 패턴 정렬
- [cad-sandbox-workflow.md](docs/cad-sandbox-workflow.md): 샌드박스 워크플로우 가이드
- [cad-mcp-guide.md](docs/cad-mcp-guide.md): MCP 도구/함수 가이드
- [ax-design-guide.md](docs/ax-design-guide.md): AX 설계 원칙

---

## [0.3.1] - 2026-01-15

### Fixed

#### Scene Restore 버그 수정
- **Rect 렌더링 수정**: Canvas API `ctx.rect()` 이 Y-flip 변환에서 정상 동작하지 않는 문제
  - 명시적 `moveTo/lineTo` 경로로 변경
- **Group 복원 수정**: `computed.children` 대신 `children` 직접 접근
  - 계층 구조 복원 정확도 개선
- **Transform 복원 추가**: `translate`, `rotate`, `scale` 변환 복원 로직 구현
- **Arc 파라미터명 수정**: `startAngle/endAngle` → `start_angle/end_angle`
  - API 스키마와 일치

#### MCP Import 전처리
- **import 문 처리**: MCP 서버에 `preprocessCode()` 추가
  - CLI와 동일한 모듈 import 동작 보장

### Changed

- **ws-server 포트 설정**: 테스트용 포트 범위 설정 옵션 추가
  - `CADWebSocketServerOptions.startPort/maxPort`
  - 테스트가 실행 중인 MCP 서버와 충돌하지 않음

### Tests

- **importScene 테스트 추가**: 11개 새 테스트 케이스
  - Rect, Circle, Line, Polygon, Arc, Transform, Group, Style 복원
  - Empty scene, invalid JSON, multiple entities 처리

---

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

*작성: 2026-01-09 | 최종 업데이트: 2026-01-22*
