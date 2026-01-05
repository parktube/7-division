---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - docs/prd.md
  - docs/epics.md
workflowType: 'architecture'
lastStep: 8
status: complete
project_name: 'AI-Native CAD'
user_name: 'Hoons'
date: '2025-01-06'
---

# Architecture Document - AI-Native CAD (Epic 7)

**Last Updated:** 2025-01-06

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements (FR31~FR40):**

Epic 7은 10개의 FR을 포함하며, 인간-LLM 협업을 위한 UI 개선에 집중합니다:

| FR | 기능 | 아키텍처 임팩트 |
|----|------|----------------|
| FR31 | 3패널 레이아웃 | React 컴포넌트 구조, 레이아웃 시스템 |
| FR32 | 패널 리사이즈 | react-resizable-panels, 60fps 성능 |
| FR33 | 계층 트리뷰 | 재귀적 컴포넌트, 상태 관리 |
| FR34 | 그룹 탐색 | 트리 확장/축소 로직 |
| FR35 | 다중 선택 | 키보드 이벤트, selection 상태 |
| FR36 | Visible 토글 | 렌더러 필터링 로직 |
| FR37 | Lock 가드 | selection.json 확장, LLM 피드백 |
| FR38 | 스케치 모드 | Canvas 오버레이, 그리기 도구 |
| FR39 | 스케치 캡쳐 | capture_viewport + Vision 연동 |
| FR40 | 단일 소스 | 웹/Electron 코드 공유 |

**Non-Functional Requirements (NFR18~NFR20):**

- **NFR18**: 패널 리사이즈 60fps
- **NFR19**: React 전환 후 렌더링 품질 동등
- **NFR20**: 웹/Electron 동일 동작

**Scale & Complexity:**

- Primary domain: Desktop App (Electron + Web)
- Complexity level: Medium-High
- Estimated architectural components: ~15

### Technical Constraints & Dependencies

| 제약 | 설명 |
|------|------|
| 기존 렌더러 | viewer/renderer.js 변환 로직 정확 포팅 |
| selection.json | 기존 포맷 유지 + Lock/Visible 확장 |
| Electron 통합 | viewer/dist 직접 로드 방식 |
| 좌표계 | Y-up, 원점 중앙 (ADR-005) |

### Cross-Cutting Concerns Identified

1. **상태 관리**: scene.json 폴링, selection 상태, 패널 상태
2. **이벤트 시스템**: Canvas 클릭, 키보드 단축키, 패널 드래그
3. **렌더링 성능**: Canvas 2D, 60fps 목표
4. **Electron 호환**: IPC 최소화, 파일 기반 통신 유지

---

## Starter Template Evaluation

### Primary Technology Domain

**Desktop App (Electron + Web)** - 기존 viewer/ 바닐라 JS를 React로 리디자인

### Starter Options Considered

| 옵션 | 평가 |
|------|------|
| create-react-app | ❌ 무거움, 커스터마이징 제한, 유지보수 중단 |
| Vite React template | ⚠️ 가볍지만 기본 설정만 제공 |
| **직접 설정** | ✅ 기존 구조 유지, 완전한 제어 |

### Selected Approach: 직접 설정 (Manual Setup)

**Rationale:**
1. 기존 viewer/ 디렉토리 구조 유지 필요
2. .cad-modules/, scene.json, selection.json 위치 유지
3. Electron 통합 방식 (viewer/dist 로드) 고려
4. 불필요한 boilerplate 제거

### Tech Stack (확정)

| 항목 | 기술 | 버전 | 비고 |
|------|------|------|------|
| **Framework** | React | 19.2+ | [React Versions](https://react.dev/versions) |
| **Language** | TypeScript | 5.7+ | |
| **Build** | Vite | 7.3+ | Node 20.19+ 필요 [Vite Releases](https://vite.dev/releases) |
| **Styling** | TailwindCSS | 4.x | Rust 엔진 |
| **Layout** | react-resizable-panels | 2.x | |

### 초기화 명령어

```bash
cd viewer
npm init -y
npm install react react-dom react-resizable-panels
npm install -D @types/react @types/react-dom @vitejs/plugin-react \
  typescript vite tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Architectural Decisions by Setup

**Language & Runtime:**
- TypeScript strict mode
- React 18 concurrent features

**Styling Solution:**
- TailwindCSS utility-first
- CSS-in-JS 없음 (단순화)

**Build Tooling:**
- Vite (빠른 HMR, ESM 기반)
- esbuild for TypeScript

**Code Organization:**
- src/components/ (컴포넌트)
- src/hooks/ (커스텀 훅)
- src/types/ (타입 정의)

**Development Experience:**
- Vite dev server (http://localhost:5173)
- Hot Module Replacement
- TypeScript 타입 체크

---

## Core Architectural Decisions

### Decision Priority Analysis

**이미 결정됨 (변경 불가):**
- 좌표계: Y-up, 원점 중앙 (ADR-005)
- 데이터 흐름: scene.json → Viewer polling
- 선택 정보: selection.json (Layer Panel → LLM)
- 렌더러: Canvas 2D

**Critical Decisions (Epic 7):**
1. 상태 관리 전략
2. Canvas 렌더링 포팅 방식
3. Electron 통합 방식

### 상태 관리

| 결정 | 선택 | 근거 |
|------|------|------|
| **전역 상태** | React Context | Zustand는 오버킬, 단순 구조 |
| **Scene 데이터** | useScene hook | 500ms polling, SWR 패턴 |
| **Selection** | useSelection hook | selection.json 연동 |
| **Panel 상태** | localStorage | 패널 크기 persist |

```typescript
// 상태 구조
interface AppState {
  scene: Scene | null;           // scene.json에서 로드
  selection: Selection;          // selection.json과 동기화
  panelSizes: [number, number];  // localStorage persist
}
```

### Canvas 렌더링

| 결정 | 선택 | 근거 |
|------|------|------|
| **렌더링 방식** | Canvas 2D API 직접 사용 | 기존 renderer.js 로직 유지 |
| **React 통합** | useRef + useEffect | Canvas는 React 외부 렌더링 |
| **변환 순서** | Scale → Rotate → Translate | 기존 ADR 준수 |

```typescript
// Canvas 렌더링 hook
function useCanvasRenderer(canvasRef: RefObject<HTMLCanvasElement>, scene: Scene) {
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !scene) return;

    // 기존 renderer.js 로직 포팅
    renderScene(ctx, scene);
  }, [scene]);
}
```

### Electron 통합

| 결정 | 선택 | 근거 |
|------|------|------|
| **개발 모드** | Vite dev server URL 로드 | HMR 지원 |
| **프로덕션** | viewer/dist 직접 로드 | extraResources 포함 |
| **IPC** | 최소화 (파일 기반 유지) | 복잡도 감소 |

```javascript
// cad-electron/src/main/index.js
if (is.dev) {
  mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
} else {
  mainWindow.loadFile(path.join(__dirname, '../viewer/dist/index.html'));
}
```

### 이벤트 처리

| 결정 | 선택 | 근거 |
|------|------|------|
| **키보드 단축키** | useHotkeys hook | 표준 패턴 |
| **Canvas 이벤트** | onMouseDown/Move/Up | native 이벤트 |
| **다중 선택** | Ctrl/Cmd + Click | OS 표준 |

### 파일 통신 확장

**selection.json 확장:**
```json
{
  "selected_entities": ["arm_left"],
  "locked_entities": ["head", "body"],
  "hidden_entities": ["reference_grid"],
  "timestamp": 1704499200000
}
```

- `locked_entities`: LLM 수정 불가 (경고 반환)
- `hidden_entities`: 렌더링 제외

### Decision Impact Analysis

**구현 순서:**
1. Vite + React 프로젝트 설정
2. 3패널 레이아웃 (react-resizable-panels)
3. useScene hook (scene.json polling)
4. Canvas 렌더러 포팅
5. Layer Panel (트리뷰)
6. selection.json 연동
7. Electron 통합 테스트

---

## Implementation Patterns & Consistency Rules

### AI Agent 충돌 방지 패턴

AI 에이전트가 다르게 구현할 수 있는 지점을 사전에 정의합니다.

### Naming Patterns

**컴포넌트 & 파일:**

| 항목 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `LayerPanel`, `CanvasRenderer` |
| 파일명 | PascalCase.tsx | `LayerPanel.tsx`, `Canvas.tsx` |
| 폴더명 | PascalCase | `LayerPanel/`, `Canvas/` |
| index export | barrel export | `index.ts` |

**Hooks:**

| 항목 | 규칙 | 예시 |
|------|------|------|
| 커스텀 훅 | use* prefix | `useScene`, `useSelection` |
| 파일명 | camelCase.ts | `useScene.ts` |

**변수 & 함수:**

| 항목 | 규칙 | 예시 |
|------|------|------|
| 변수 | camelCase | `sceneData`, `selectedIds` |
| 함수 | camelCase | `handleClick`, `renderEntity` |
| 상수 | UPPER_SNAKE | `POLLING_INTERVAL` |
| 타입 | PascalCase | `Scene`, `Entity`, `Selection` |

### Structure Patterns

**컴포넌트 구조:**

```
ComponentName/
├── ComponentName.tsx      # 메인 컴포넌트
├── ComponentName.test.tsx # 테스트 (co-located)
├── index.ts               # barrel export
└── types.ts               # 컴포넌트 전용 타입 (선택)
```

**Hook 구조:**

```typescript
// useScene.ts
export function useScene() {
  // 1. State declarations
  const [scene, setScene] = useState<Scene | null>(null);

  // 2. Effects
  useEffect(() => {
    // polling logic
  }, []);

  // 3. Return
  return { scene, isLoading, error };
}
```

### Format Patterns

**scene.json (기존 유지):**
```json
{
  "entities": [
    {
      "id": "circle_1",
      "type": "Circle",
      "geometry": { "center": [0, 0], "radius": 50 },
      "transform": { "translate": [0, 0], "rotate": 0, "scale": [1, 1] },
      "style": { "stroke": { "color": [0, 0, 0, 1], "width": 1 } }
    }
  ]
}
```

**selection.json 확장:**
```json
{
  "selected_entities": ["entity_id"],
  "locked_entities": ["locked_id"],
  "hidden_entities": ["hidden_id"],
  "timestamp": 1704499200000
}
```

### Process Patterns

**에러 처리:**

```typescript
// 1. fetch 에러: 무시하고 재시도
try {
  const res = await fetch('/scene.json');
  // ...
} catch (e) {
  console.warn('scene.json fetch failed, retrying...');
}

// 2. 렌더링 에러: Error Boundary
<ErrorBoundary fallback={<ErrorDisplay />}>
  <Canvas />
</ErrorBoundary>
```

**로딩 상태:**

```typescript
// isLoading, isError 패턴
const { scene, isLoading, isError } = useScene();

if (isLoading) return <Spinner />;
if (isError) return <ErrorMessage />;
return <Canvas scene={scene} />;
```

### Canvas 렌더링 패턴

**변환 순서 (반드시 준수):**

```typescript
ctx.save();
ctx.translate(tx, ty);
ctx.rotate(rotation);
ctx.scale(sx, sy);
// draw entity
ctx.restore();
```

**Y-up 좌표 변환:**

```typescript
// Canvas는 Y-down, 우리는 Y-up
ctx.save();
ctx.translate(0, canvas.height);
ctx.scale(1, -1);
// 이후 모든 렌더링은 Y-up 기준
```

### Enforcement Guidelines

**모든 AI 에이전트 필수 준수:**

1. 컴포넌트 파일명은 반드시 PascalCase.tsx
2. 훅은 반드시 use* prefix
3. Canvas 변환 순서: translate → rotate → scale
4. Y-up 좌표계 유지 (Canvas에서 scale(1, -1) 적용)
5. selection.json 포맷 준수

**Anti-Patterns (금지):**

```typescript
// ❌ 잘못된 변환 순서
ctx.scale(sx, sy);
ctx.rotate(rotation);
ctx.translate(tx, ty);

// ❌ Y-down 가정
ctx.arc(x, canvas.height - y, radius, 0, Math.PI * 2);

// ❌ kebab-case 파일명
// layer-panel.tsx (금지)
```

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
viewer/                           # React 앱 (단일 소스)
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx                  # 앱 진입점
│   ├── App.tsx                   # 루트 컴포넌트
│   ├── components/
│   │   ├── LayerPanel/
│   │   │   ├── LayerPanel.tsx    # 3패널 중 좌측
│   │   │   ├── LayerItem.tsx     # 트리 아이템
│   │   │   ├── LayerTree.tsx     # 재귀적 트리
│   │   │   └── index.ts
│   │   ├── Canvas/
│   │   │   ├── Canvas.tsx        # 3패널 중 중앙
│   │   │   ├── CanvasRenderer.ts # 렌더링 로직 (순수 함수)
│   │   │   ├── SketchOverlay.tsx # 스케치 모드 오버레이
│   │   │   └── index.ts
│   │   ├── InfoPanel/
│   │   │   ├── InfoPanel.tsx     # 3패널 중 우측
│   │   │   ├── SelectionInfo.tsx # 선택 정보
│   │   │   ├── SceneInfo.tsx     # 씬 정보
│   │   │   └── index.ts
│   │   └── StatusBar/
│   │       └── StatusBar.tsx     # 하단 상태바
│   ├── hooks/
│   │   ├── useScene.ts           # scene.json 폴링
│   │   ├── useSelection.ts       # selection.json 연동
│   │   └── usePanelSizes.ts      # 패널 크기 persist
│   ├── types/
│   │   ├── scene.ts              # Scene, Entity 타입
│   │   └── selection.ts          # Selection 타입
│   ├── utils/
│   │   ├── hitTest.ts            # 클릭 판정
│   │   ├── transform.ts          # 좌표 변환
│   │   └── renderEntity.ts       # 엔티티별 렌더링
│   └── styles/
│       └── globals.css           # TailwindCSS 진입점
├── .cad-modules/                 # 기존 유지 (cad-tools 모듈)
├── scene.json                    # 기존 유지 (WASM 출력)
├── selection.json                # 기존 유지 (선택 상태)
└── legacy/                       # 백업 (삭제 예정)
    ├── index.html
    └── renderer.js
```

### Architectural Boundaries

**파일 기반 통신:**

```
cad-tools (WASM)
      ↓ write
  scene.json
      ↓ polling (500ms)
  viewer/src/hooks/useScene.ts
      ↓
  React 컴포넌트
      ↓ write
  selection.json
      ↓ read
  cad-tools (LLM)
```

**컴포넌트 경계:**

| 컴포넌트 | 책임 | 통신 |
|---------|------|------|
| LayerPanel | 엔티티 목록, Lock/Visible | selection.json 쓰기 |
| Canvas | 렌더링, Pan/Zoom, 스케치 | scene.json 읽기 |
| InfoPanel | 선택 정보 표시 | selection 상태 읽기 |

### Requirements to Structure Mapping

**FR31~32 (3패널 레이아웃):**
- `src/App.tsx` - react-resizable-panels 적용
- `src/hooks/usePanelSizes.ts` - localStorage persist

**FR33~37 (Layer Panel):**
- `src/components/LayerPanel/` - 트리뷰, Lock, Visible
- `src/hooks/useSelection.ts` - selection.json 연동

**FR38~39 (스케치 모드):**
- `src/components/Canvas/SketchOverlay.tsx` - 스케치 UI
- capture_viewport는 기존 cad-tools 명령어 사용

**FR40 (단일 소스):**
- `viewer/` 디렉토리가 유일한 소스
- `cad-electron/`은 `viewer/dist` 직접 로드

### Integration Points

**Electron 통합:**

```javascript
// cad-electron/src/main/index.js
if (is.dev) {
  // 개발: Vite dev server
  mainWindow.loadURL('http://localhost:5173');
} else {
  // 프로덕션: viewer/dist 로드
  mainWindow.loadFile(
    path.join(__dirname, '../../viewer/dist/index.html')
  );
}
```

**Vite Middleware (selection.json POST):**

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'selection-middleware',
      configureServer(server) {
        server.middlewares.use('/selection.json', (req, res) => {
          if (req.method === 'POST') {
            // selection.json 저장
          }
        });
      }
    }
  ]
});
```

### File Organization Summary

| 위치 | 역할 |
|------|------|
| `src/components/` | UI 컴포넌트 |
| `src/hooks/` | 커스텀 훅 (상태, 폴링) |
| `src/types/` | TypeScript 타입 |
| `src/utils/` | 순수 함수 (렌더링, 변환) |
| `legacy/` | 기존 바닐라 JS (참고용, 삭제 예정) |

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- React 19.2 + Vite 7.3 + TailwindCSS 4.x: 호환성 확인됨
- react-resizable-panels 2.x: React 18/19 지원
- Canvas 2D + React: useRef/useEffect 패턴으로 통합

**Pattern Consistency:**
- 네이밍: PascalCase 컴포넌트, camelCase 변수/함수
- 파일: 컴포넌트와 동일 이름 (.tsx)
- 좌표계: 모든 곳에서 Y-up 일관 적용

**Structure Alignment:**
- src/components/ 구조가 3패널 레이아웃과 일치
- hooks/가 상태 관리 패턴 지원
- utils/가 렌더링 로직 분리 지원

### Requirements Coverage Validation ✅

**Epic 7 FR Coverage:**

| FR | 아키텍처 지원 | 위치 |
|----|-------------|------|
| FR31 | ✅ | App.tsx (react-resizable-panels) |
| FR32 | ✅ | usePanelSizes hook |
| FR33 | ✅ | LayerPanel/LayerTree.tsx |
| FR34 | ✅ | LayerPanel/LayerItem.tsx |
| FR35 | ✅ | useSelection hook |
| FR36 | ✅ | selection.json hidden_entities |
| FR37 | ✅ | selection.json locked_entities |
| FR38 | ✅ | Canvas/SketchOverlay.tsx |
| FR39 | ✅ | capture_viewport (기존 cad-tools) |
| FR40 | ✅ | viewer/ 단일 소스 구조 |

**NFR Coverage:**

| NFR | 아키텍처 지원 |
|-----|-------------|
| NFR18 (60fps) | ✅ React.memo, requestAnimationFrame |
| NFR19 (렌더링 동등) | ✅ 기존 renderer.js 로직 포팅 |
| NFR20 (웹/Electron 동등) | ✅ 단일 소스, Vite/dist 로드 |

### Implementation Readiness ✅

**체크리스트:**

- [x] Tech stack 버전 확정 (웹 검색 확인)
- [x] 프로젝트 구조 완전 정의
- [x] 컴포넌트 경계 명확
- [x] 상태 관리 패턴 정의
- [x] Canvas 렌더링 패턴 정의
- [x] Electron 통합 방식 정의

### Gap Analysis

**Critical Gaps:** 없음

**Minor Gaps (Post-MVP):**
- Grid Overlay 상세 설계 (capture_viewport --grid)
- 키보드 단축키 목록 정의

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
1. 기존 ADR과 일관된 좌표계/변환 순서
2. 파일 기반 통신으로 복잡도 최소화
3. 단일 소스로 웹/Electron 코드 중복 제거

**First Implementation Priority:**
```bash
cd viewer
npm init -y
npm install react react-dom react-resizable-panels
npm install -D @vitejs/plugin-react typescript vite tailwindcss
```
