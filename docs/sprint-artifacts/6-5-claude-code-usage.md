# Story 6.5: Claude Code 사용 가이드

Status: done

Scope: macOS/Windows (Linux 제외)

## Story

As a **개발자/사용자**,
I want **Claude Code로 CAD CLI를 사용하는 흐름을 문서화하도록**,
so that **Electron 앱에서 scene.json 기반 렌더링을 쉽게 검증할 수 있다**.

## Acceptance Criteria

1. **AC1: 실행 흐름 문서화**
   - Given: 배포용 가이드 문서
   - When: 가이드를 확인
   - Then: `cad-cli` 실행 방법이 명확히 설명된다
   - And: `scene.json` 저장 경로가 명시된다
   - And: `help`/`describe`로 명령어를 확인하는 방법이 포함된다

2. **AC2: Electron 검증 절차**
   - Given: Electron 앱 실행 중
   - When: Claude Code로 CAD 명령 실행
   - Then: 화면 갱신 확인 절차가 설명된다

3. **AC3: 예시 명령 제공**
   - Given: 사용자가 빠르게 테스트하고 싶을 때
   - When: 가이드를 따라 실행
   - Then: macOS/Windows 예시로 즉시 확인 가능하다

## Tasks / Subtasks

- [x] **Task 1: 별도 사용 가이드 작성** (AC: 1, 2, 3)
  - [x] 1.1: `docs/claude-code-usage.md` 생성
  - [x] 1.2: OS별 실행 예시 정리 (macOS/Windows)
  - [x] 1.3: 환경 변수 및 scene.json 경로 정리
  - [x] 1.4: help/describe 사용법 추가

- [x] **Task 2: 사용자 CLAUDE.md 스니펫 제공** (AC: 1, 3)
  - [x] 2.1: 가이드에 복사 가능한 스니펫 포함

- [x] **Task 3: 배포 리소스 포함** (AC: 1, 2)
  - [x] 3.1: electron-builder extraResources에 문서 포함

## Dev Notes

### Architecture Compliance

- Claude Code → `cad-cli.ts` → `viewer/scene.json` → Electron Renderer
- 파일 기반 인터페이스 유지 (IPC 없음)

### File Structure Notes

- `docs/claude-code-usage.md` - 배포 앱용 Claude Code 사용 가이드 (사용자 CLAUDE.md 스니펫 포함)
- `cad-electron/electron-builder.yml` - 문서 리소스 포함

### References

- [Source: docs/claude-code-usage.md]
- [Source: docs/rfc/epic6-cad-renderer-package.md]

## Dev Agent Record

### Context Reference

- docs/qa/story-6-manual-qa-log.md
- docs/rfc/epic6-cad-renderer-package.md

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- docs/qa/story-6-manual-qa-log.md

### Completion Notes List

- 배포용 Claude Code 사용 가이드 문서 작성
- 사용자 CLAUDE.md 스니펫 및 help/describe 안내 포함
- electron-builder extraResources로 문서 포함

### File List
| File | Action | Description |
|------|--------|-------------|
| `docs/claude-code-usage.md` | Added | 배포 앱용 Claude Code 사용 가이드 |
| `cad-electron/electron-builder.yml` | Modified | 문서 리소스 포함 |
