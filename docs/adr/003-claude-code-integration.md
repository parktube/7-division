# ADR-003: Claude Code Integration

**상태**: 완료

## Context

독립 실행 가능한 데스크톱 앱 필요. 채팅 UI 구현 비용 검토.

**MCP-less 선택**: MCP(Model Context Protocol)는 Claude Desktop 등에서 도구를 서버로 노출하는 방식이나, Claude Code는 직접 CLI/스크립트 실행이 가능하여 MCP 없이도 cad-cli.ts를 직접 호출할 수 있음. 복잡도 감소 + 지연 시간 단축.

## Decision

자체 채팅 UI/API 연동 대신 **Claude Code를 AI 인터페이스로 사용**.

```
┌─ Claude Code (터미널) ─────────────────┐
│  사용자 ↔ Claude LLM ↔ cad-cli.ts     │
│                ↓                       │
│          scene.json 저장               │
└────────────────────────────────────────┘
           │ File System
           ▼
┌─ Viewer ───────────────────────────────┐
│  polling → scene.json → Canvas         │
└────────────────────────────────────────┘
```

## 이유

- Claude Code가 API 키, 스트리밍, 도구 실행 처리
- CLAUDE.md에 cad-cli.ts 사용법 문서화로 즉시 사용
- 개발 비용 대폭 절감

## 삭제된 범위

- 채팅 UI 컴포넌트
- Claude API 직접 호출
- API 키 관리 (electron-store/keytar)

## Consequences

- Electron 앱은 Viewer + Selection UI만
- AI 대화는 Claude Code 터미널에서
