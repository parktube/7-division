# RFC: WebMCP Integration (Viewer)

Status: Draft (Design Only)

Last Updated: 2026-02-15

## 요약

Chrome WebMCP(early preview) 표준을 `apps/viewer`에 도입해, 에이전틱 브라우저가 **화면 스크래핑 없이** Viewer의 기능을 구조화된 "도구(tool)"로 발견/호출할 수 있도록 합니다.

핵심은 Viewer가 브라우저 내에서 `window.navigator.modelContext.registerTool()` / `provideContext()`로 도구를 등록하고, 도구 실행 시 Viewer의 UI 상태를 조회/조작하거나(읽기/선택/뷰포트 등) 필요한 경우 Local MCP(`apps/cad-mcp`)와의 연결 상태에 따라 제한적으로 동작하도록 하는 것입니다.

## 배경

현재 `7-division`은 **Web + Local MCP** 아키텍처(ADR-007)를 채택하고 있습니다.

- Viewer: `apps/viewer` (React/Vite) - 렌더링/상태 표현
- Local MCP: `apps/cad-mcp` - stdio(MCP) + WebSocket(Viewer sync)

WebMCP는 MCP와 유사한 목적(도구를 구조화해 에이전트가 호출)을 가지지만, **서버 프로토콜이 아니라 브라우저 내 표준 API**로 제공되는 점이 다릅니다.

## 목표

- 에이전틱 브라우저(Chrome 146+ WebMCP flag)에서 Viewer가 제공하는 도구 목록을 표준 방식으로 **발견(discovery)** 가능하게 한다.
- Viewer의 핵심 사용자 플로우 중 일부를 도구로 노출해, "스크린 스크래핑" 기반의 취약한 자동화를 줄인다.
- 보안/오용 리스크를 최소화하기 위해 **기본은 읽기 전용 + 명시적 사용자 opt-in**으로 설계한다.

## 비목표 (Non-Goals)

- Headless 환경(브라우저 UI 없는 호출) 지원: WebMCP 자체 제한으로 범위 밖.
- `apps/cad-mcp`를 WebMCP로 완전히 대체: Viewer는 계속 Web + Local MCP 아키텍처를 유지.
- 초기 단계에서 파괴적/고위험 작업(파일 쓰기/외부 실행/대량 변경)을 자동 실행(toolautosubmit)로 제공.

## 요구사항 / 제약

- Chrome 146.0.7672.0+ 및 `chrome://flags/#enable-webmcp-testing` 활성화 필요 (early preview).
- WebMCP API 존재 여부는 런타임에서만 판단 가능:
  - `window.navigator.modelContext.registerTool`
  - `window.navigator.modelContext.provideContext`
- 도구는 브라우저 탭/웹뷰 컨텍스트에서만 실행된다.

## 설계 개요

### 1) 등록 방식: Imperative 우선

Viewer는 폼 중심 앱이 아니라 UI/상태 기반이므로, 초기에는 Imperative API로 등록합니다.

- `registerTool()`로 개별 도구 추가
- `provideContext()`로 상태 변화(예: 연결 상태, read-only 모드)에 따라 도구 목록을 교체
- `clearContext()`로 비활성화

Declarative API(`<form toolname=...>`)는 "사용자 확인이 필요한 작업"에 한해 **후속 단계에서 선택적으로** 도입합니다.

### 2) 안전장치: opt-in 토글 + read-only 기본

WebMCP는 브라우저 에이전트가 도구를 호출할 수 있게 하므로, Viewer에서 기본 비활성화로 시작합니다.

- UI에 `WebMCP 도구 노출` 토글을 추가(초기값 OFF)
- 토글 ON + WebMCP API 존재 시에만 도구 등록
- Viewer가 `isReadOnly` 상태(버전 불일치 등)라면 변경 도구 등록을 제한

### 3) 도구 전략: Atomic + Composable

WebMCP 권장사항에 맞춰 도구는:

- 서로 중복되지 않게 쪼개고
- 입력 스키마는 단순/명확하게
- 실패 시 오류를 명시적으로 반환(모델이 재시도/수정 가능하도록)

## 제안 도구 (초기 범위)

초기에는 "안전한 읽기/조회" 중심으로 최소 세트부터 시작합니다.

### Tool 1: `viewer.get_status`

- 목적: 연결/버전/모드 상태를 반환
- 입력: 없음
- 출력 예:
  - connectionState: `connected|connecting|disconnected`
  - mcpVersion / viewerVersion / versionStatus
  - readOnly 여부

### Tool 2: `viewer.get_scene_summary`

- 목적: 현재 씬의 요약(엔티티 수, 마지막 작업 등)
- 입력: `{ detailLevel: "short"|"full" }`
- 출력: 텍스트 + 요약 JSON(가능하면)

### Tool 3: `viewer.get_selection`

- 목적: 현재 선택된 엔티티 ID 목록 반환
- 입력: 없음
- 출력: `selectedIds: string[]`

### Tool 4 (선택): `viewer.select_entities`

- 목적: 특정 엔티티를 선택(저위험 UI 조작)
- 입력: `{ ids: string[], mode: "replace"|"add" }`
- 가드:
  - `isReadOnly`여도 허용(씬 변경이 아니라 UI 선택만)
  - ids가 존재하지 않으면 오류 반환

후속(Phase 2+)에서는 뷰포트 조작(`viewer.set_viewport`) 등으로 확장합니다.

## 구현 계획

### Phase 0: 설계/가드(이번 PR 범위)

- 문서(ADR/RFC) 추가
- Viewer에 WebMCP 모듈 위치/구조 합의
- 초기 도구 목록/스키마 합의

### Phase 1: Viewer에 안전한 도구 등록(최소 기능)

- `apps/viewer/src/webmcp/` 모듈 추가
- `registerWebMcpTools()` 구현
- App 시작 시(또는 토글 ON 시) WebMCP API 존재 여부 확인 후 등록
- 도구 실행은 Viewer의 내부 state/UI 컨텍스트를 사용

### Phase 2: 사용자 확인이 필요한 작업은 Declarative 폼으로 분리

- `<form toolname=...>` 기반의 "사용자 클릭 제출" 플로우 적용(기본)
- `SubmitEvent.agentInvoked` + `respondWith()`로 결과를 구조화해서 반환

### Phase 3: Local MCP와의 연동(선택)

현재 `apps/cad-mcp` WebSocket은 Viewer→Server 명령 요청을 지원하지 않습니다.

필요 시:

- 신규 WS 메시지 타입(예: `command_request`) 설계
- `apps/cad-mcp/src/ws-server.ts`에서 origin/토큰 기반 검증 + rate limit
- Viewer WebMCP 도구가 WS로 "요청"을 보내고, 결과를 UI와 함께 반환

## 보안 고려사항

- WebMCP 도구는 브라우저 에이전트에 의해 호출될 수 있으므로, 기본 OFF + 사용자 opt-in이 필수입니다.
- 파괴적 작업은 Imperative로 즉시 실행하지 않고:
  - Declarative 폼(기본 수동 submit)으로 노출하거나
  - 별도 "승인 모달"을 거치게 합니다.
- Local MCP와 연동하는 경우:
  - localhost-only 원칙 유지
  - 연결 요청에 토큰/세션 기반 검증 추가
  - 도구 호출 빈도 제한(DoS 방지)

## 테스트/검증

- 수동 검증(Chrome 146+ + WebMCP flag + Model Context Tool Inspector 확장):
  - 도구 목록 노출 확인
  - 각 도구 입력 스키마/설명 확인
  - 도구 실행 결과 확인
- 자동 테스트(단위):
  - WebMCP API가 없는 환경에서 안전하게 no-op 되는지
  - 도구 입력 검증(zod) 및 오류 메시지 품질

## 오픈 이슈

- Viewer에서 WebMCP opt-in 토글 UX 위치: Onboarding vs StatusBar vs TopBar
- 도구 결과 포맷 표준화: `content: [{type:"text", text:"..."}]` 스타일로 통일할지 여부
- Phase 3에서 Local MCP 연동 시 인증 방식(토큰 vs origin + 사용자 승인)

## 참고

- `media/inbound/WebMCP_Early_Preview.pdf` (Chrome WebMCP Early Preview, Updated Feb 10, 2026)
- `docs/adr/007-web-architecture.md` (Web + Local MCP)

