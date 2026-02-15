# ADR-009: WebMCP Integration (Viewer Tools for Agentic Browsers)

## Status

Proposed

## Date

2026-02-15

## Context

현재 Viewer(`apps/viewer`)는 WebSocket을 통해 Local MCP(`apps/cad-mcp`)와 상태를 동기화하며, MCP 자체는 서버/호스트(Claude Code 등) 연동을 위한 프로토콜로 사용합니다(ADR-007).

하지만 에이전틱 브라우저가 Viewer를 자동화할 때, UI 스크린 스크래핑 기반으로 버튼/폼을 추측하는 방식은:

- 깨지기 쉽고(레이아웃/DOM 변화)
- 느리고(추측/재시도)
- 사용자 경험이 불안정합니다.

Chrome WebMCP(early preview)는 웹앱이 브라우저에 "도구"를 구조화하여 노출할 수 있는 표준 API를 제안합니다.

## Decision

Viewer에 WebMCP를 **옵트인(opt-in)** 방식으로 도입합니다.

- 기본값: OFF (사용자 명시적 활성화 전까지 도구 미등록)
- 초기 범위: 안전한 읽기/조회 도구 위주 + 저위험 UI 조작(선택 등)
- 고위험/파괴적 작업:
  - Imperative 즉시 실행 도구로 노출하지 않고
  - Declarative 폼(기본 수동 submit) 또는 별도 승인 UX로 제한
- Local MCP(`apps/cad-mcp`)를 WebMCP로 대체하지 않으며, 기존 Web + Local MCP 아키텍처를 유지한다.

## Consequences

### Positive

- 에이전틱 브라우저 자동화의 안정성/성능 향상(스크린 스크래핑 감소)
- Viewer 기능을 "명세(스키마)"로 노출해 도구 오용/환각 감소 기대
- Phase 3에서 필요 시 Local MCP와의 안전한 연동 경로를 열어둠

### Negative

- Chrome early preview 의존(플래그/버전 제약)
- 도구 노출은 잠재적 오용 표면을 넓힘(따라서 opt-in/가드가 필수)
- Viewer 내부 상태/컨텍스트를 도구로 매핑하는 유지보수 비용 발생

### Neutral

- Declarative API는 "사용자 승인"에 유리하나 Viewer 구조상 Imperative가 기본이므로 혼합 전략이 필요

## Alternatives Considered

### Option A: 기존 MCP만 유지 (WebMCP 미도입)

- 장점: 표면적 단순
- 단점: 브라우저 에이전트 자동화는 계속 스크린 스크래핑에 의존

### Option B: Viewer에 서버형 MCP(원격/웹) 추가

- 장점: 표준 MCP로 통일
- 단점: 배포/보안/운영 복잡도 증가, 브라우저 내 상호작용 UX 이점 감소

### Option C: Viewer에 직접 WASM 엔진 탑재(브라우저 내 직접 실행)

- 장점: 브라우저 단독 동작 가능
- 단점: ADR-007의 결정(로컬 MCP에 WASM 위치)과 충돌, FS/성능/배포 이슈 재발

## References

- WebMCP Early Preview (Updated 2026-02-10) - `media/inbound/WebMCP_Early_Preview.pdf`
- ADR-007: Web + MCP Architecture - `docs/adr/007-web-architecture.md`
- RFC: WebMCP Integration (Viewer) - `docs/rfc/webmcp-integration.md`

