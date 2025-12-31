# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**7-division (도화지)**: AI-Native CAD 프로젝트

현재 단계: MVP (Epic 1~3 완료, Epic 4~6 진행 중)

## Key Documents

- `docs/ax-design-guide.md` - AX (Agent eXperience) 설계 가이드. LLM이 잘 일하는 환경 설계 원칙
- `docs/ai-native-cad-proposal.md` - AI-Native CAD 제안서. "AI가 만들고 AI가 사용하는" CAD 비전

## Architecture Decisions (MAMA에 저장됨)

### Direct-First Architecture
- MCP 없이 Claude Code CLI → WASM 직접 실행
- 브라우저는 순수 뷰어 역할만 (검증 UI)
- 향후 채팅 UI 추가 시 Gateway → Claude Code CLI 호출

### Extensibility
- LLM 교체 가능: 보안 클라이언트에 로컬 LLM(Ollama 등) 제공 가능
- MCP 추가 가능: 코어는 그대로, MCP Server 래퍼만 추가

## AX Design Principles (핵심)

1. **LLM의 추론을 막지 않는다** - 도구 100개 나열 대신 도메인 6개 + description
2. **협업은 자동화가 아니다** - 인간 검증/피드백 필수
3. **반복/정밀 작업은 LLM + 도구가 강하다**
4. **도구는 LLM의 언어다** - 이름만 봐도 의도가 보이게
5. **블랙박스를 만들지 않는다** - 진행상황 투명성

## BMAD Integration

`.bmad/` 디렉토리에 BMAD(Business Model Agile Development) 프레임워크 포함:
- `bmm/` - 워크플로우, 문서 템플릿, 테스트 아키텍처 지식
- `core/` - 에이전트 설정, 브레인스토밍/파티모드 워크플로우

## CAD Tools (cad-cli.ts)

CAD 도형을 그리거나 수정할 때 `cad-tools/cad-cli.ts`를 Bash로 직접 호출합니다.

### 기본 사용법

```bash
cd cad-tools
npx tsx cad-cli.ts <command> '<json_params>'
```

### 주요 명령어

**Primitives (도형 그리기)**
```bash
npx tsx cad-cli.ts draw_circle '{"name":"head","x":0,"y":100,"radius":30}'
npx tsx cad-cli.ts draw_rect '{"name":"body","x":-25,"y":0,"width":50,"height":80}'
npx tsx cad-cli.ts draw_line '{"name":"arm","points":[0,50,50,30]}'
npx tsx cad-cli.ts draw_arc '{"name":"smile","cx":0,"cy":90,"radius":10,"start_angle":180,"end_angle":360}'
```

**Style (스타일 적용)**
```bash
npx tsx cad-cli.ts set_fill '{"name":"head","fill":{"color":[1,0.8,0.6,1]}}'
npx tsx cad-cli.ts set_stroke '{"name":"body","stroke":{"color":[0,0,1,1],"width":2}}'
```

**Transforms (변환)**
```bash
npx tsx cad-cli.ts translate '{"name":"head","dx":10,"dy":20}'
npx tsx cad-cli.ts rotate '{"name":"arm","angle":45,"cx":0,"cy":50}'
npx tsx cad-cli.ts scale '{"name":"body","sx":1.5,"sy":1.5}'
npx tsx cad-cli.ts delete '{"name":"temp"}'
```

**Query (조회)**
```bash
npx tsx cad-cli.ts list_entities
npx tsx cad-cli.ts get_entity '{"name":"head"}'
npx tsx cad-cli.ts get_scene_info
npx tsx cad-cli.ts get_selection     # 뷰어에서 선택된 도형 조회
```

**Export**
```bash
npx tsx cad-cli.ts export_json
npx tsx cad-cli.ts export_svg
```

**Session**
```bash
npx tsx cad-cli.ts reset    # 새 scene 시작
npx tsx cad-cli.ts status   # 현재 상태 확인
```

### 결과 확인

- Scene은 `viewer/scene.json`에 자동 저장됩니다
- 뷰어 실행:
  - `node server.js` (권장) - selection.json 저장 지원
  - `python -m http.server 8000` - 기본 뷰어만 (선택 저장 안됨)
- 사용자가 도형을 클릭하면 선택 상태가 UI에 표시되고 selection.json에 저장
- `get_selection` 명령어로 선택된 도형 조회 가능

### 색상 형식

RGBA 배열: `[r, g, b, a]` (각 0.0 ~ 1.0)
- 빨강: `[1, 0, 0, 1]`
- 반투명 파랑: `[0, 0, 1, 0.5]`

## Development Rules

- **Console 금지**: `logger` 사용 (`cad-tools/src/logger.ts`)
- **Pre-commit**: `npm install` 후 자동 실행 (fmt, eslint --fix)
- **CI**: fmt → clippy → test → build (Rust), eslint → tsc → vitest (TS)
- 상세: `AGENTS.md` 참조

## Git Workflow

- 메인 브랜치: `main`
- PR 리뷰 시 코멘트로 제안, 직접 수정은 승인 후에만
- SSH 키: `github.com-jungjaehoon` 사용
