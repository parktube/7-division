# ADR-007: Web + MCP Architecture

## Status

Accepted

## Date

2026-01-14

## Context

Epic 6에서 Electron 앱을 구현했으나, 다음과 같은 문제가 발생했습니다:

1. **유지보수 부담**: Windows/Mac 두 플랫폼 빌드 및 배포 관리
2. **업데이트 어려움**: 앱 재배포 + 사용자 재설치 필요
3. **온보딩 시간**: 다운로드 → 설치 → 실행까지 5분 이상
4. **개발 속도**: electron-vite 빌드 시간으로 인한 개발 지연

## Decision

Electron을 제거하고 **Web + Local MCP** 아키텍처를 채택합니다.

### 핵심 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 통신 | WebSocket | 파일 폴링(500ms) 대비 30배 빠름 (p50 < 15ms) |
| 배포 | GitHub Pages + npm | 앱 설치 없이 즉시 시작 가능 |
| 보안 | localhost-only (127.0.0.1) | 로컬 개발 도구, 원격 접근 불필요 |
| MCP | stdio + WebSocket 듀얼 | Claude Code + Viewer 동시 지원 |

### 아키텍처

```
Claude Code ──stdio──▶ MCP Server ──WebSocket──▶ Viewer (Web)
                           │
                      WASM Engine
                      File System
```

### 제거 대상

- `cad-electron/` 디렉토리 전체

## Consequences

### 장점

- **배포 단순화**: GitHub Pages 배포만으로 Viewer 업데이트
- **온보딩 1분 이내**: `npx @ai-native-cad/mcp start` 한 줄로 시작
- **개발 속도 향상**: Vite HMR로 빠른 개발 사이클
- **유지보수 감소**: 웹 브라우저 하나만 지원

### 단점

- **Node.js 필요**: MCP 서버 실행을 위해 Node.js 설치 필요
- **WebSocket 의존**: 네트워크 상태에 따른 연결 불안정 가능
- **버전 동기화**: MCP와 Viewer 간 버전 호환성 관리 필요

### 영향을 받는 ADR

- **ADR-003 (Claude Code 통합)**: 파일 폴링 → WebSocket으로 변경
- **ADR-004 (LLM Scene 이해)**: 동일 (WebSocket으로 데이터 전달 방식만 변경)

## Related Documents

- [Architecture (Part 2)](../architecture.md) - 상세 구현 명세
- [Epics (Epic 9)](../epics.md) - 구현 계획

---

_ADR-007 - Web + MCP Architecture_
