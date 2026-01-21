---
status: ready-for-dev
currentEpic: 11
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
| 10 | AX 개선 - MCP 도구 재설계 | ✅ 완료 |
| 11 | MAMA Integration | 🚧 구현 중 (Story 11.1~11.17 완료) |

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

### Epic 11 Functional Requirements (계획됨)

| ID | 기능 | Phase | ADR | 설명 |
|----|------|-------|-----|------|
| FR67 | 4 Core Tools MCP 통합 | Core | ADR-0011 | save, search, update, load_checkpoint |
| FR68 | 결정 저장 + Reasoning Graph | Core | ADR-0013 | supersedes, builds_on, debates, synthesizes |
| FR69 | 단일 DB + topic prefix | Core | ADR-0016 | voxel:*, furniture:* 등 도메인 구분 |
| FR70 | Outcome Tracking | Core | ADR-0011 | success/failed/partial 결과 추적 |
| FR71 | SessionStart Hook | Hook | ADR-0017 | 세션 시작 시 컨텍스트 자동 로드 |
| FR72 | Dynamic Hint Injection | Hook | ADR-0015 | Tool Definition에 DB 힌트 자동 주입 |
| FR73 | ActionHints (next_steps) | Hook | ADR-0014 | 도구 실행 후 다음 작업 제안 |
| FR74 | LLM-Agnostic Hook Owner | Hook | ADR-0018 | CADOrchestrator가 Hook 관리 |
| FR75 | Configurable Context | Intelligence | ADR-0017 | none/hint/full 모드 |
| FR76 | Adaptive Mentoring | Intelligence | ADR-0020 | 사용자 수준별 힌트 조절 |
| FR77 | Graph Health Metrics | Intelligence | ADR-0019 | 그래프 건강도 측정 |
| FR78 | Anti-Echo Chamber | Intelligence | ADR-0021 | 에코챔버 방지 경고 |
| FR81 | Learning Progress Storage | Learning | ADR-0025 | 배운 개념 저장, understanding_level 추적 |
| FR82 | User Growth Metrics | Learning | ADR-0025 | 독립 결정, 개념 적용, 트레이드오프 예측 |
| FR83 | DesignHints System | Learning | ADR-0025 | Human CoT 유도, 옵션 제시 |
| FR84 | Terminology Evolution | Learning | ADR-0025 | 용어 변화 추적 ("미니멀"→"Japandi") |
| FR85 | MCP 내부 통합 | Platform | - | npm install 시 MAMA 포함 |
| FR86 | 도메인 폴더 구조 | Platform | - | domains/ 폴더 기본 제공 |
| FR87 | LLM Adapter Pattern | Platform | ADR-0023 | Claude, OpenAI, Ollama 교체 가능 |

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
| NFR27 | MAMA 검색 응답 | < 100ms (로컬 DB) |
| NFR28 | 컨텍스트 주입 | SessionStart 시 자동 로드 |
| NFR29 | LLM-Agnostic | Claude, OpenAI, Ollama 교체 가능 |

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
| FR65-1 | 10.7 | 레거시 도구 제거 |
| NFR24 | 10.8 | AX 검증 (Read-first 패턴) |
| FR65-2 | 10.9 | discovery.ts 레거시 정리 |
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

## Epic 9: 웹 아키텍처 전환 ✅ 완료

**Status:** 완료 (2026-01-16)

### 핵심 결과

| 항목 | 성과 |
|------|------|
| 모노레포 | pnpm workspace (apps/viewer, apps/cad-mcp, packages/shared) |
| WebSocket | RTT p50 < 15ms, p95 < 50ms |
| 배포 | GitHub Pages + npm (@ai-native-cad/mcp) |
| Electron | 완전 제거 |

### FR Coverage

| FR | 설명 | 상태 |
|----|------|------|
| FR51-58 | 모노레포, WebSocket, MCP, 배포, 온보딩 | ✅ 완료 |

**상세**: [Architecture Part 2](architecture.md#part-2-web-architecture-epic-9--완료)

---

## Epic 10: AX 개선 - MCP 도구 재설계 ✅ 완료

**Status:** 완료 (2026-01-20)

### 핵심 결과

| 항목 | 성과 |
|------|------|
| 도구 분리 | cad_code → glob/read/edit/write/lsp/bash (6개) |
| Read-first | Description + 에러 반환으로 강제 |
| Progressive Disclosure | lsp domains → describe → schema |
| 레거시 제거 | cad_code, discovery, scene, export, module |

### FR Coverage

| FR | 설명 | 상태 |
|----|------|------|
| FR59-66 | 6개 분리 도구, 레거시 제거, HMR 실행 | ✅ 완료 |

**상세**: [Architecture Part 3](architecture.md#part-3-ax-improvement-epic-10--완료)

---

## Epic 11: MAMA Integration - 계획됨

> AI 파트너십 강화를 위한 Memory-Augmented Meta Agent 통합

### 목표

Claude가 자동화 도구가 아닌 **설계 마스터**로서, 인간과 함께 경험을 축적하며 성장하는 파트너가 된다.

**핵심 철학 (ADR-0010):**

| 잘못된 이해 | 올바른 이해 |
|------------|------------|
| MAMA = 메모리 시스템 | MAMA = **파트너십을 만드는 경험 축적 시스템** |
| 효율성이 목표 | **관계의 깊이**가 목표 |
| 매번 리셋 | 경험이 축적됨 |

### Definition of Done (DoD)

1. 4 Core Tools (save, search, update, load_checkpoint) MCP 통합
2. Hook System (onSessionInit, preToolList, postExecute) 동작
3. Reasoning Graph (supersedes, builds_on, debates, synthesizes) 구현
4. Configurable Context (none/hint/full) 동작
5. 기존 테스트 100% 통과
6. 검색 응답 < 100ms (1000개 결정 기준)

### FR Coverage Map (실제 구현 매핑)

| Phase | FR | Story | 설명 | 상태 |
|-------|-----|-------|------|------|
| Core | FR67 | 11.1 | 4 Core Tools MCP 통합 | ✅ |
| Core | FR68 | 11.2 | 결정 저장 + Reasoning Graph | ✅ |
| Core | FR69 | 11.3 | 단일 DB + topic prefix | ✅ |
| Core | FR70 | 11.4 | Outcome Tracking | ✅ |
| Hook | FR71 | 11.5 | SessionStart Hook | ✅ |
| Hook | FR72 | 11.6 | Dynamic Hint Injection | ✅ |
| Hook | FR73 | 11.7 | ActionHints (next_steps) | ✅ |
| Hook | FR74 | 11.8 | CADOrchestrator Hook Owner | ✅ |
| Intelligence | FR75 | 11.9 | Configurable Context | ✅ |
| Intelligence | FR76 | 11.10 | Adaptive Mentoring | ✅ |
| Intelligence | FR77 | 11.11 | Graph Health Metrics | ✅ |
| Intelligence | FR78 | 11.12 | Anti-Echo Chamber | ✅ |
| Learning | FR81 | 11.13 | Learning Progress Storage | ✅ |
| Learning | FR82 | 11.14 | User Growth Metrics | ✅ |
| Learning | FR83 | 11.15 | DesignHints System | ✅ |
| Learning | FR84 | 11.16 | Terminology Evolution | ✅ |
| Learning | - | 11.17 | Learning LLM Integration | ✅ |
| ~~Platform~~ | ~~FR87~~ | ~~11.18~~ | ~~LLM Adapter Pattern~~ | ❌ 제외 |
| Platform | FR80 | 11.19 | Module Library Recommendation | 📋 대기 |

> Note: FR85 (MCP 내부 통합)은 Story 11.1에서 이미 구현됨. FR86 (도메인 폴더 구조)은 미구현.
> **Story 11.18 제외 사유**: MCP 프로토콜이 이미 LLM-agnostic 인터페이스 제공. ADR-0023의 LLMAdapter 패턴은 Direct API 방식용으로 설계되었으나, 현재 MCP 기반 아키텍처에서는 클라이언트(Claude Code, Cursor 등)가 LLM 선택을 담당하므로 불필요.

### Implementation Phases

**배포 아키텍처**: MCP 서버 내부 통합 (별도 플러그인 X)

**MAMA MCP 도구 (LLM 호출용):**
| 도구 | MCP 이름 | 역할 |
|------|---------|------|
| mama_save | `mcp__ai-native-cad__mama_save` | 결정/체크포인트 저장 |
| mama_search | `mcp__ai-native-cad__mama_search` | 시맨틱 검색 |
| mama_update | `mcp__ai-native-cad__mama_update` | 결정 결과 업데이트 |
| mama_checkpoint | `mcp__ai-native-cad__mama_checkpoint` | 체크포인트 로드 |

#### Phase 11.1: Core (FR67-70) ✅ 완료

| Story | 제목 | FR | ADR | 상태 |
|-------|------|-----|-----|------|
| 11.1 | MAMA Core 4 Tools MCP 통합 | FR67 | ADR-0011 | ✅ |
| 11.2 | 결정 저장 + Reasoning Graph | FR68 | ADR-0013 | ✅ |
| 11.3 | 단일 DB + topic prefix 구조 | FR69 | ADR-0016 | ✅ |
| 11.4 | Outcome Tracking | FR70 | ADR-0011 | ✅ |

**품질 게이트**: ✅ mama_save/mama_search/mama_update/mama_load_checkpoint MCP 도구 동작, DB 스키마 완성

#### Phase 11.2: Hook System (FR71-74) ✅ 완료

| Story | 제목 | FR | ADR | 상태 |
|-------|------|-----|-----|------|
| 11.5 | SessionStart Hook (onSessionInit) | FR71 | ADR-0017 | ✅ |
| 11.6 | Dynamic Hint Injection (preToolList) | FR72 | ADR-0015 | ✅ |
| 11.7 | ActionHints (postExecute) | FR73 | ADR-0014 | ✅ |
| 11.8 | CADOrchestrator Hook Owner | FR74 | ADR-0018 | ✅ |

**품질 게이트**: ✅ Hook System 동작, MCP instructions 필드로 컨텍스트 자동 주입

```
Hook Flow:
[세션 시작] → onSessionInit → [도구 목록 요청] → preToolList → [도구 실행] → postExecute
                 │                    │                              │
                 ▼                    ▼                              ▼
           체크포인트 로드      Tool Definition에         next_steps,
           최근 결정 요약       DB 힌트 주입              module_hints 반환
```

#### Phase 11.3: Intelligence (FR75-78) ✅ 완료

| Story | 제목 | FR | ADR | 상태 |
|-------|------|-----|-----|------|
| 11.9 | Configurable Context | FR75 | ADR-0017 | ✅ |
| 11.10 | Adaptive Mentoring | FR76 | ADR-0020 | ✅ |
| 11.11 | Graph Health Metrics | FR77 | ADR-0019 | ✅ |
| 11.12 | Anti-Echo Chamber | FR78 | ADR-0021 | ✅ |

**품질 게이트**: ✅ none/hint/full 모드 동작, 90일 이상 결정 경고, debates < 10% 에코챔버 경고

#### Phase 11.4: Learning Track (FR81-84) ✅ 완료

> "만들고 싶은 것을 만들면서, 만드는 법을 배운다"

| Story | 제목 | FR | ADR | 상태 |
|-------|------|-----|-----|------|
| 11.13 | Learning Progress Storage | FR81 | ADR-0025 | ✅ |
| 11.14 | User Growth Metrics | FR82 | ADR-0025 | ✅ |
| 11.15 | DesignHints System | FR83 | ADR-0025 | ✅ |
| 11.16 | Terminology Evolution | FR84 | ADR-0025 | ✅ |
| 11.17 | Learning LLM Integration | - | ADR-0025 | ✅ |

**품질 게이트**: ✅ 개념 학습 기록, 성장 지표 추적, Human CoT 유도 동작, type='understood'/'applied' 지원

#### Phase 11.5: Platform (FR80, FR85-86) ⏸️ 부분 완료

| Story | 제목 | FR | ADR | 상태 |
|-------|------|-----|-----|------|
| (11.1) | MCP 내부 통합 | FR85 | - | ✅ (Phase 11.1에서 완료) |
| - | 도메인 폴더 구조 | FR86 | - | 📋 대기 |
| ~~11.18~~ | ~~LLM Adapter Pattern~~ | ~~FR87~~ | ~~ADR-0023~~ | ❌ 제외 |
| 11.19 | Module Library Recommendation | FR80 | ADR-0024 | 📋 대기 |

**Story 11.18 제외 사유**: MCP 프로토콜 기반 아키텍처에서 LLM 선택은 클라이언트 레벨에서 처리됨. LLMAdapter 패턴은 Direct API 방식용으로 설계되어 현재 아키텍처에 불필요.

**품질 게이트**: FR85 완료 (MCP 통합). FR80, FR86 대기. FR87 MCP로 대체됨.

### 성공 기준

| 지표 | 목표 |
|------|------|
| **파트너십 형성** | 30일 후 "이 AI는 나를 안다" 체감 |
| **세션 연속성** | 이전 결정을 자동으로 기억 |
| **건강한 관계** | debates >= 10%, 외부 증거 포함 |
| **사용자 성장** | 30일 후 독립 결정 비율 70%+ |
| **개념 적용** | 배운 개념 재적용률 50%+ |
| **검색 응답** | < 100ms (로컬 DB) |
| **Hook 실행** | < 10ms (동기화 작업) |

### 상세 설계

architecture.md Part 4 참조

---

### Story 11.1.1: MAMA Core 4 Tools MCP 통합

As a **LLM 에이전트**,
I want **MAMA Core 4 Tools가 MCP로 통합되기를**,
So that **설계 결정을 저장하고 검색할 수 있다** (FR67).

**Acceptance Criteria:**

**Given** MCP 서버가 시작될 때
**When** MAMA 모듈이 초기화되면
**Then** 4개 도구 (save, search, update, load_checkpoint)가 MCP에 등록된다

**Given** save 도구를 호출할 때
**When** type='decision', topic, decision, reasoning을 전달하면
**Then** 결정이 DB에 저장되고 ID가 반환된다

**Given** search 도구를 호출할 때
**When** query를 전달하면
**Then** 시맨틱 검색 결과가 유사도 순으로 반환된다
**And** query가 없으면 최근 항목이 시간순으로 반환된다

**Given** update 도구를 호출할 때
**When** id와 outcome(success/failed/partial)을 전달하면
**Then** 해당 결정의 outcome이 업데이트된다

**Given** load_checkpoint 도구를 호출할 때
**When** 이전 체크포인트가 존재하면
**Then** summary, next_steps, open_files가 반환된다

**Technical Notes:**
- 기존 MAMA v1.5.0 코드 재사용
- MCP 서버 내부 통합 (별도 플러그인 X)
- ADR-0011 참조

---

### Story 11.1.2: 결정 저장 + Reasoning Graph

As a **LLM 에이전트**,
I want **결정 간의 관계를 그래프로 표현하기를**,
So that **지식의 진화를 추적할 수 있다** (FR68).

**Acceptance Criteria:**

**Given** 같은 topic으로 새 결정을 저장할 때
**When** 이전 결정이 존재하면
**Then** 자동으로 `supersedes` 관계가 생성된다

**Given** reasoning에 `builds_on: decision_xxx`가 있을 때
**When** 결정이 저장되면
**Then** `builds_on` 관계가 파싱되어 저장된다

**Given** reasoning에 `debates: decision_xxx`가 있을 때
**When** 결정이 저장되면
**Then** `debates` 관계가 파싱되어 저장된다

**Given** reasoning에 `synthesizes: [id1, id2]`가 있을 때
**When** 결정이 저장되면
**Then** 여러 결정과의 `synthesizes` 관계가 저장된다

**Technical Notes:**
- decision_edges 테이블로 관계 저장
- reasoning 필드 패턴 파싱
- ADR-0013 참조

---

### Story 11.1.3: 단일 DB + topic prefix 구조

As a **개발자**,
I want **단일 DB에 topic prefix로 도메인을 구분하기를**,
So that **크로스 도메인 검색이 용이하다** (FR69).

**Acceptance Criteria:**

**Given** ~/.ai-native-cad/data/mama.db가 없을 때
**When** MCP 서버가 시작되면
**Then** SQLite DB가 자동 생성된다

**Given** 결정을 저장할 때
**When** topic이 'voxel:chicken:color'이면
**Then** voxel 도메인으로 분류된다

**Given** 다른 도메인의 결정을 검색할 때
**When** 가구 설계 시 인테리어 결정을 참조하면
**Then** 크로스 도메인 검색이 가능하다

**Technical Notes:**
- Topic Prefix 규칙: `{domain}:{entity}:{aspect}`
- 예: `voxel:chicken:color_palette`, `furniture:chair:dimensions`
- ADR-0016 참조

---

### Story 11.1.4: Outcome Tracking

As a **LLM 에이전트**,
I want **결정의 성공/실패를 추적하기를**,
So that **실패한 접근법을 피할 수 있다** (FR70).

**Acceptance Criteria:**

**Given** 결정이 저장된 후 실제 작업을 수행했을 때
**When** 성공적으로 동작하면
**Then** `update(id, 'success', 'reason')`으로 기록한다

**Given** 결정이 저장된 후 문제가 발생했을 때
**When** 실패했으면
**Then** `update(id, 'failed', 'reason')`으로 기록한다

**Given** 검색 시
**When** 이전에 실패한 결정이 있으면
**Then** ⚠️ outcome: failed 표시와 함께 반환된다

**Technical Notes:**
- outcome: 'success' | 'failed' | 'partial' | NULL (pending)
- 실패 이유도 함께 저장
- ADR-0011 참조

---

### Story 11.2.1: SessionStart Hook (onSessionInit)

As a **LLM 에이전트**,
I want **세션 시작 시 자동으로 컨텍스트가 로드되기를**,
So that **이전 작업을 이어서 할 수 있다** (FR71).

**Acceptance Criteria:**

**Given** MCP 연결이 시작될 때
**When** onSessionInit Hook이 실행되면
**Then** 마지막 체크포인트가 자동 로드된다
**And** 최근 결정 5개가 요약되어 제공된다

**Given** contextInjection 설정이 'full'일 때
**When** 컨텍스트가 주입되면
**Then** 결정 전체 내용 + reasoning이 포함된다

**Given** contextInjection 설정이 'hint'일 때
**When** 컨텍스트가 주입되면
**Then** "🔍 3 related decisions found" 한 줄만 제공된다

**Given** contextInjection 설정이 'none'일 때
**When** 세션이 시작되면
**Then** 자동 주입 없이 Claude가 직접 search() 호출해야 한다

**Technical Notes:**
- HookRegistry.onSessionInit() 구현
- ADR-0017 참조

---

### Story 11.2.2: Dynamic Hint Injection (preToolList)

As a **LLM 에이전트**,
I want **Tool Definition에 DB 힌트가 자동 주입되기를**,
So that **몰랐던 규칙도 자연스럽게 적용한다** (FR72).

**Acceptance Criteria:**

**Given** tools/list 요청이 들어올 때
**When** preToolList Hook이 실행되면
**Then** 각 도구별로 DB에서 힌트가 조회된다
**And** 기본 description + 동적 힌트가 조합된다

**Given** hints 테이블에 'edit' 도구에 대한 힌트가 있을 때
**When** 도구 목록이 반환되면
**Then** edit 도구의 description에 "💡 rect의 x,y는 CENTER 좌표입니다" 포함

**Given** 힌트가 없는 도구일 때
**When** 도구 목록이 반환되면
**Then** 기본 description만 포함된다

**Technical Notes:**
- 핵심 통찰: Claude가 "이 힌트가 필요해"라고 알면 이미 알고 있는 것
- Tool Definition 자체에 힌트 자동 주입
- ADR-0015 참조

---

### Story 11.2.3: ActionHints (postExecute)

As a **LLM 에이전트**,
I want **도구 실행 후 다음 작업 제안을 받기를**,
So that **워크플로우가 자연스럽게 진행된다** (FR73).

**Acceptance Criteria:**

**Given** edit/write 도구 실행이 완료될 때
**When** postExecute Hook이 실행되면
**Then** actionHints가 결과에 포함된다:
  - next_steps: 다음 작업 제안
  - module_hints: 관련 모듈 추천
  - save_suggestion: 결정 저장 제안

**Given** 방(room)을 생성한 후
**When** 결과가 반환되면
**Then** next_steps에 "add_door: 문 배치하기 (방이 생성되었으니 출입구 필요)" 포함

**Given** 중요한 패턴이 발견되었을 때
**When** 결과가 반환되면
**Then** save_suggestion에 저장 제안이 포함된다

**Technical Notes:**
- HookRegistry.postExecute() 구현
- ADR-0014 참조

---

### Story 11.2.4: CADOrchestrator Hook Owner

As a **개발자**,
I want **CADOrchestrator가 Hook을 관리하기를**,
So that **모든 LLM에서 동일하게 동작한다** (FR74).

**Acceptance Criteria:**

**Given** Claude Code로 CAD를 사용할 때
**When** Hook이 실행되면
**Then** 동일한 방식으로 컨텍스트가 주입된다

**Given** Ollama로 CAD를 사용할 때
**When** Hook이 실행되면
**Then** Claude와 동일한 방식으로 컨텍스트가 주입된다

**Given** MCP 요청을 처리할 때
**When** CADOrchestrator.handleMCPRequest()가 호출되면
**Then** 요청 유형에 따라 적절한 Hook이 실행된다

**Technical Notes:**
- CADOrchestrator 클래스가 HookRegistry 관리
- LLM과 독립적인 Hook 실행
- ADR-0018 참조

---

### Story 11.3.1: Configurable Context

As a **사용자**,
I want **컨텍스트 주입 수준을 설정할 수 있기를**,
So that **토큰 사용량을 조절할 수 있다** (FR75).

**Acceptance Criteria:**

**Given** config.json에 contextInjection: 'none'이 설정되었을 때
**When** 세션이 시작되면
**Then** 자동 주입이 비활성화된다

**Given** config.json에 contextInjection: 'hint'가 설정되었을 때
**When** 세션이 시작되면
**Then** 한 줄 힌트만 주입된다

**Given** config.json에 contextInjection: 'full'이 설정되었을 때
**When** 세션이 시작되면
**Then** 전체 결정 내용이 주입된다

**Technical Notes:**
- ~/.ai-native-cad/config.json에서 설정
- 숙련자: 'none', 초보자: 'full' 권장
- ADR-0017 참조

---

### Story 11.3.2: Adaptive Mentoring

As a **사용자**,
I want **내 수준에 맞는 힌트를 받기를**,
So that **점진적으로 학습할 수 있다** (FR76).

**Acceptance Criteria:**

**Given** 초보자 모드일 때
**When** ActionHints가 생성되면
**Then** 상세한 설명과 예시가 포함된다

**Given** 숙련자 모드일 때
**When** ActionHints가 생성되면
**Then** 간결한 키워드만 포함된다

**Given** 사용자가 특정 패턴을 여러 번 사용했을 때
**When** 동일한 힌트가 반복되면
**Then** 힌트 우선순위가 낮아진다

**Technical Notes:**
- 사용 패턴 추적으로 수준 자동 감지
- ADR-0020 참조

---

### Story 11.3.3: Graph Health Metrics

As a **개발자**,
I want **Reasoning Graph의 건강도를 측정하기를**,
So that **지식 품질을 모니터링할 수 있다** (FR77).

**Acceptance Criteria:**

**Given** 결정 그래프가 있을 때
**When** 건강도를 측정하면
**Then** 다음 지표가 계산된다:
  - 총 결정 수
  - 관계 유형별 비율 (supersedes, builds_on, debates, synthesizes)
  - 고아 결정 비율 (관계 없는 결정)

**Given** debates 비율이 10% 미만일 때
**When** 건강도가 평가되면
**Then** "에코챔버 위험" 경고가 발생한다

**Technical Notes:**
- 정기적인 건강도 체크 (세션 시작 시)
- ADR-0019 참조

---

### Story 11.3.4: Anti-Echo Chamber

As a **LLM 에이전트**,
I want **에코챔버 위험이 경고되기를**,
So that **다양한 관점을 유지한다** (FR78).

**Acceptance Criteria:**

**Given** 최근 결정들이 모두 동일한 방향일 때
**When** 새 결정을 저장하려 하면
**Then** "⚠️ 최근 결정들이 비슷합니다. 대안을 고려해보세요." 경고

**Given** 90일 이상 된 결정이 있을 때
**When** 검색 결과에 포함되면
**Then** "⚠️ 오래된 결정입니다. 여전히 유효한지 확인하세요." 경고

**Given** 외부 증거 없이 결정을 저장하려 할 때
**When** reasoning에 테스트/벤치마크 언급이 없으면
**Then** "💡 증거를 추가하면 결정이 더 강해집니다." 제안

**Technical Notes:**
- Level 2 (Warning) 상호작용 원칙
- ADR-0021 참조

---

## Phase 11.4: Learning Track Stories

### Story 11.4.1: Learning Progress Storage

As a **LLM 에이전트**,
I want **사용자가 배운 개념을 저장하기를**,
So that **성장 여정을 추적할 수 있다** (FR81).

**Acceptance Criteria:**

**Given** 사용자에게 새로운 개념(60-30-10 법칙)을 소개할 때
**When** 사용자가 이해를 표현하면 ("아, 그래서 넓어 보이는 거구나")
**Then** learnings 테이블에 concept='60-30-10', understanding_level=2로 저장된다

**Given** 사용자가 배운 개념을 직접 적용할 때
**When** "우드톤 30% 정도로 할게요"라고 말하면
**Then** applied_count가 증가하고 understanding_level이 3으로 업데이트된다

**Given** 다음 세션에서 같은 개념이 관련될 때
**When** 색상 관련 작업을 시작하면
**Then** "💡 지은님은 60-30-10 법칙을 알고 계세요 (2번 적용)"가 주입된다

**Technical Notes:**
- understanding_level: 1(소개됨) → 2(이해함) → 3(적용함) → 4(숙달)
- 숙달 = 3번 이상 독립적으로 적용
- ADR-0025 참조

---

### Story 11.4.2: User Growth Metrics

As a **시스템**,
I want **사용자의 성장 지표를 자동 추적하기를**,
So that **멘토링 수준을 조절할 수 있다** (FR82).

**Acceptance Criteria:**

**Given** 사용자가 AI 제안 없이 결정을 내릴 때
**When** "침대는 계단에서 안 보이는 곳에 놓을게 (동선 때문에)"라고 말하면
**Then** growth_metrics에 type='independent_decision', related_learning_id 기록
> **매핑 기준**: "동선" 키워드가 learnings 테이블의 concept과 일치하면 해당 learning.id 연결

**Given** 사용자가 트레이드오프를 먼저 언급할 때
**When** "나무 난간으로 바꾸면 개방감이 줄어들겠지?"라고 말하면
**Then** growth_metrics에 type='tradeoff_predicted' 기록

**Given** 30일 후 성장 리포트를 생성할 때
**When** 체크포인트를 저장하면
**Then** 독립 결정 비율, 개념 적용 횟수가 요약된다

**Technical Notes:**
- metric_type: 'independent_decision', 'concept_applied', 'tradeoff_predicted', 'terminology_used'
- Adaptive Mentoring과 연동: 성장 지표에 따라 힌트 수준 조절
- ADR-0025 참조

---

### Story 11.4.3: DesignHints System

As a **LLM 에이전트**,
I want **DesignHints로 Human CoT를 유도하기를**,
So that **사용자가 스스로 생각하며 배운다** (FR83).

**Acceptance Criteria:**

**Given** 사용자가 "미니멀하게 해줘"라고 말할 때
**When** AI가 응답하면
**Then** 바로 만들지 않고 스타일 옵션을 제시한다:
  - "Japandi: 따뜻한 나무톤, 자연 소재"
  - "Bauhaus: 기하학적, 기능 중심"
  - "Muji: 극도로 절제된, 무채색"

**Given** 사용자가 선택을 하면
**When** 선택 이유를 설명하면 ("Japandi가 내 취향이었구나")
**Then** 학습 기록에 "사용자가 자신의 취향에 이름을 붙임"으로 저장된다

**Given** DesignHints 템플릿이 정의되어 있을 때
**When** 도구 실행 결과가 반환되면
**Then** design_hints 필드가 포함된다:
  - next_concepts: 다음에 배울 개념
  - questions: 사용자 생각을 유도하는 질문
  - options: 선택지와 트레이드오프

**Technical Notes:**
- DesignHints는 ActionHints의 UX 버전 (AX-UX 대칭)
- Human CoT 원칙: 바로 만들지 않고, 왜 그런지 설명, 선택하게 함
- ADR-0025 참조

---

### Story 11.4.4: Terminology Evolution

As a **시스템**,
I want **사용자의 언어 변화를 추적하기를**,
So that **성장을 가시화할 수 있다** (FR84).

**Acceptance Criteria:**

**Given** 초기에 사용자가 "미니멀하게"라고 말했을 때
**When** 나중에 "Japandi 스타일로"라고 표현하면
**Then** terminology_evolution에 before='미니멀하게', after='Japandi 스타일로' 기록

**Given** 초기에 "색감 어떻게?"라고 물었을 때
**When** 나중에 "60-30-10 비율 맞춰서"라고 표현하면
**Then** 관련 learning_id와 함께 기록된다

**Given** 30일 성장 리포트를 생성할 때
**When** 언어 변화가 있으면
**Then** "💬 언어의 변화" 섹션에 before→after 목록이 포함된다

**Technical Notes:**
- 자동 감지: 같은 의미의 더 전문적인 용어 사용 시
- 학습과 연결: 어떤 개념 학습 후 용어가 바뀌었는지 추적
- ADR-0025 참조

---

## Phase 11.5: Platform Stories

### Story 11.5.1: MCP 내부 통합

As a **개발자**,
I want **MAMA가 MCP 서버에 내장되기를**,
So that **별도 설치 없이 사용할 수 있다** (FR85).

**Acceptance Criteria:**

**Given** npm install @ai-native-cad/mcp를 실행할 때
**When** 패키지가 설치되면
**Then** MAMA 모듈이 함께 포함된다

**Given** MCP 서버를 시작할 때
**When** MAMA DB가 없으면
**Then** ~/.ai-native-cad/data/mama.db가 자동 생성된다

**Technical Notes:**
- MAMA 코드를 MCP 패키지에 번들
- SQLite + better-sqlite3
- ADR-0011 참조

---

### Story 11.5.2: 도메인 폴더 구조

As a **개발자**,
I want **도메인별 지식이 폴더로 제공되기를**,
So that **도메인 확장이 용이하다** (FR86).

**Acceptance Criteria:**

**Given** MCP 서버가 시작될 때
**When** domains/ 폴더를 확인하면
**Then** voxel/, furniture/, interior/ 기본 제공

**Given** 새 도메인을 추가할 때
**When** domains/jewelry/를 만들면
**Then** DOMAIN.md, workflows/, rules/, functions/ 구조 따름

**Technical Notes:**
- 도메인 지식은 읽기 전용
- MCP 패키지에 포함
- ADR-0016 참조

---

### Story 11.5.3: LLM Adapter Pattern

As a **개발자**,
I want **LLMAdapter 인터페이스로 LLM을 교체할 수 있기를**,
So that **Claude 외 LLM도 사용할 수 있다** (FR87).

**Acceptance Criteria:**

**Given** LLMAdapter 인터페이스가 정의되었을 때
**When** ClaudeAdapter를 구현하면
**Then** Claude API로 chat, toolCalling이 동작한다

**Given** OllamaAdapter를 구현했을 때
**When** 로컬 Ollama 서버에 연결하면
**Then** 로컬 LLM으로 CAD 작업이 가능하다

**Technical Notes:**
- LLMAdapter 인터페이스: chat(), supportsStreaming(), supportsToolCalling()
- ADR-0023 참조 (PoC 검증 완료)

---

### ADR Reference Table

| ADR | 제목 | 핵심 결정 |
|-----|------|----------|
| [ADR-0010](./adr/0010-partnership-philosophy.md) | Partnership Philosophy | MAMA = 파트너십을 만드는 경험 축적 시스템 |
| [ADR-0011](./adr/0011-mama-core-reuse.md) | MAMA Core 4 Tools | save, search, update, load_checkpoint |
| [ADR-0012](./adr/0012-persuader-pattern.md) | Persuader Pattern | 강제가 아닌 넛징으로 LLM 행동 유도 |
| [ADR-0013](./adr/0013-edge-types-reasoning.md) | Edge Types | reasoning 필드에 관계 패턴 표현 |
| [ADR-0014](./adr/0014-progressive-workflow.md) | Progressive Workflow | next_steps로 다음 작업 제안 |
| [ADR-0015](./adr/0015-dynamic-hint-injection.md) | Dynamic Hint Injection | Tool Definition에 DB 힌트 자동 주입 |
| [ADR-0016](./adr/0016-project-specific-db.md) | Single DB + Topic Prefix | 단일 DB, topic prefix로 도메인 구분 |
| [ADR-0017](./adr/0017-configurable-context.md) | Configurable Context | none/hint/full 모드 |
| [ADR-0018](./adr/0018-llm-agnostic-hooks.md) | LLM-Agnostic Hooks | CADOrchestrator가 Hook Owner |
| [ADR-0019](./adr/0019-graph-health-metrics.md) | Graph Health Metrics | 그래프 건강도 측정 |
| [ADR-0020](./adr/0020-adaptive-mentoring.md) | Adaptive Mentoring | 사용자 수준별 힌트 조절 |
| [ADR-0021](./adr/0021-anti-echo-chamber.md) | Anti-Echo Chamber | 에코챔버 방지 경고 |
| [ADR-0023](./adr/0023-llm-agnostic-agent-architecture.md) | LLM-Agnostic Agent | LLMAdapter 패턴 |
| [ADR-0024](./adr/0024-module-library-recommendation.md) | Module Library | 시맨틱 모듈 추천 |
| [ADR-0025](./adr/0025-learning-track.md) | Learning Track | 사용자 성장 추적, Human CoT 유도 |

---

## 관련 문서

- [PRD](./prd.md) - 제품 요구사항
- [Architecture](./architecture.md) - 기술 아키텍처
- [UX Design Specification](./ux-design-specification.md) - UX 설계
- [ADR-008](./adr/008-tool-pattern-alignment.md) - MCP 도구 패턴 정렬
