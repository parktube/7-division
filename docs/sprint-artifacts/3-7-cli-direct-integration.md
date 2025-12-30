# Story 3.7: CLI Direct Integration

Status: done

## Story

As a **Claude Code 사용자**,
I want **Bash를 통해 CAD 도구를 직접 호출할 수 있도록**,
So that **추가 LLM API 호출 없이 CAD 도형을 그리고 수정할 수 있다**.

## Acceptance Criteria

### AC1: CLI 실행
**Given** cad-cli.ts가 존재하는 상태
**When** `npx tsx cad-cli.ts <command> '<json>'` 실행
**Then** CADExecutor가 명령을 실행하고 JSON 결과를 반환한다

### AC2: 모든 명령어 지원
**Given** CLI가 준비된 상태
**When** draw_circle, draw_rect, draw_line, draw_arc, translate, rotate, scale, delete 등 실행
**Then** 각 명령이 성공적으로 실행된다

### AC3: Scene 영속성
**Given** 이전에 도형을 그린 상태
**When** 새로운 CLI 명령 실행
**Then** scene.json에서 기존 엔티티를 복원하고 새 명령을 추가한다

### AC4: Session 관리
**Given** 여러 엔티티가 있는 상태
**When** `reset` 명령 실행
**Then** 모든 엔티티가 삭제되고 새 씬이 시작된다

## Tasks / Subtasks

- [x] **Task 1: CLI 기본 구조** (AC: #1)
  - [x] 1.1: cad-cli.ts 파일 생성
  - [x] 1.2: 명령어 파싱 로직
  - [x] 1.3: JSON 파라미터 파싱

- [x] **Task 2: 명령어 실행** (AC: #2)
  - [x] 2.1: CADExecutor 인스턴스 생성
  - [x] 2.2: 모든 도구 명령어 지원
  - [x] 2.3: 결과 JSON 출력

- [x] **Task 3: Scene 영속성** (AC: #3)
  - [x] 3.1: scene.json 로드 로직
  - [x] 3.2: replayEntity() 함수 구현
  - [x] 3.3: 명령 실행 후 scene.json 저장

- [x] **Task 4: Session 관리** (AC: #4)
  - [x] 4.1: reset 명령 구현
  - [x] 4.2: status 명령 구현

- [x] **Task 5: 문서화**
  - [x] 5.1: AGENTS.md 생성
  - [x] 5.2: CLAUDE.md 업데이트

## Dev Notes

### Architecture

```text
Claude Code (LLM)
    ↓ Bash tool
cad-cli.ts
    ↓
CADExecutor
    ↓
WASM (Rust)
    ↓
viewer/scene.json
```

### Usage

```bash
cd cad-tools
npx tsx cad-cli.ts <command> '<json_params>'

# Examples
npx tsx cad-cli.ts draw_circle '{"name":"head","x":0,"y":100,"radius":30}'
npx tsx cad-cli.ts list_entities
npx tsx cad-cli.ts export_json
```

### ESM __dirname Issue

ESM 모듈에서 `__dirname`이 정의되지 않음. 해결:

```typescript
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
```

### Dependencies

- Story 3.0 (Tool Use Foundation) - CADExecutor

## References

- [Source: AGENTS.md - AI 에이전트용 문서]
- [Source: CLAUDE.md - Claude Code 사용 가이드]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Completion Notes List

- 완료일: 2025-12-29
- Scene replay 구현으로 CLI 호출 간 상태 유지
- ESM __dirname 이슈 해결

### File List

- cad-tools/cad-cli.ts (신규)
- AGENTS.md (신규)
- CLAUDE.md (수정)
