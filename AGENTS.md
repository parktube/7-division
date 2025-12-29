# AGENTS.md

AI 에이전트(Cursor, Windsurf, 기타 LLM 기반 도구)를 위한 프로젝트 가이드입니다.

## Project Overview

**7-division (도화지)**: AI-Native CAD 프로젝트
- Rust WASM 기반 CAD 엔진
- TypeScript CLI로 도구 호출
- 브라우저 뷰어로 결과 확인

## CAD Tools 사용법

CAD 도형을 그리거나 수정할 때 `cad-tools/cad-cli.ts`를 터미널에서 직접 호출합니다.

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
npx tsx cad-cli.ts remove_fill '{"name":"head"}'
npx tsx cad-cli.ts remove_stroke '{"name":"body"}'
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
npx tsx cad-cli.ts list_entities        # 모든 엔티티 목록
npx tsx cad-cli.ts get_entity '{"name":"head"}'  # 특정 엔티티 정보
npx tsx cad-cli.ts get_scene_info       # Scene 전체 정보
```

**Export (내보내기)**
```bash
npx tsx cad-cli.ts export_json   # JSON 형식
npx tsx cad-cli.ts export_svg    # SVG 형식
```

**Session (세션 관리)**
```bash
npx tsx cad-cli.ts reset    # 새 scene 시작 (모든 엔티티 삭제)
npx tsx cad-cli.ts status   # 현재 상태 확인
```

### 결과 확인

- Scene은 `viewer/scene.json`에 자동 저장됩니다
- 뷰어 실행: `cd viewer && python -m http.server 8000`
- 브라우저: `http://localhost:8000/viewer/`

### 색상 형식

RGBA 배열: `[r, g, b, a]` (각 0.0 ~ 1.0)

```
빨강:        [1, 0, 0, 1]
초록:        [0, 1, 0, 1]
파랑:        [0, 0, 1, 1]
반투명 파랑:  [0, 0, 1, 0.5]
검정:        [0, 0, 0, 1]
흰색:        [1, 1, 1, 1]
```

### 예시: 간단한 집 그리기

```bash
cd cad-tools
npx tsx cad-cli.ts reset
npx tsx cad-cli.ts draw_rect '{"name":"floor","x":-100,"y":0,"width":200,"height":100}'
npx tsx cad-cli.ts draw_line '{"name":"roof_left","points":[-100,100,0,150]}'
npx tsx cad-cli.ts draw_line '{"name":"roof_right","points":[0,150,100,100]}'
npx tsx cad-cli.ts draw_rect '{"name":"door","x":-20,"y":0,"width":40,"height":60}'
npx tsx cad-cli.ts set_fill '{"name":"door","fill":{"color":[0.55,0.27,0.07,1]}}'
npx tsx cad-cli.ts list_entities
```

## Architecture

```
AI Agent (Claude Code, Cursor, etc.)
    ↓ 터미널 명령어
cad-cli.ts
    ↓
CADExecutor (TypeScript)
    ↓
WASM (Rust)
    ↓
viewer/scene.json
    ↓
Browser Viewer
```

## Key Principles

1. **스크립트 작성 금지** - 직접 CLI 명령어로 도구 호출
2. **결과 확인** - `list_entities`, `get_scene_info`로 현재 상태 확인
3. **점진적 작업** - 한 번에 하나씩 엔티티 추가/수정
4. **뷰어 활용** - 시각적 결과 확인은 뷰어에서
