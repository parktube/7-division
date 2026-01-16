---
status: ready-for-dev
currentEpic: 10
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - docs/prd.md
  - docs/architecture.md
  - docs/ux-design-specification.md
---

# AI-Native CAD - Epic Breakdown

## Overview

AI-Native CAD 프로젝트의 에픽 목록입니다.

## Epic 진행 상황

| Epic | 제목 | 상태 |
|------|------|------|
| 1 | CAD 엔진 기초 | ✅ 완료 |
| 2 | Canvas 2D 뷰어 | ✅ 완료 |
| 3 | 변환과 Export | ✅ 완료 |
| 4 | 그룹화 및 피봇 | ✅ 완료 |
| 5 | Selection UI | ✅ 완료 |
| 6 | Electron 앱 | ✅ 완료 |
| 7 | 인간-LLM 협업 UI | ✅ 완료 |
| 8 | Manifold 기하 엔진 + 텍스트 렌더링 | ✅ 완료 |
| 9 | 웹 아키텍처 전환 | ✅ 완료 |
| 10 | AX 개선 - MCP 도구 재설계 | 🚧 진행 중 |

---

## Requirements Inventory

### Functional Requirements

| ID | 기능 | 설명 |
|----|------|------|
| FR31 | 3패널 레이아웃 | Layer Panel / Canvas / Info Panel 구성 |
| FR32 | 패널 리사이즈 | 드래그로 패널 너비 조절 |
| FR33 | 계층 트리뷰 | JS 코드의 그룹/오브젝트를 트리로 표시 |
| FR34 | 그룹 탐색 | 그룹 선택, 확장, 중첩 그룹 탐색 |
| FR35 | 다중 선택 | Ctrl/Shift + 클릭으로 복수 선택 |
| FR36 | Visible 토글 | 끄면 Canvas에서 숨김 |
| FR37 | Lock 가드 | 잠긴 엔티티 수정 시 LLM에 경고 반환 |
| FR38 | 스케치 모드 | Canvas에 그리기/지우기 UI, 투명 오버레이 |
| FR39 | 스케치 캡쳐 | capture_viewport로 스케치 포함 캡쳐 → Vision 해석 |
| FR40 | 단일 소스 | viewer/가 유일한 소스, 웹/Electron 동일 코드 |
| FR41 | 좌표 정보 표시 | Info Panel에서 로컬/월드 좌표 토글 표시 |
| FR42 | 이중 좌표 API | 변환 API에 space 옵션 ('world' \| 'local') 지원 |

### Epic 8 Functional Requirements (완료)

| ID | 기능 | 설명 |
|----|------|------|
| FR43 | 추가 모드 변수 접근 | + prefix로 기존 변수/함수 참조 |
| FR44 | 스케치 자동 클리어 | --clear-sketch 플래그로 sketch.json 초기화 |
| FR45 | 자동 스케일 계산 | fitToViewport() 함수로 최적 스케일 계산 |
| FR46 | 실행 트랜잭션 | 에러 시 파일/씬 롤백 |
| FR47 | Boolean 연산 | Manifold union/difference/intersect |
| FR48 | 기하 분석 | offset, convexHull, area, decompose |
| FR49 | 텍스트 렌더링 | opentype.js 기반 Polygon 변환 |
| FR50 | 한글 폰트 자동 검색 | 플랫폼별 시스템 폰트 탐색 |

### Epic 9 Functional Requirements

| ID | 기능 | 설명 |
|----|------|------|
| FR51 | 모노레포 전환 | pnpm workspace로 프로젝트 재구성 |
| FR52 | WebSocket 통신 | Viewer ↔ MCP 실시간 통신 |
| FR53 | MCP stdio 서버 | Claude Code 연동 (JSON-RPC) |
| FR54 | MCP WebSocket 서버 | Viewer 연동 (브로드캐스트) |
| FR55 | GitHub Pages 배포 | Viewer 정적 호스팅 |
| FR56 | npm 패키지 배포 | @ai-native-cad/mcp |
| FR57 | 온보딩 UI | MCP 미연결 시 가이드 |
| FR58 | 버전 호환성 체크 | MCP ↔ Viewer 버전 검증 |

### Epic 10 Functional Requirements

| ID | 기능 | 설명 |
|----|------|------|
| FR59 | glob 도구 | 파일 목록 조회 (main + 모듈), Claude Code Glob 패턴 일치 |
| FR60 | read 도구 | 파일 읽기, Read-first 패턴 강제 |
| FR61 | edit 도구 | 파일 부분 수정 → 자동 실행, old_code/new_code |
| FR62 | write 도구 | 파일 전체 작성 → 자동 실행 |
| FR63 | lsp 도구 | 코드 인텔리전스 (도메인/함수 탐색), discovery 대체 |
| FR64 | bash 도구 | 명령 실행 (씬 조회, 내보내기), scene/export 대체 |
| FR65 | 레거시 도구 제거 | cad_code, discovery, scene, export, module 제거 |
| FR66 | HMR 스타일 실행 | 매번 reset + main.js 재실행, scene.json 동기화 유지 (10.10) |

### Non-Functional Requirements

| ID | 요구사항 | 설명 |
|----|---------|------|
| NFR18 | 패널 리사이즈 성능 | 60fps 유지 |
| NFR19 | 렌더링 동등성 | React 전환 후 기존과 동일 품질 |
| NFR20 | 웹/Electron 동등성 | 동일 기능 동작 |
| NFR21 | WebSocket 지연시간 | RTT p50 < 15ms, p95 < 50ms |
| NFR22 | 온보딩 시간 | 1분 이내 시작 가능 |
| NFR23 | 보안 | localhost-only 바인딩 (127.0.0.1) |
| NFR24 | Read-first 패턴 준수율 | > 95% |
| NFR25 | 기존 모듈 재사용율 | > 90% |
| NFR26 | 도구 학습 비용 | 0 (Claude Code 패턴 그대로) |

### Technical Stack

**현재 (Epic 1-8):**
- React 19 + TypeScript 5.7 + Vite
- TailwindCSS 4.x + Lucide React
- Rust → WASM (CAD 엔진)
- Manifold WASM (기하 연산)
- opentype.js (텍스트 렌더링)
- scene.json 폴링 (100ms)

**Epic 9 이후:**
- pnpm 모노레포 (apps/viewer, apps/cad-mcp, packages/shared)
- WebSocket 실시간 통신 (폴링 → ws://)
- MCP Server (stdio + WebSocket 듀얼)
- GitHub Pages + npm 패키지 배포
- Electron 제거

**UX/접근성:**
- WCAG AA 준수
- 키보드 네비게이션 완전 지원
- 듀얼 테마 (Dark/Light)

### FR Coverage Map

| 요구사항 | Epic | 설명 |
|----------|------|------|
| FR31 | 7.1 | 3패널 레이아웃 |
| FR32 | 7.1 | 패널 리사이즈 |
| FR33 | 7.2 | 계층 트리뷰 |
| FR34 | 7.2 | 그룹 탐색 |
| FR35 | 7.2 | 다중 선택 |
| FR36 | 7.3 | Visible 토글 |
| FR37 | 7.3 | Lock 가드 |
| FR38 | 7.4 | 스케치 모드 |
| FR39 | 7.4 | 스케치 캡쳐 |
| FR40 | 7.1 | 단일 소스 |
| NFR18 | 7.1 | 60fps 성능 |
| NFR19 | 7.1 | 렌더링 동등성 |
| NFR20 | 7.1 | Web/Electron 동등성 |
| FR41 | 7.5 | 좌표 정보 표시 |
| FR42 | 7.5 | 이중 좌표 API |
| FR43 | 8 | 추가 모드 변수 접근 |
| FR44 | 8 | 스케치 자동 클리어 |
| FR45 | 8 | 자동 스케일 계산 |
| FR46 | 8 | 실행 트랜잭션 |
| FR47 | 8 | Boolean 연산 |
| FR48 | 8 | 기하 분석 |
| FR49 | 8 | 텍스트 렌더링 |
| FR50 | 8 | 한글 폰트 자동 검색 |
| FR51 | 9.1 | 모노레포 전환 |
| FR52 | 9.2 | WebSocket 통신 |
| FR54 | 9.3 | MCP WebSocket 서버 |
| FR53 | 9.4 | MCP stdio 서버 |
| FR55 | 9.5 | GitHub Pages 배포 |
| FR56 | 9.6 | npm 패키지 배포 |
| FR57 | 9.7 | 온보딩 UI |
| FR58 | 9.8 | 버전 호환성 체크 |
| NFR21 | 9.9 | WebSocket 지연시간 |
| FR59 | 10.1 | glob 도구 |
| FR60 | 10.2 | read 도구 |
| FR61 | 10.3 | edit 도구 |
| FR62 | 10.4 | write 도구 |
| FR63 | 10.5 | lsp 도구 |
| FR64 | 10.6 | bash 도구 |
| FR65 | 10.7 | 레거시 도구 제거 |
| NFR24 | 10.8 | AX 검증 (Read-first 패턴) |
| FR65 | 10.9 | discovery.ts 레거시 정리 |
| FR66 | 10.10 | HMR 스타일 실행 |

---

## 완료된 Epics (요약)

### Epic 8: Manifold 기하 엔진 + 텍스트 렌더링 ✅

고급 기하 연산과 텍스트 렌더링으로 CAD 기능 확장 (FR43-FR50)

- **DX 개선**: 추가 모드 변수 접근, 스케치 자동 클리어, 자동 스케일 계산, 실행 트랜잭션(롤백)
- **Manifold 기하**: Boolean 연산 (union/difference/intersect), offset, convexHull, area, decompose
- **텍스트**: opentype.js 기반 렌더링, 한글 폰트 자동 검색 (Win/Mac/Linux)

### Epic 7: 인간-LLM 협업 UI ✅

- React 19 + TypeScript + Vite 뷰어
- 3패널 레이아웃 (Layer / Canvas / Info)
- 레이어 트리뷰 및 다중 선택
- Visible/Lock 상태 관리
- 스케치 모드 (의도 전달)
- 이중 좌표 시스템 (Local/World)
- Electron 통합

### Epic 1-6: MVP 기초 ✅

- **Epic 1-3**: WASM CAD 엔진, 기초 도형 6종, 스타일/변환, Canvas 2D 뷰어, JSON/SVG Export
- **Epic 4-5**: Group/Ungroup, Pivot 설정, 계층적 변환, 클릭/다중 선택, selection.json
- **Epic 6**: electron-vite 기반 앱, File polling, Windows/Mac 빌드

---

## Epic 9: 웹 아키텍처 전환

**목표**: Electron 앱을 웹 기반으로 전환하여 배포/유지보수 단순화

### 배경

| 문제 | Electron | Web + Local MCP |
|------|----------|-----------------|
| 업데이트 | 앱 재배포 + 사용자 재설치 | GitHub Pages 배포만 |
| 유지보수 | 두 플랫폼 (Win/Mac) 빌드 | 웹 하나만 |
| 온보딩 | 5분+ (다운로드, 설치) | 1분 이내 |
| 개발 속도 | 느림 (electron-vite) | 빠름 (Vite HMR) |

### Definition of Done (DoD)

1. 기존 모든 테스트 통과 (Vitest, Clippy)
2. WebSocket RTT p50 < 15ms, p95 < 50ms
3. GitHub Pages에서 Viewer 정상 로드
4. `npx @ai-native-cad/mcp start` 동작 확인
5. `cad-electron/` 디렉토리 완전 제거

### FR Coverage Map

| 요구사항 | Story | 설명 |
|----------|-------|------|
| FR51 | 9.1 | 모노레포 전환 (pnpm workspace) |
| FR52 | 9.2 | WebSocket 통신 (Viewer ↔ MCP) |
| FR54 | 9.3 | MCP WebSocket 서버 (Viewer 연동) |
| FR53 | 9.4 | MCP stdio 서버 (Claude Code 연동) |
| FR55 | 9.5 | GitHub Pages 배포 |
| FR56 | 9.6 | npm 패키지 배포 (@ai-native-cad/mcp) |
| FR57 | 9.7 | 온보딩 UI (MCP 미연결 시 가이드) |
| FR58 | 9.8 | 버전 호환성 체크 (MCP ↔ Viewer) |
| NFR21 | 9.9 | 성능 벤치마크 (로컬 실행) |
| - | 9.10 | Electron 제거 및 정리 |

### Implementation Phases

**Phase 1: 모노레포 전환 + WebSocket (Story 9.1~9.2)**
- pnpm workspace 설정
- viewer/ → apps/viewer/
- cad-tools/ → apps/cad-mcp/
- useWebSocket hook 구현
- 품질 게이트: pnpm -r build 성공

**Phase 2: MCP 서버 완성 (Story 9.3~9.4)**
- WebSocket 서버 구현 (9.3 선행)
- stdio 서버가 WebSocket으로 브로드캐스트 (9.4)
- 기존 cad-tools/src/sandbox/ 재활용
- 품질 게이트: 기존 테스트 100% 통과

**Phase 3: 배포 파이프라인 (Story 9.5~9.8)**
- GitHub Pages 정적 배포
- npm registry 배포 (@ai-native-cad/mcp)
- 온보딩 UI (MCP 연결 가이드)
- 버전 호환성 체크
- 품질 게이트: E2E 시나리오 통과

**Phase 4: 성능 검증 & 정리 (Story 9.9~9.10)**
- WebSocket 벤치마크 (로컬 실행, CI 게이트 아님)
- cad-electron/ 디렉토리 완전 제거
- 문서 정리 (CLAUDE.md, README.md)
- 품질 게이트: DoD 5개 항목 충족

### 제거 대상

- `cad-electron/` 디렉토리 전체

### 상세 설계

architecture.md Part 2 참조

---

### Story 9.1: 모노레포 전환 (pnpm workspace)

As a **개발자**,
I want **프로젝트를 pnpm workspace 모노레포로 전환하기를**,
So that **Viewer와 MCP 서버 간 코드 공유 및 버전 관리가 용이해진다** (FR51).

**Acceptance Criteria:**

**Given** 현재 viewer/, cad-tools/ 디렉토리 구조가 있을 때
**When** 모노레포 전환을 완료하면
**Then** 다음 구조가 생성된다:
```
apps/
  viewer/        # React Viewer
  cad-mcp/       # MCP Server + CLI
packages/
  shared/        # 공유 타입/유틸
pnpm-workspace.yaml
```
**And** `pnpm -r build` 명령이 모든 패키지를 빌드한다
**And** 기존 기능이 동일하게 동작한다

**Technical Notes:**
- pnpm 10.x 사용
- packages/shared에 Zod 스키마, 타입 정의 배치
- tsconfig.json references 설정

---

### Story 9.2: WebSocket Hook 구현

As a **Viewer 개발자**,
I want **useWebSocket 커스텀 훅을 구현하기를**,
So that **MCP 서버와 실시간 통신이 가능하다** (FR52).

**Acceptance Criteria:**

**Given** MCP 서버가 ws://localhost:3001에서 실행 중일 때
**When** Viewer가 useWebSocket 훅으로 연결하면
**Then** scene/selection 업데이트가 실시간으로 수신된다
**And** 연결 상태(connecting, connected, disconnected)가 추적된다

**Given** MCP 서버와 연결이 끊어졌을 때
**When** 자동 재연결이 시도되면
**Then** 지수 백오프(1s→2s→4s→8s→16s, max 5회)가 적용된다
**And** 연결 복구 시 최신 상태가 동기화된다

**Given** 메시지가 수신될 때
**When** scene_update 타입이면
**Then** SceneStore가 업데이트된다
**And** useWebSocket이 반환하는 scene 상태가 갱신된다

**Technical Notes:**
- ws 네이티브 WebSocket 사용 (라이브러리 없음)
- Zod로 메시지 런타임 검증
- React 19 호환 (useSyncExternalStore 패턴)

---

### Story 9.3: MCP WebSocket 서버

As a **MCP 서버 개발자**,
I want **WebSocket 서버를 구현하기를**,
So that **Viewer가 실시간으로 scene 업데이트를 받을 수 있다** (FR54).

**Acceptance Criteria:**

**Given** MCP 서버가 시작될 때
**When** WebSocket 서버가 ws://127.0.0.1:3001에서 리슨하면
**Then** Viewer 클라이언트가 연결할 수 있다
**And** 127.0.0.1만 바인딩된다 (보안)

**Given** 클라이언트가 연결되었을 때
**When** 초기 연결 후
**Then** 현재 scene/selection 상태가 즉시 전송된다

**Given** 여러 클라이언트가 연결되었을 때
**When** scene이 업데이트되면
**Then** 모든 클라이언트에 브로드캐스트된다

**Given** 클라이언트가 ping을 보낼 때
**When** 서버가 수신하면
**Then** pong 응답이 반환된다 (heartbeat)

**Technical Notes:**
- ws 라이브러리 사용 (Node.js)
- 포트 충돌 시 3001→3002→3003 자동 탐색
- 메시지 포맷: Zod 스키마 검증

---

### Story 9.4: MCP stdio 서버

As a **Claude Code 사용자**,
I want **stdio 기반 MCP 서버가 동작하기를**,
So that **Claude Code에서 CAD 도구를 호출하고 Viewer에 실시간 반영된다** (FR53).

**Acceptance Criteria:**

**Given** Claude Code가 MCP 서버에 연결되었을 때
**When** cad_code 도구를 호출하면
**Then** WASM 엔진에서 코드가 실행된다
**And** 결과가 WebSocket으로 Viewer에 브로드캐스트된다 (Story 9.3 의존)

**Given** stdio로 JSON-RPC 요청이 들어올 때
**When** 유효한 MCP 프로토콜이면
**Then** 도구 목록, 도구 실행, 리소스 접근이 가능하다

**Given** describe 명령이 호출될 때
**When** 도메인 이름이 전달되면
**Then** 해당 도메인의 함수 목록과 시그니처가 반환된다

**Technical Notes:**
- @modelcontextprotocol/sdk 사용
- 기존 cad-tools/src/sandbox/ 코드 재활용
- stdio + WebSocket 동시 운영 (듀얼 서버)

---

### Story 9.5: GitHub Pages 배포

As a **사용자**,
I want **GitHub Pages에서 Viewer에 접근할 수 있기를**,
So that **앱 설치 없이 브라우저만으로 CAD를 사용할 수 있다** (FR55).

**Acceptance Criteria:**

**Given** apps/viewer가 빌드될 때
**When** GitHub Actions가 실행되면
**Then** 정적 파일이 GitHub Pages에 배포된다
**And** https://<user>.github.io/7-division/ 에서 접근 가능하다

**Given** Viewer가 로드될 때
**When** MCP 서버가 연결되지 않은 상태면
**Then** 온보딩 UI가 표시된다 (Story 9.7)

**Given** 새 커밋이 main 브랜치에 푸시될 때
**When** CI가 통과하면
**Then** 자동으로 재배포된다

**Technical Notes:**
- GitHub Actions workflow 설정
- Vite base path 설정 (/7-division/)
- 캐시 무효화 전략 (hash in filename)

---

### Story 9.6: npm 패키지 배포

As a **사용자**,
I want **`npx @ai-native-cad/mcp start`로 MCP 서버를 시작할 수 있기를**,
So that **한 줄 명령으로 로컬 개발 환경이 준비된다** (FR56).

**Acceptance Criteria:**

**Given** npm registry에 @ai-native-cad/mcp가 배포되었을 때
**When** `npx @ai-native-cad/mcp start`를 실행하면
**Then** MCP 서버(stdio + WebSocket)가 시작된다
**And** "Server running at ws://127.0.0.1:3001" 메시지가 출력된다

**Given** 패키지를 배포할 때
**When** npm publish를 실행하면
**Then** WASM 바이너리가 패키지에 포함된다
**And** 의존성 설치 없이 바로 실행 가능하다

**Given** 버전을 업데이트할 때
**When** package.json 버전을 올리고 publish하면
**Then** 새 버전이 npm에 배포된다

**Pre-requisite:**
- @ai-native-cad npm 스코프 가용성 확인 (또는 대안 네임스페이스)

**Technical Notes:**
- npm org 생성 필요 (@ai-native-cad)
- bin 필드로 CLI 진입점 설정
- prepublishOnly 스크립트로 WASM 빌드

---

### Story 9.7: 온보딩 UI

As a **신규 사용자**,
I want **MCP 미연결 시 연결 가이드가 표시되기를**,
So that **어떻게 시작해야 하는지 즉시 알 수 있다** (FR57).

**Acceptance Criteria:**

**Given** Viewer가 로드되고 MCP가 연결되지 않았을 때
**When** 5초간 연결 시도가 실패하면
**Then** 온보딩 오버레이가 표시된다:
  - "MCP 서버 미연결"
  - "npx @ai-native-cad/mcp start" 복사 버튼
  - 연결 재시도 버튼

**Given** 온보딩 UI가 표시된 상태에서
**When** MCP 서버가 연결되면
**Then** 온보딝 오버레이가 자동으로 사라진다
**And** 정상 UI가 표시된다

**Given** 복사 버튼을 클릭했을 때
**When** 클립보드에 복사되면
**Then** "복사됨!" 피드백이 표시된다

**Technical Notes:**
- 연결 상태 기반 조건부 렌더링
- localStorage로 "다시 보지 않기" 옵션 (선택)

---

### Story 9.8: 버전 호환성 체크

As a **사용자**,
I want **MCP와 Viewer 버전 불일치 시 경고를 받기를**,
So that **호환성 문제로 인한 버그를 예방할 수 있다** (FR58).

**Acceptance Criteria:**

**Given** Viewer와 MCP 서버가 연결될 때
**When** 버전 핸드셰이크가 완료되면
**Then** 호환성이 검증된다:
  - Major 버전 불일치: 에러 표시 + 연결 차단
  - Minor 버전 불일치: 경고 표시 + 연결 유지

**Given** Viewer 버전이 1.2.x이고 MCP가 1.3.x일 때
**When** 연결되면
**Then** "MCP 서버가 더 새로운 버전입니다. 업데이트를 권장합니다." 경고

**Given** Viewer 버전이 2.x이고 MCP가 1.x일 때
**When** 연결을 시도하면
**Then** "호환되지 않는 버전입니다. MCP를 업데이트하세요." 에러
**And** 연결이 차단된다

**Technical Notes:**
- SemVer 파싱 (major.minor.patch)
- WebSocket 연결 시 version 필드 교환
- 에러 시 오프라인 모드로 동작 (읽기 전용)

---

### Story 9.9: 성능 벤치마크

As a **개발자**,
I want **WebSocket 성능을 측정할 수 있기를**,
So that **NFR21 (RTT p50 < 15ms, p95 < 50ms)을 검증할 수 있다** (NFR21).

**Acceptance Criteria:**

**Given** MCP 서버가 실행 중일 때
**When** `npm run benchmark` (로컬)를 실행하면
**Then** 100회 왕복 시간이 측정된다
**And** p50, p95, max 지표가 출력된다

**Given** 벤치마크 결과가
**When** p50 < 15ms, p95 < 50ms이면
**Then** PASS로 표시된다
**And** 그렇지 않으면 WARN으로 표시된다 (실패 아님)

**Note:**
- **로컬 실행 전용** - CI 게이트로 사용하지 않음
- 네트워크 환경에 따라 결과 가변

**Technical Notes:**
- 로컬 개발 환경에서 수동 실행
- console.time/timeEnd 또는 performance.now() 사용
- 결과는 참고용 (CI 블로킹 아님)

---

### Story 9.10: Electron 제거 및 정리

As a **개발자**,
I want **cad-electron/ 디렉토리를 완전히 제거하기를**,
So that **더 이상 Electron 관련 코드를 유지보수하지 않아도 된다**.

**Acceptance Criteria:**

**Given** Epic 9의 모든 스토리가 완료되었을 때
**When** cad-electron/ 디렉토리를 삭제하면
**Then** Git에서 완전히 제거된다
**And** package.json의 electron 관련 의존성이 제거된다

**Given** CLAUDE.md를 업데이트할 때
**When** Electron 관련 내용을 제거하면
**Then** 웹 아키텍처 기반으로 문서가 갱신된다

**Given** README.md를 업데이트할 때
**When** 설치/실행 가이드를 변경하면
**Then** `npx @ai-native-cad/mcp start` 기반으로 안내된다

**Definition of Done 확인:**
- [ ] 기존 모든 테스트 통과
- [ ] WebSocket RTT p50 < 15ms, p95 < 50ms (로컬 확인)
- [ ] GitHub Pages에서 Viewer 정상 로드
- [ ] `npx @ai-native-cad/mcp start` 동작
- [ ] `cad-electron/` 완전 제거

**Technical Notes:**
- git rm -r cad-electron/
- CI 워크플로우에서 Electron 빌드 제거
- 최종 검증 후 main 브랜치에 머지

---

## Epic 10: AX 개선 - MCP 도구 재설계

**목표**: LLM이 MCP 도구를 Claude Code처럼 자연스럽게 사용하도록 도구 재설계

### 배경

| 문제 | 원인 | 결과 |
|------|------|------|
| Read-first 패턴 무시 | `cad_code`가 "실행기"로 인식됨 | 기존 코드 확인 없이 새 코드 작성 |
| 기존 모듈 무시 | 모듈 목록 확인 없이 작업 | 중복 모듈 생성 |
| 통합 도구 한계 | 하나의 도구에 다기능 통합 | "기본 모드"만 사용 |

**핵심 통찰**: LLM은 이미 Claude Code 도구 패턴을 학습함. 같은 이름 = 같은 행동 기대.

### Definition of Done (DoD)

1. 6개 신규 도구 (glob, read, edit, write, lsp, bash) 구현 완료
2. 레거시 도구 (cad_code, discovery, scene, export, module) 제거
3. CLAUDE.md 업데이트 완료
4. 기존 테스트 100% 통과
5. Read-first 패턴 검증 (수동 테스트)

### FR Coverage Map

| 요구사항 | Story | 설명 |
|----------|-------|------|
| FR59 | 10.1 | glob 도구 (파일 목록) |
| FR60 | 10.2 | read 도구 (파일 읽기) |
| FR61 | 10.3 | edit 도구 (파일 수정) |
| FR62 | 10.4 | write 도구 (파일 작성) |
| FR63 | 10.5 | lsp 도구 (코드 인텔리전스) |
| FR64 | 10.6 | bash 도구 (명령 실행) |
| FR65 | 10.7 | 레거시 도구 제거 |
| NFR24 | 10.8 | AX 검증 |
| FR65 | 10.9 | discovery.ts 레거시 정리 |
| FR66 | 10.10 | HMR 스타일 실행 |

### Implementation Phases

**Phase 1: 파일 관리 도구 (Story 10.1~10.4)**
- glob, read, edit, write 구현
- 기존 cad_code/module 로직 분리/재활용
- 품질 게이트: 파일 CRUD 테스트 통과

**Phase 2: 보조 도구 (Story 10.5~10.6)**
- lsp (discovery 대체)
- bash (scene/export 대체)
- 품질 게이트: 기존 테스트 100% 통과

**Phase 3: 마이그레이션 (Story 10.7~10.8)**
- 레거시 도구 deprecated → 제거
- CLAUDE.md 업데이트
- AX 검증 (수동 테스트)
- 품질 게이트: DoD 5개 항목 충족

### 상세 설계

architecture.md Part 3 참조

---

### Story 10.1: glob 도구 구현

As a **LLM 에이전트**,
I want **glob 도구로 파일 목록을 조회할 수 있기를**,
So that **작업 전 기존 파일(모듈)을 확인할 수 있다** (FR59).

**Acceptance Criteria:**

**Given** CAD 프로젝트에 main과 모듈들이 있을 때
**When** `glob({})` 호출하면
**Then** `['main', 'iso_lib', 'city_lib']` 형태로 파일 목록 반환

**Given** 패턴을 지정했을 때
**When** `glob({ pattern: '*_lib' })` 호출하면
**Then** `['iso_lib', 'city_lib']` 처럼 패턴 매칭된 목록 반환

**Technical Notes:**
- Claude Code Glob 도구와 동일한 API 형태
- main은 항상 포함 (특수 파일)
- 모듈 디렉토리 (~/.ai-native-cad/modules/) 스캔

---

### Story 10.2: read 도구 구현

As a **LLM 에이전트**,
I want **read 도구로 파일 내용을 읽을 수 있기를**,
So that **edit/write 전에 기존 코드를 확인할 수 있다** (FR60).

**Acceptance Criteria:**

**Given** main 파일이 존재할 때
**When** `read({ file: 'main' })` 호출하면
**Then** main 코드 내용이 반환된다

**Given** 모듈이 존재할 때
**When** `read({ file: 'iso_lib' })` 호출하면
**Then** 해당 모듈 코드가 반환된다

**Given** 존재하지 않는 파일일 때
**When** `read({ file: 'nonexistent' })` 호출하면
**Then** 에러 메시지 반환 ("File not found: nonexistent")

**Technical Notes:**
- description: "파일 읽기. edit/write 전에 반드시 먼저 확인."
- Read-first 패턴 유도를 위한 핵심 도구

---

### Story 10.3: edit 도구 구현

As a **LLM 에이전트**,
I want **edit 도구로 파일을 부분 수정할 수 있기를**,
So that **기존 코드의 일부만 변경할 수 있다** (FR61).

**Acceptance Criteria:**

**Given** 파일에 특정 코드가 있을 때
**When** `edit({ file: 'main', old_code: 'drawCircle(...)', new_code: 'drawRect(...)' })` 호출하면
**Then** 해당 부분이 교체되고 자동 실행된다
**And** 실행 결과(씬 상태)가 반환된다

**Given** old_code가 파일에 없을 때
**When** edit 호출하면
**Then** 에러 반환 ("old_code not found in file")

**Given** read 없이 edit를 시도할 때
**When** 해당 파일을 이전에 read하지 않았으면
**Then** 경고 메시지 포함 ("Warning: Consider using read first")

**Technical Notes:**
- description: "파일 부분 수정 → 자동 실행. ⚠️ read로 먼저 확인 필수."
- Claude Code Edit 도구와 동일한 old_code/new_code 패턴

---

### Story 10.4: write 도구 구현

As a **LLM 에이전트**,
I want **write 도구로 파일을 전체 작성할 수 있기를**,
So that **새 파일 생성 또는 전체 교체가 가능하다** (FR62).

**Acceptance Criteria:**

**Given** 파일 이름과 코드가 있을 때
**When** `write({ file: 'main', code: '...' })` 호출하면
**Then** 파일이 작성되고 자동 실행된다
**And** 실행 결과(씬 상태)가 반환된다

**Given** 새 모듈을 생성할 때
**When** `write({ file: 'new_lib', code: '...' })` 호출하면
**Then** 새 모듈 파일이 생성된다

**Given** 기존 파일이 있는데 read 없이 write할 때
**When** 덮어쓰기가 발생하면
**Then** 경고 메시지 포함 ("Warning: Overwriting existing file. Consider using read first")

**Technical Notes:**
- description: "파일 전체 작성 → 자동 실행. ⚠️ 기존 파일은 read로 먼저 확인."
- 새 파일 생성 시에는 경고 없음

---

### Story 10.5: lsp 도구 구현

As a **LLM 에이전트**,
I want **lsp 도구로 CAD 함수를 탐색할 수 있기를**,
So that **사용 가능한 함수와 시그니처를 확인할 수 있다** (FR63).

**Acceptance Criteria:**

**Given** 도메인 목록을 요청할 때
**When** `lsp({ operation: 'domains' })` 호출하면
**Then** ['primitives', 'transforms', 'style', ...] 목록 반환

**Given** 특정 도메인을 요청할 때
**When** `lsp({ operation: 'describe', domain: 'primitives' })` 호출하면
**Then** 해당 도메인의 함수 시그니처 목록 반환

**Given** 특정 함수 스키마를 요청할 때
**When** `lsp({ operation: 'schema', name: 'drawCircle' })` 호출하면
**Then** 상세 파라미터 스키마 반환

**Technical Notes:**
- 기존 discovery 도구 로직 재활용
- operation: 'domains' | 'describe' | 'schema'
- Claude Code LSP와 유사한 코드 인텔리전스 개념

---

### Story 10.6: bash 도구 구현

As a **LLM 에이전트**,
I want **bash 도구로 씬 조회/내보내기 명령을 실행할 수 있기를**,
So that **씬 상태 확인과 출력이 가능하다** (FR64).

**Acceptance Criteria:**

**Given** 씬 정보를 요청할 때
**When** `bash({ command: 'info' })` 호출하면
**Then** 씬 요약 정보 (entityCount, bounds) 반환

**Given** 씬 구조를 요청할 때
**When** `bash({ command: 'tree' })` 또는 `bash({ command: 'groups' })` 호출하면
**Then** 계층 구조 또는 그룹 목록 반환

**Given** 내보내기를 요청할 때
**When** `bash({ command: 'capture' })` 또는 `bash({ command: 'svg' })` 호출하면
**Then** PNG 스크린샷 또는 SVG 반환

**Given** 씬 초기화를 요청할 때
**When** `bash({ command: 'reset' })` 호출하면
**Then** 씬이 초기화되고 확인 메시지 반환

**Technical Notes:**
- 기존 scene, export 도구 로직 통합
- command: 'info' | 'tree' | 'groups' | 'draw_order' | 'reset' | 'capture' | 'svg' | 'json'

---

### Story 10.7: 레거시 도구 제거

As a **개발자**,
I want **기존 도구(cad_code, discovery, scene, export, module)를 제거하기를**,
So that **중복 없이 새 도구만 유지한다** (FR65).

**Acceptance Criteria:**

**Given** 새 도구(glob, read, edit, write, lsp, bash)가 구현되었을 때
**When** 레거시 도구를 제거하면
**Then** MCP 서버에서 더 이상 등록되지 않는다

**Given** 스키마 파일을 정리할 때
**When** CAD_TOOLS 객체를 업데이트하면
**Then** 6개 신규 도구만 포함된다

**Given** 테스트를 실행할 때
**When** 모든 테스트가 통과하면
**Then** 마이그레이션 완료

**Technical Notes:**
- schema.ts에서 기존 도구 정의 제거
- handler.ts에서 기존 핸들러 제거
- CLAUDE.md 도구 가이드 업데이트

---

### Story 10.8: AX 검증 및 문서화

As a **개발자**,
I want **새 도구 패턴이 LLM에서 올바르게 동작하는지 검증하기를**,
So that **Read-first 패턴 준수율이 향상됨을 확인한다** (NFR24).

**Acceptance Criteria:**

**Given** 새 도구가 배포되었을 때
**When** Claude Code에서 CAD 작업을 요청하면
**Then** read → edit/write 순서로 호출된다

**Given** 기존 모듈이 있을 때
**When** 새 작업을 요청하면
**Then** glob → read → 기존 모듈 활용 패턴 확인

**Given** CLAUDE.md를 업데이트할 때
**When** 새 도구 가이드를 작성하면
**Then** glob, read, edit, write, lsp, bash 사용법 문서화

**Technical Notes:**
- 수동 테스트 (자동화 어려움)
- CLAUDE.md 도구 섹션 전면 개편
- 성공 기준: Read-first 패턴 > 95% 준수 (관찰)

---

### Story 10.10: HMR 스타일 코드 실행

As a **LLM 에이전트**,
I want **코드 수정 시 매번 clean 상태에서 재실행되기를**,
So that **translate() 등 누적 변환이 발생하지 않는다** (FR66).

**배경:**

현재 문제:
```
edit → main.js 저장 → 실행 (이전 씬 위에) → scene.json 저장
                              ↑ translate()가 누적됨
```

HMR 스타일 해결:
```
edit → main.js 저장 → reset() + 실행 → 브로드캐스트 + scene.json 저장
                      ↑ 매번 clean 상태
```

**Acceptance Criteria:**

**Given** main.js에 `translate('entity', 10, 0)` 코드가 있을 때
**When** edit 도구로 코드를 수정하면
**Then** 씬이 먼저 reset되고 main.js가 재실행된다
**And** translate는 한 번만 적용된다 (누적 아님)

**Given** MCP 서버가 재시작될 때
**When** main.js 파일이 존재하면
**Then** main.js를 실행하여 씬을 복원한다
**When** main.js가 없거나 실행 실패 시
**Then** scene.json에서 폴백 복원한다

**Given** bash reset 명령을 실행할 때
**When** 씬이 초기화되면
**Then** main.js는 재실행되지 않는다 (수동 reset 의도 존중)
**And** scene.json은 빈 씬으로 업데이트된다

**Given** edit/write 후 코드 실행이 실패할 때
**When** 파일이 롤백되면
**Then** 원본 코드가 재실행되어 씬이 복원된다
**And** 사용자는 실패 전 상태를 본다

**Technical Notes:**
- `mcp-server.ts`의 `executeRunCadCode()` 수정
- scene.json 저장 유지 (동기화, 폴백용)
- MCP 시작 시 main.js 우선 → scene.json 폴백
- 롤백 시 원본 코드 재실행으로 씬 복원

**구현 위치:**
```typescript
// apps/cad-mcp/src/mcp-server.ts
async function executeRunCadCode(code: string) {
  const exec = getExecutor();

  // HMR 스타일: 매번 clean 상태에서 시작
  exec.exec('reset', {});

  const result = await runCadCode(exec, code, 'warn');

  if (result.success) {
    const sceneJson = exec.exportScene();
    const scene = JSON.parse(sceneJson);
    wsServer.broadcastScene(scene);
    saveScene(exec);  // scene.json 동기화 유지
  }

  return result;
}
```

**예상 효과:**
- translate/rotate/scale 누적 문제 완전 해결
- 안정성 유지: scene.json 폴백으로 복원 보장
- 롤백 UX 개선: 실패해도 이전 씬 상태 유지
- HMR 패러다임: 웹 개발자에게 익숙한 패턴

---

## 관련 문서

- [PRD](./prd.md) - 제품 요구사항
- [Architecture](./architecture.md) - 기술 아키텍처
- [UX Design Specification](./ux-design-specification.md) - UX 설계
- [ADR-008](./adr/008-tool-pattern-alignment.md) - MCP 도구 패턴 정렬
