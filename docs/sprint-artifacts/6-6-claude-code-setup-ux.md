# Story 6.6: Claude Code 설정 UX 개선

Status: done

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
   - And: 현재 앱의 실제 설치 경로가 동적으로 포함됨

2. **AC2: 불필요한 메뉴 제거**
   - Given: Electron 앱 실행 중
   - When: 메뉴 확인
   - Then: 불필요한 기본 메뉴 항목이 제거되고, 다음 항목만 남음:
   - And: macOS: CADViewer, File, Edit, View, Help
   - And: Windows: File, Edit, View, Help

3. **AC3: CLI help 완결성 검증**
   - Given: CLI 설치 완료
   - When: `cad-cli --help`, `cad-cli domains`, `cad-cli describe <domain>` 실행
   - Then: 모든 지원 명령어가 help에 포함됨

## Tasks / Subtasks

- [x] **Task 1: 커스텀 메뉴 구현** (AC: 1, 2)
  - [x] 1.1: main/index.ts에 Menu, clipboard import 추가
  - [x] 1.2: createAppMenu() 함수 작성
  - [x] 1.3: 불필요한 기본 메뉴 제거
  - [x] 1.4: Help > Setup Claude Code 메뉴 항목 추가
  - [x] 1.5: app.whenReady()에서 메뉴 설정

- [x] **Task 2: 클립보드 복사 기능** (AC: 1) - Dev Notes 스니펫 형식(67-80줄) 따름
  - [x] 2.1: 앱 실제 경로에서 CLI 경로 동적 생성 (상대 경로로 per-user/per-machine 모두 지원)
  - [x] 2.2: 스니펫 생성 및 복사

- [x] **Task 3: CLI help 자기완결성 검증 (코드 변경 없음)** (AC: 3)
  - [x] 3.1: 현재 CLI의 `--help`, `domains`, `describe`가 모든 명령어를 포함하는지 확인

## Dev Notes

### 복사할 스니펫 (최소화)

CLI 경로는 앱 실제 설치 위치에서 동적으로 생성.
상대 경로 방식이므로 Windows per-user/per-machine 설치 모두 지원:

```typescript
// main process에서 실제 경로 계산
// app.getAppPath()는 Resources/app.asar를 반환하므로 ../cad-cli.sh로 같은 디렉토리 접근
const appPath = app.getAppPath();
const cliPath = process.platform === 'darwin'
  ? path.join(appPath, '../cad-cli.sh')
  : path.join(appPath, '../cad-cli.cmd');
```

결과 예시:
```markdown
## CADViewer
CLI: /Applications/CADViewer.app/Contents/Resources/cad-cli.sh
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
