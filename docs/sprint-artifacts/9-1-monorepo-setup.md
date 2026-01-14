# Story 9.1: 모노레포 전환 (pnpm workspace)

Status: done

## Story

As a **개발자**,
I want **프로젝트를 pnpm workspace 모노레포로 전환하기를**,
so that **Viewer와 MCP 서버 간 코드 공유 및 버전 관리가 용이해진다** (FR51).

## Acceptance Criteria

1. **Given** 현재 viewer/, cad-tools/ 디렉토리 구조가 있을 때
   **When** 모노레포 전환을 완료하면
   **Then** 다음 구조가 생성된다:
   ```
   apps/
     viewer/        # React Viewer
     cad-mcp/       # MCP Server + CLI
   packages/
     shared/        # 공유 타입/유틸
   pnpm-workspace.yaml
   ```
   **And** `pnpm -r build` 명령이 모든 패키지를 빌드한다
   **And** 기존 기능이 동일하게 동작한다

2. **Given** packages/shared에 Zod 스키마가 정의되었을 때
   **When** apps/viewer와 apps/cad-mcp에서 import하면
   **Then** 타입 체크가 통과한다 (컴파일 타임)
   **And** Zod 스키마 검증이 런타임에 동작한다
   **And** 동일한 스키마를 공유한다

3. **Given** 루트 package.json이 있을 때
   **When** 기존 스크립트(build, test, lint)를 실행하면
   **Then** pnpm -r 명령으로 동일한 작업이 수행된다

## Tasks / Subtasks

- [x] Task 1: pnpm workspace 설정 (AC: #1)
  - [x] 1.1 pnpm 설치 확인 및 버전 검증 (10.x)
  - [x] 1.2 pnpm-workspace.yaml 생성
  - [x] 1.3 루트 package.json을 pnpm workspace용으로 수정

- [x] Task 2: 디렉토리 구조 재편 (AC: #1)
  - [x] 2.1 apps/ 디렉토리 생성
  - [x] 2.2 viewer/ → apps/viewer/ 이동
  - [x] 2.3 cad-tools/ → apps/cad-mcp/ 이동 및 이름 변경
  - [x] 2.4 packages/shared/ 디렉토리 생성

- [x] Task 3: packages/shared 패키지 설정 (AC: #2)
  - [x] 3.1 packages/shared/package.json 생성
  - [x] 3.2 packages/shared/tsconfig.json 생성
  - [x] 3.3 Zod 스키마 파일 생성 (WebSocket 메시지 타입)
  - [x] 3.4 공유 타입 정의 (Scene, Selection, etc.)

- [x] Task 4: 패키지 의존성 설정 (AC: #2)
  - [x] 4.1 apps/viewer/package.json에 @ai-native-cad/shared 의존성 추가
  - [x] 4.2 apps/cad-mcp/package.json에 @ai-native-cad/shared 의존성 추가
  - [x] 4.3 tsconfig.json references 설정

- [x] Task 5: 루트 스크립트 업데이트 (AC: #3)
  - [x] 5.1 루트 package.json 스크립트를 pnpm -r 명령으로 변경
  - [x] 5.2 빌드 순서 확인 (shared → cad-mcp → viewer)
  - [x] 5.3 기존 테스트 명령 호환성 확인

- [x] Task 6: 검증 (AC: #1, #2, #3)
  - [x] 6.1 pnpm install 성공 확인
  - [x] 6.2 pnpm -r build 성공 확인
  - [x] 6.3 기존 기능 동작 테스트 (run_cad_code, viewer dev)
  - [x] 6.4 타입 체크 통과 확인

### Review Follow-ups (AI)

> 코드 리뷰 날짜: 2026-01-14 | 리뷰어: Claude Opus 4.5

**🔴 HIGH (반드시 수정)**
- [x] [AI-Review][HIGH] Status를 "done"으로 업데이트 필요 - 실제 구현 완료됨 [9-1-monorepo-setup.md:3]
- [x] [AI-Review][HIGH] 모든 Tasks/Subtasks를 [x]로 마킹 필요 - 실제로는 완료됨 [9-1-monorepo-setup.md:39-70]
- [x] [AI-Review][HIGH] File List에 변경된 93개 파일 목록 추가 필요 [9-1-monorepo-setup.md:215]

**🟡 MEDIUM (권장 수정) - 코드 품질**
- [x] [AI-Review][MEDIUM] packages/shared 테스트 추가 필요 - Zod 스키마 검증 테스트 없음 [packages/shared/]
  - ✅ tests/ws-messages.test.ts 추가 (19개 테스트)
- [x] [AI-Review][MEDIUM] apps/viewer 테스트 추가 필요 - 테스트 파일 0개, --passWithNoTests 우회 [apps/viewer/]
  - ✅ tests/hooks/useWebSocket.test.ts 추가 (19개 테스트)
- [x] [AI-Review][MEDIUM] packages/shared lint 설정 추가 필요 - pnpm -r lint 시 건너뜀 [packages/shared/]
  - ✅ .eslintrc.cjs 추가, package.json에 lint 스크립트 추가
- [x] [AI-Review][MEDIUM] packages/shared README.md 추가 필요 [packages/shared/]
  - ✅ README.md 추가 (사용법, API 문서)
- [x] [AI-Review][MEDIUM] `geometry: z.unknown()` 타입 안전성 - 런타임 검증 없이 unknown 처리 [packages/shared/src/ws-messages.ts:44]
  - ✅ 현재 구조 유지 결정: viewer는 상세 Geometry 타입 필요, shared는 WebSocket 검증용으로 분리

**🟢 LOW (개선 권장)**
- [x] [AI-Review][LOW] apps/viewer/src/types/scene.ts와 packages/shared 타입 통합 검토
  - ✅ 검토 완료: 현재 구조 유지 (viewer=렌더링용 상세 타입, shared=WS 검증용)
- [x] [AI-Review][LOW] 내부 스키마(EntitySchema, TransformSchema 등) export하여 재사용성 향상 [packages/shared/src/ws-messages.ts]
  - ✅ 모든 내부 스키마 및 타입 export 완료

---

> 2차 코드 리뷰 날짜: 2026-01-14 | 리뷰어: Claude Opus 4.5

**🟡 MEDIUM (권장 수정)**
- [x] [AI-Review][MEDIUM] lint-staged에 packages/shared 누락 - pre-commit 시 lint 미적용 [package.json:27-36]
  - ✅ `packages/shared/src/**/*.ts` 패턴 추가

**🟢 LOW (개선 권장)**
- [x] [AI-Review][LOW] packages/shared에 `files` 필드 추가 필요 - npm publish 시 불필요 파일 포함 방지 [packages/shared/package.json]
  - ✅ `files: ["dist", "src"]` 추가
- [x] [AI-Review][LOW] prepublishOnly 스크립트 추가 필요 - npm publish 안전장치 [packages/shared/package.json]
  - ✅ `prepublishOnly: "pnpm run build && pnpm run test"` 추가

## Dev Notes

### Architecture Compliance

**Source:** [docs/architecture.md Part 2.3]

```
현재 구조:                    모노레포 구조:
─────────────                ─────────────────────
cad-engine/         →        cad-engine/           (그대로)
cad-tools/          →        apps/cad-mcp/         (MCP 서버 추가)
viewer/             →        apps/viewer/          (WebSocket 추가)
cad-electron/       →        (제거 - Story 9.10)
                             packages/shared/       (신규)
                             pnpm-workspace.yaml   (신규)
```

### Technical Requirements

**pnpm workspace 설정:**

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**패키지 네이밍 컨벤션:**
- apps/viewer → `@ai-native-cad/viewer` (private: true)
- apps/cad-mcp → `@ai-native-cad/mcp`
- packages/shared → `@ai-native-cad/shared`

**공유 타입 예시 (packages/shared):**

```typescript
// packages/shared/src/schemas.ts
import { z } from 'zod';

export const SceneUpdateSchema = z.object({
  type: z.literal('scene_update'),
  payload: z.object({
    entities: z.array(z.unknown()),
    timestamp: z.number(),
  }),
});

export type SceneUpdate = z.infer<typeof SceneUpdateSchema>;
```

### File Structure Requirements

**최종 디렉토리 구조:**

```
7-division/
├── apps/
│   ├── viewer/                    # React Viewer (기존 viewer/)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   └── cad-mcp/                   # MCP Server (기존 cad-tools/)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
├── packages/
│   └── shared/                    # 공유 타입/유틸
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── schemas.ts         # Zod 스키마
│           └── types.ts           # TypeScript 타입
├── cad-engine/                    # Rust WASM (변경 없음)
├── pnpm-workspace.yaml
├── package.json                   # 루트 (워크스페이스 관리)
└── tsconfig.json                  # 루트 (references)
```

### Testing Requirements

**빌드 검증:**
```bash
pnpm install
pnpm -r build
```

**기능 검증:**
```bash
# CLI 동작 확인
cd apps/cad-mcp && npx tsx src/cli.ts run_cad_code --status

# Viewer 동작 확인
cd apps/viewer && pnpm dev
```

### Previous Implementation Intelligence

**현재 package.json 스크립트:**
- `npm run build` → WASM 빌드
- `npm run build:tools` → cad-tools 빌드
- `npm run test:tools` → cad-tools 테스트

**변환 후:**
- `pnpm -r build` → 모든 패키지 빌드
- `pnpm --filter @ai-native-cad/mcp build` → MCP만 빌드
- `pnpm --filter @ai-native-cad/viewer dev` → Viewer 개발 서버

### Git Intelligence

**최근 커밋:**
- `e88c392` - chore: 완료된 Epic 7 스토리 파일 삭제
- `9518276` - docs: Epic 9 웹 아키텍처 문서 통합 및 에픽 스토리 작성

### Potential Risks

| 위험 | 완화 전략 |
|------|----------|
| 경로 변경으로 인한 import 깨짐 | IDE의 리팩토링 기능 활용, 타입 체크 |
| WASM 경로 참조 문제 | cad-engine/ 위치 유지, 상대 경로 확인 |
| CI 워크플로우 깨짐 | .github/workflows 업데이트 필요 |
| lint-staged 설정 업데이트 | 새 경로에 맞게 수정 |

### References

- [Source: docs/architecture.md#2.3] - Technology Stack, Monorepo Migration Plan
- [Source: docs/epics.md#Story-9.1] - Story 정의 및 AC
- [Source: package.json] - 현재 스크립트 구조

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

**신규 생성 (93개 파일):**

```
# 워크스페이스 설정
pnpm-workspace.yaml
package.json (수정)
pnpm-lock.yaml

# apps/cad-mcp/ (기존 cad-tools/ → apps/cad-mcp/)
apps/cad-mcp/.eslintrc.cjs
apps/cad-mcp/cad-agent.ts
apps/cad-mcp/cad-cli.ts
apps/cad-mcp/docs/images/arc-boolean-demo.png
apps/cad-mcp/draw-house.ts
apps/cad-mcp/examples/circular-studio.ts
apps/cad-mcp/examples/curved-furniture.ts
apps/cad-mcp/examples/draw-room.ts
apps/cad-mcp/generate-scene.ts
apps/cad-mcp/package.json
apps/cad-mcp/run-agent.ts
apps/cad-mcp/src/angle-utils.ts
apps/cad-mcp/src/capture.ts
apps/cad-mcp/src/cli.ts
apps/cad-mcp/src/discovery.ts
apps/cad-mcp/src/executor.ts
apps/cad-mcp/src/index.ts
apps/cad-mcp/src/logger.ts
apps/cad-mcp/src/providers/anthropic.ts
apps/cad-mcp/src/providers/types.ts
apps/cad-mcp/src/run-cad-code/constants.ts
apps/cad-mcp/src/run-cad-code/handlers.ts
apps/cad-mcp/src/run-cad-code/index.ts
apps/cad-mcp/src/run-cad-code/utils.ts
apps/cad-mcp/src/runtime.ts
apps/cad-mcp/src/sandbox/index.ts
apps/cad-mcp/src/sandbox/manifold.ts
apps/cad-mcp/src/sandbox/text.ts
apps/cad-mcp/src/schema.ts
apps/cad-mcp/src/tool-registry.ts
apps/cad-mcp/tests/angle-utils.test.ts
apps/cad-mcp/tests/discovery.test.ts
apps/cad-mcp/tests/executor.test.ts
apps/cad-mcp/tests/providers/anthropic.test.ts
apps/cad-mcp/tests/runtime.test.ts
apps/cad-mcp/tests/schema.test.ts
apps/cad-mcp/tests/setup.ts
apps/cad-mcp/tool-requests.json
apps/cad-mcp/tsconfig.json
apps/cad-mcp/vitest.config.ts

# apps/viewer/ (기존 viewer/ → apps/viewer/)
apps/viewer/index.html
apps/viewer/package.json
apps/viewer/src/App.tsx
apps/viewer/src/components/Canvas/Canvas.tsx
apps/viewer/src/components/Canvas/SketchOverlay.tsx
apps/viewer/src/components/Canvas/SketchToolbar.tsx
apps/viewer/src/components/Canvas/index.ts
apps/viewer/src/components/InfoPanel/InfoPanel.tsx
apps/viewer/src/components/InfoPanel/index.ts
apps/viewer/src/components/LayerPanel/LayerItem.tsx
apps/viewer/src/components/LayerPanel/LayerPanel.tsx
apps/viewer/src/components/LayerPanel/index.ts
apps/viewer/src/components/Layout/PanelLayout.tsx
apps/viewer/src/components/Layout/index.ts
apps/viewer/src/components/StatusBar/StatusBar.tsx
apps/viewer/src/components/StatusBar/index.ts
apps/viewer/src/components/TopBar/ToggleButton.tsx
apps/viewer/src/components/TopBar/TopBar.tsx
apps/viewer/src/components/TopBar/index.ts
apps/viewer/src/contexts/UIContext.tsx
apps/viewer/src/contexts/ViewportContext.tsx
apps/viewer/src/hooks/useScene.ts
apps/viewer/src/hooks/useSelectionSync.ts
apps/viewer/src/hooks/useSketch.ts
apps/viewer/src/hooks/useTheme.ts
apps/viewer/src/hooks/useTreeExpansion.ts
apps/viewer/src/hooks/useViewport.ts
apps/viewer/src/main.tsx
apps/viewer/src/styles/globals.css
apps/viewer/src/types/scene.ts
apps/viewer/src/types/selection.ts
apps/viewer/src/types/sketch.ts
apps/viewer/src/types/tree.ts
apps/viewer/src/types/viewport.ts
apps/viewer/src/utils/dataUrl.ts
apps/viewer/src/utils/debounce.ts
apps/viewer/src/utils/entityIcon.ts
apps/viewer/src/utils/platform.ts
apps/viewer/src/utils/renderEntity.ts
apps/viewer/src/utils/selectionIO.ts
apps/viewer/src/utils/transform.ts
apps/viewer/tsconfig.json
apps/viewer/tsconfig.node.json
apps/viewer/vite.config.ts

# packages/shared/ (신규)
packages/shared/package.json
packages/shared/src/index.ts
packages/shared/src/ws-messages.ts
packages/shared/tsconfig.json
```

