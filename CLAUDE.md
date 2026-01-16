# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**7-division (도화지)**: AI-Native CAD 프로젝트

- **비전**: "AI가 만들고, AI가 사용한다" - LLM이 도구를 조작하고, 인간은 의도/검증
- **현재 단계**: Epic 1~10 완료 (MVP + 웹 아키텍처 + AX 개선)
- **아키텍처**: Web + Local MCP (GitHub Pages 뷰어 + 로컬 MCP 서버)
- **구조**: pnpm workspace 모노레포
  - `apps/viewer` - React 뷰어 (GitHub Pages)
  - `apps/cad-mcp` - MCP 서버
  - `packages/shared` - 공유 타입 (Zod 스키마)

## Key Documents

| 문서 | 내용 |
|------|------|
| [cad-sandbox-workflow.md](docs/cad-sandbox-workflow.md) | **샌드박스 코딩 워크플로우 (필독!)** |
| [cad-mcp-guide.md](docs/cad-mcp-guide.md) | CAD MCP 도구/함수 가이드 |
| [ax-design-guide.md](docs/ax-design-guide.md) | AX (Agent eXperience) 설계 원칙 |
| [architecture.md](docs/architecture.md) | 기술 아키텍처 |

## CAD 작업 시 (필독!)

### 1. 워크플로우 체크리스트

```
코딩 전:
1. lsp symbols → 기존 유사 코드 확인
2. 확장/신규 판단 → 접근 방식 사용자에게 제안

코딩 중:
3. 3번째 유사 패턴 → "추상화 검토할까요?"
4. 2번째 땜질 → "구조 재검토 제안"

코딩 후:
5. 동작 확인 후 → "X 추가하려면?" 자문
```

### 2. 핵심 도구

| 도구 | 용도 |
|------|------|
| `glob` | 파일 목록 |
| `read` | 파일 읽기 |
| `edit` | 부분 수정 → 자동 실행 |
| `write` | 전체 작성 → 자동 실행 |
| `lsp` | 도메인/함수 탐색 |
| `bash` | 씬 조회/엔티티 좌표/내보내기 |

**엔티티 좌표 조회**:
```javascript
bash({ command: 'entity', name: 'pig_tail' })
// → { local: {...}, world: { bounds, center } }
// 💡 스케치 좌표와 비교하여 translate()로 위치 조정
```

**상세 가이드**: [docs/cad-mcp-guide.md](docs/cad-mcp-guide.md)

## Quick Start

```bash
# 의존성 설치
pnpm install

# MCP 서버 + Viewer 개발 모드 (각각 별도 터미널)
pnpm --filter @ai-native-cad/mcp start
pnpm --filter @ai-native-cad/viewer dev
# → http://localhost:5173/
```

## Development Rules

- **Console 금지**: `logger` 사용 (`apps/cad-mcp/src/logger.ts`)
- **Pre-commit**: `npm install` 후 자동 실행 (fmt, eslint --fix)
- **CI**: fmt → clippy → test → build (Rust), eslint → tsc → vitest (TS)
- **Git**: `main` 브랜치, SSH 키 `github.com-jungjaehoon`
- **문자열**: 작은따옴표(`'`) 사용

## AX Design Principles

1. **LLM의 추론을 막지 않는다** - 도메인 + lsp(describe)로 Progressive Disclosure
2. **협업은 자동화가 아니다** - 인간 검증/피드백 필수
3. **반복/정밀 작업은 LLM + 도구가 강하다**
4. **도구는 LLM의 언어다** - Claude Code 패턴(glob/read/edit/write/lsp/bash)
5. **블랙박스를 만들지 않는다** - 진행상황 투명성
6. **진입점 무결성** - `CLAUDE.md`가 실제 도구 경로와 항상 일치

## Architecture Decisions

### MCP-First Architecture
- Claude Code → MCP 서버 → WASM 실행
- 브라우저는 순수 뷰어 역할 (검증 UI)
- WebSocket으로 실시간 씬 동기화

### Extensibility
- LLM 교체 가능: 로컬 LLM(Ollama 등) 제공 가능
- 씬 영속성: scene.json으로 상태 자동 저장/복원

## 현재 시스템의 한계

| 규모 | 관리 방식 | 상태 |
|------|----------|------|
| ~500 엔티티 | 플랫 + 네이밍 | 현재 지원 |
| ~5,000 | 계층적 그룹 | 탐색 어려움 |
| ~50,000 | - | 미지원 |

**개선 방향**: Scoped Context, Query Language, Progressive Disclosure 강화
