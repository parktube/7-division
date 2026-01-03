# Story 6.6: Claude Code 설정 UX 개선

Status: planning

Scope: Electron app (macOS/Windows) - viewer 수정 없음

## Story

As a **CADViewer 사용자**,
I want **앱 메뉴에서 Claude Code 설정을 쉽게 복사할 수 있도록**,
so that **CLAUDE.md에 수동으로 경로를 입력하지 않아도 된다**.

## Background

현재 문제:
1. 사용자가 CLI 경로를 직접 찾아서 CLAUDE.md에 복사해야 함
2. Claude Code가 CLI 존재를 알 방법이 없음 (사용자가 알려줘야 함)
3. OS별 경로가 달라서 혼란 발생

핵심 인사이트:
- Claude에게 **CLI 경로와 `--help` 존재만 알려주면** 나머지는 스스로 탐색
- AX 원칙: "LLM의 추론을 막지 않는다"

## Acceptance Criteria

1. **AC1: Help 메뉴에서 설정 복사**
   - Given: Electron 앱 실행 중
   - When: Help > Setup Claude Code 클릭
   - Then: 최소한의 CLAUDE.md 스니펫이 클립보드에 복사됨
   - And: 현재 OS에 맞는 CLI 경로가 자동 포함됨

2. **AC2: 불필요한 메뉴 제거**
   - Given: Electron 앱 실행 중
   - When: 메뉴 확인
   - Then: 사용하지 않는 기본 메뉴 항목이 제거됨
   - And: 필요한 항목만 남음 (File, Edit, View, Help)

3. **AC3: CLI help 자기완결성**
   - Given: CLI 설치 완료
   - When: `cad-cli --help` 실행
   - Then: 모든 도메인 탐색 방법이 안내됨
   - And: Claude가 추가 문서 없이 모든 기능 파악 가능

## Tasks / Subtasks

- [ ] **Task 1: 커스텀 메뉴 구현** (AC: 1, 2)
  - [ ] 1.1: main/index.ts에 Menu, clipboard import 추가
  - [ ] 1.2: createAppMenu() 함수 작성
  - [ ] 1.3: 불필요한 기본 메뉴 제거
  - [ ] 1.4: Help > Setup Claude Code 메뉴 항목 추가
  - [ ] 1.5: app.whenReady()에서 메뉴 설정

- [ ] **Task 2: 클립보드 복사 기능** (AC: 1)
  - [ ] 2.1: OS별 CLI 경로 생성 함수
  - [ ] 2.2: 스니펫 생성 및 복사

- [ ] **Task 3: CLI help 자기완결성 검증** (AC: 3)
  - [ ] 3.1: `--help` 출력 검토
  - [ ] 3.2: 필요시 help 출력 개선

## Dev Notes

### 복사할 스니펫 (최소화)

macOS:
```markdown
## CADViewer
CLI: /Applications/CADViewer.app/Contents/Resources/cad-cli.sh
`--help`로 사용법 확인
```

Windows:
```markdown
## CADViewer
CLI: %LOCALAPPDATA%\Programs\CADViewer\resources\cad-cli.cmd
`--help`로 사용법 확인
```

### 메뉴 구조

```
macOS:
  CADViewer
    - About CADViewer
    - Quit CADViewer
  File
    - Close
  Edit
    - Copy
    - Paste
    - Select All
  View
    - Reload
    - Toggle Developer Tools
    ─────────────
    - Actual Size
    - Zoom In
    - Zoom Out
  Help
    - Setup Claude Code  ← 클릭하면 클립보드에 복사

Windows:
  File
    - Exit
  Edit
    - Copy
    - Paste
    - Select All
  View
    - Reload
    - Toggle Developer Tools
    ─────────────
    - Actual Size
    - Zoom In
    - Zoom Out
  Help
    - Setup Claude Code  ← 클릭하면 클립보드에 복사
```

### Claude의 탐색 흐름

```
1. CLAUDE.md 읽음 → CLI 경로 발견
2. cad-cli --help 실행 → 도메인 목록 발견
3. cad-cli describe primitives → 도형 그리기 방법 파악
4. cad-cli draw_circle '{"name":"test",...}' → 실행
```

### 수정 대상 파일

```
cad-electron/src/main/index.ts
```

## References

- Story 6.5: Claude Code 사용 가이드
- docs/ax-design-guide.md - AX 원칙
