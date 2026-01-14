# Story 9.10: Electron 제거 및 정리

Status: drafted

## Story

As a **개발자**,
I want **cad-electron/ 디렉토리를 완전히 제거하기를**,
so that **더 이상 Electron 관련 코드를 유지보수하지 않아도 된다**.

## Acceptance Criteria

1. **Given** Epic 9의 모든 스토리가 완료되었을 때
   **When** cad-electron/ 디렉토리를 삭제하면
   **Then** Git에서 완전히 제거된다
   **And** package.json의 electron 관련 의존성이 제거된다

2. **Given** CLAUDE.md를 업데이트할 때
   **When** Electron 관련 내용을 제거하면
   **Then** 웹 아키텍처 기반으로 문서가 갱신된다

3. **Given** README.md를 업데이트할 때
   **When** 설치/실행 가이드를 변경하면
   **Then** `npx @ai-native-cad/mcp start` 기반으로 안내된다

## Definition of Done (Epic 9 전체)

- [ ] 기존 모든 테스트 통과
- [ ] WebSocket RTT p50 < 15ms, p95 < 50ms (로컬 확인)
- [ ] GitHub Pages에서 Viewer 정상 로드
- [ ] `npx @ai-native-cad/mcp start` 동작
- [ ] `cad-electron/` 완전 제거

## Tasks / Subtasks

- [ ] Task 1: cad-electron/ 디렉토리 제거 (AC: #1)
  - [ ] 1.1 git rm -r cad-electron/
  - [ ] 1.2 .gitignore에서 electron 관련 항목 제거
  - [ ] 1.3 커밋 생성

- [ ] Task 2: 루트 package.json 정리 (AC: #1)
  - [ ] 2.1 electron 관련 devDependencies 제거
  - [ ] 2.2 electron 관련 scripts 제거
  - [ ] 2.3 electron-builder 설정 제거 (있다면)

- [ ] Task 3: CI 워크플로우 정리 (AC: #1)
  - [ ] 3.1 .github/workflows/에서 Electron 빌드 job 제거
  - [ ] 3.2 Electron 관련 artifacts 업로드 제거
  - [ ] 3.3 워크플로우 테스트

- [ ] Task 4: CLAUDE.md 업데이트 (AC: #2)
  - [ ] 4.1 Electron 관련 섹션 제거
  - [ ] 4.2 웹 아키텍처 Quick Start 추가
  - [ ] 4.3 MCP 서버 실행 방법 추가
  - [ ] 4.4 GitHub Pages URL 추가

- [ ] Task 5: README.md 업데이트 (AC: #3)
  - [ ] 5.1 설치 가이드 변경 (npx 기반)
  - [ ] 5.2 실행 가이드 변경
  - [ ] 5.3 아키텍처 다이어그램 업데이트
  - [ ] 5.4 기여자 가이드 업데이트

- [ ] Task 6: 최종 검증 (DoD)
  - [ ] 6.1 pnpm install && pnpm -r build 성공
  - [ ] 6.2 pnpm -r test 통과
  - [ ] 6.3 GitHub Pages Viewer 로드 확인
  - [ ] 6.4 npx @ai-native-cad/mcp start 동작 확인
  - [ ] 6.5 WebSocket 벤치마크 실행 (참고용)

## Dev Notes

### Architecture Compliance

**Source:** [docs/adr/007-web-architecture.md]

Electron을 제거하고 Web + Local MCP 아키텍처로 완전 전환합니다.

**제거 전 (Epic 1~8):**
```
cad-electron/ ← 제거 대상
viewer/
cad-tools/
```

**제거 후 (Epic 9 완료):**
```
apps/
  viewer/      # React Viewer (GitHub Pages)
  cad-mcp/     # MCP Server (npm package)
packages/
  shared/      # 공유 타입
```

### Technical Requirements

**Electron 제거 명령:**

```bash
# 디렉토리 제거
git rm -r cad-electron/

# 커밋
git commit -m "chore: remove cad-electron directory (Epic 9 완료)"
```

**package.json 정리:**

```diff
{
  "devDependencies": {
-   "electron": "^28.x",
-   "electron-builder": "^24.x",
-   "electron-vite": "^2.x"
  },
  "scripts": {
-   "electron:dev": "...",
-   "electron:build": "..."
  }
}
```

### CLAUDE.md 업데이트 예시

```markdown
## Quick Start

### 웹 버전 (권장)
1. MCP 서버 시작:
   \`\`\`bash
   npx @ai-native-cad/mcp start
   \`\`\`

2. Viewer 열기:
   - https://parktube.github.io/7-division/

### 로컬 개발
\`\`\`bash
# 모노레포 설치
pnpm install

# MCP 서버 + Viewer 개발 모드
pnpm --filter @ai-native-cad/mcp start
pnpm --filter @ai-native-cad/viewer dev
\`\`\`
```

### README.md 업데이트 예시

```markdown
## Installation

### 사용자
\`\`\`bash
npx @ai-native-cad/mcp start
\`\`\`
→ Viewer: https://parktube.github.io/7-division/

### 개발자
\`\`\`bash
git clone https://github.com/parktube/7-division.git
cd 7-division
pnpm install
pnpm -r build
\`\`\`
```

### File Structure (최종)

```
r2-7f-division/
├── apps/
│   ├── viewer/            # React Viewer
│   └── cad-mcp/           # MCP Server
├── packages/
│   └── shared/            # 공유 타입
├── cad-engine/            # Rust WASM (그대로)
├── docs/                  # 문서
├── .github/workflows/     # CI (Electron 제거됨)
├── CLAUDE.md              # 업데이트됨
├── README.md              # 업데이트됨
└── pnpm-workspace.yaml
```

### Dependencies

- **선행 스토리**: Story 9.1~9.9 모두 완료
- **후행 스토리**: 없음 (Epic 9 마지막)

### 검증 체크리스트

| 항목 | 검증 방법 | 기준 |
|------|----------|------|
| 테스트 | `pnpm -r test` | 100% 통과 |
| 빌드 | `pnpm -r build` | 에러 없음 |
| Viewer | GitHub Pages URL | 로드 성공 |
| MCP | `npx @ai-native-cad/mcp start` | 서버 시작 |
| 벤치마크 | `pnpm run benchmark` | p50 < 15ms |

### Potential Risks

| 위험 | 완화 전략 |
|------|----------|
| 잔여 참조 | grep으로 electron 문자열 검색 |
| CI 실패 | 워크플로우 테스트 후 머지 |
| 문서 누락 | CLAUDE.md, README.md 전체 검토 |

### 최종 커밋 메시지 예시

```
chore: complete Epic 9 - remove Electron, update docs

- Remove cad-electron/ directory
- Update CLAUDE.md for web architecture
- Update README.md with npx installation
- Clean up CI workflows

Breaking Changes:
- Electron app no longer available
- Use web version: https://parktube.github.io/7-division/
- Use MCP server: npx @ai-native-cad/mcp start
```

### References

- [Source: docs/adr/007-web-architecture.md] - Web + MCP 결정
- [Source: docs/epics.md#Story-9.10] - Story 정의 및 AC
- [Source: docs/architecture.md] - 최종 아키텍처

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

