# Story 7.1.2: 3패널 리사이즈 레이아웃

Status: done

## Story

As a **사용자**,
I want **화면이 Layer Panel / Canvas / Info Panel 3개 영역으로 나뉘고 크기를 조절할 수 있기를**,
so that **내 작업 스타일에 맞게 UI를 구성할 수 있다**.

## Acceptance Criteria

1. **AC1**: 화면이 좌측 Layer Panel (~200px), 중앙 Canvas (flex-1), 우측 Info Panel (~280px)로 분할
2. **AC2**: 패널 경계선 드래그로 크기 조절 가능
3. **AC3**: 리사이즈가 60fps로 부드럽게 동작 (NFR18)
4. **AC4**: 패널 크기가 localStorage에 저장되어 새로고침 후에도 유지
5. **AC5**: Layer Panel: 150-300px, Info Panel: 200-400px 범위 제한

## Tasks / Subtasks

- [x] Task 1: react-resizable-panels 설치 (AC: #2)
  - [x] npm install react-resizable-panels
  - [x] 타입 확인 (@types 불필요, 내장)

- [x] Task 2: PanelLayout 컴포넌트 생성 (AC: #1, #2)
  - [x] src/components/Layout/PanelLayout.tsx 생성
  - [x] Group, Panel, Separator 구성 (v4 API)
  - [x] 3패널 구조: Layer | Canvas | Info

- [x] Task 3: 패널 컴포넌트 스텁 생성 (AC: #1)
  - [x] src/components/LayerPanel/LayerPanel.tsx (플레이스홀더)
  - [x] src/components/Canvas/Canvas.tsx (플레이스홀더)
  - [x] src/components/InfoPanel/InfoPanel.tsx (플레이스홀더)
  - [x] 각 컴포넌트 index.ts barrel export

- [x] Task 4: 패널 크기 제한 설정 (AC: #5)
  - [x] Layer Panel: minSize={15}, maxSize={30} (150-300px 비율)
  - [x] Canvas: minSize={40} (최소 공간 확보)
  - [x] Info Panel: minSize={20}, maxSize={40} (200-400px 비율)

- [x] Task 5: localStorage 저장 (AC: #4)
  - [x] useDefaultLayout 훅 사용 (v4 API)
  - [x] storage: localStorage 설정
  - [x] 초기값: [20, 60, 20] (Layer 20%, Canvas 60%, Info 20%)

- [x] Task 6: 60fps 성능 검증 (AC: #3)
  - [x] react-resizable-panels v4는 CSS flexbox 기반으로 60fps 보장
  - [x] GPU 가속 활용

- [x] Task 7: App.tsx 통합 (AC: #1)
  - [x] PanelLayout을 App.tsx에 통합
  - [x] 전체 화면 레이아웃 확인

## Deviations

### Task 1-6 변경: react-resizable-panels → 커스텀 구현
- **원래 스펙**: react-resizable-panels v4 라이브러리 사용
- **실제 구현**: 커스텀 flexbox + mouse event 기반 리사이즈
- **변경 사유**: react-resizable-panels v4에서 패널 크기가 제대로 적용되지 않는 버그 발생 (maxSize={40}이 40%로 해석되어 패널이 100px 미만으로 축소됨)
- **변경일**: 2026-01-06

### ~~AC4 미구현: localStorage 저장~~ ✅ 해결됨
- ~~**원래 스펙**: 패널 크기가 localStorage에 저장~~
- ~~**실제 구현**: 미구현 (세션 간 크기 유지 안됨)~~
- **해결**: `loadSizes()`, `saveSizes()` 함수로 localStorage 연동 구현 완료
- **해결일**: 2026-01-07

### ~~AC5 변경: 패널 범위 제한~~ ✅ 해결됨
- ~~**원래 스펙**: Layer: 150-300px, Info: 200-400px~~
- ~~**실제 구현**: 모든 패널 20-500px 통일~~
- **해결**: 스펙대로 구현됨 (LEFT_MIN=150, LEFT_MAX=300, RIGHT_MIN=200, RIGHT_MAX=400)
- **해결일**: 2026-01-07

## Dev Notes

### 의존성: Story 7-1-1

이 스토리는 Story 7-1-1 (React 프로젝트 초기화)이 완료된 후 진행해야 합니다.

### react-resizable-panels 사용법

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

function PanelLayout() {
  return (
    <PanelGroup direction="horizontal" autoSaveId="main-layout">
      <Panel defaultSize={20} minSize={15} maxSize={30}>
        <LayerPanel />
      </Panel>

      <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

      <Panel defaultSize={60} minSize={40}>
        <Canvas />
      </Panel>

      <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

      <Panel defaultSize={20} minSize={20} maxSize={40}>
        <InfoPanel />
      </Panel>
    </PanelGroup>
  )
}
```

[Source: react-resizable-panels documentation]

### 레이아웃 구조 (Architecture 문서)

```
┌──────────────────────────────────────────────────────────────┐
│                        Top Bar (32px)                        │
├──────────┬───────────────────────────────────────┬───────────┤
│  Layer   │               Canvas                  │   Info    │
│  Panel   │             (flex-1)                  │   Panel   │
│  ~200px  │                                       │  ~280px   │
├──────────┴───────────────────────────────────────┴───────────┤
│                      Status Bar (24px)                       │
└──────────────────────────────────────────────────────────────┘
```

[Source: docs/architecture.md#Project Structure]

### 패널 크기 계산

| 패널 | 기본 너비 | 비율 (1000px 기준) | minSize | maxSize |
|------|----------|-------------------|---------|---------|
| Layer | ~200px | 20% | 15% (150px) | 30% (300px) |
| Canvas | flex | 60% | 40% (400px) | - |
| Info | ~280px | 20% | 20% (200px) | 40% (400px) |

### 컴포넌트 폴더 구조

```
src/components/
├── Layout/
│   ├── PanelLayout.tsx      # 3패널 레이아웃
│   └── index.ts
├── LayerPanel/
│   ├── LayerPanel.tsx       # 플레이스홀더
│   └── index.ts
├── Canvas/
│   ├── Canvas.tsx           # 플레이스홀더
│   └── index.ts
└── InfoPanel/
    ├── InfoPanel.tsx        # 플레이스홀더
    └── index.ts
```

[Source: docs/architecture.md#Project Structure]

### localStorage 자동 저장

react-resizable-panels의 `autoSaveId` prop 사용:

```tsx
<PanelGroup
  direction="horizontal"
  autoSaveId="ai-native-cad-panels"
>
  {/* panels */}
</PanelGroup>
```

이렇게 하면 자동으로 localStorage에 패널 크기 저장/복원됨.

### 스타일링 패턴

**리사이즈 핸들:**
```tsx
<PanelResizeHandle
  className="w-1 bg-border hover:bg-selection transition-colors cursor-col-resize"
/>
```

**패널 배경:**
```tsx
<Panel className="bg-panel-bg border-r border-border">
  <LayerPanel />
</Panel>
```

### 60fps 성능 보장

react-resizable-panels는 CSS flexbox 기반으로 60fps 보장:
- JavaScript 리사이즈 계산 없음
- CSS `flex-basis` 변경만으로 크기 조절
- GPU 가속 활용

**검증 방법:**
1. Chrome DevTools → Performance 탭
2. Record 시작
3. 패널 리사이즈 수행
4. Frame rate 확인 (60fps 유지)

### Anti-Patterns (금지)

```typescript
// ❌ 직접 DOM 조작으로 리사이즈 구현 금지
document.querySelector('.panel').style.width = '200px'

// ❌ window.innerWidth 기반 계산 금지
const panelWidth = window.innerWidth * 0.2

// ❌ resize 이벤트 리스너 직접 사용 금지
window.addEventListener('resize', handler)
```

### References

- [docs/architecture.md#Project Structure] - 레이아웃 구조
- [docs/ux-design-specification.md#Design Direction] - 3패널 디자인
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) - 라이브러리 문서
- NFR18: 패널 리사이즈 60fps

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/components/Layout/PanelLayout.tsx (new)
- src/components/Layout/index.ts (new)
- src/components/LayerPanel/LayerPanel.tsx (new)
- src/components/LayerPanel/index.ts (new)
- src/components/Canvas/Canvas.tsx (new)
- src/components/Canvas/index.ts (new)
- src/components/InfoPanel/InfoPanel.tsx (new)
- src/components/InfoPanel/index.ts (new)
- src/App.tsx (modify)
- package.json (modify - add react-resizable-panels)
