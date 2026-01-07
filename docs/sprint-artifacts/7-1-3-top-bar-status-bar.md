# Story 7.1.3: Top Bar 및 Status Bar

Status: done

## Story

As a **사용자**,
I want **상단에 파일명과 토글 버튼이, 하단에 상태 정보가 표시되기를**,
so that **현재 작업 상태를 한눈에 파악할 수 있다**.

## Acceptance Criteria

1. **AC1**: Top Bar (32px)에 로고 "AI-Native CAD", 파일명 "scene.json" 표시
2. **AC2**: Top Bar에 Grid, Rulers, Sketch 토글 버튼 표시
3. **AC3**: Top Bar에 테마 전환 버튼 (다크/라이트) 동작
4. **AC4**: Status Bar (24px)에 모드 (Normal), 엔티티 수, 선택 수, 마우스 좌표, 줌 레벨 표시
5. **AC5**: Lucide 아이콘 사용

## Tasks / Subtasks

- [x] Task 1: Lucide React 설치 (AC: #5)
  - [x] npm install lucide-react
  - [x] 아이콘 테스트 import

- [x] Task 2: TopBar 컴포넌트 생성 (AC: #1, #2, #3)
  - [x] src/components/TopBar/TopBar.tsx 생성
  - [x] 좌측: 로고 + 파일명
  - [x] 중앙: Grid, Rulers, Sketch 토글
  - [x] 우측: 테마 토글, 설정 버튼

- [x] Task 3: 토글 버튼 컴포넌트 (AC: #2)
  - [x] src/components/TopBar/ToggleButton.tsx 생성
  - [x] active 상태에 따른 스타일링
  - [x] 아이콘 + 레이블 구조

- [x] Task 4: 테마 전환 구현 (AC: #3)
  - [x] useTheme 훅 생성 (dark/light)
  - [x] localStorage 저장
  - [x] prefers-color-scheme 기본값

- [x] Task 5: StatusBar 컴포넌트 생성 (AC: #4)
  - [x] src/components/StatusBar/StatusBar.tsx 생성
  - [x] 모드 표시 (Normal/Sketch)
  - [x] 엔티티 수 (플레이스홀더: 0)
  - [x] 선택 수 (플레이스홀더: 0)
  - [x] 마우스 좌표 (플레이스홀더: x: 0, y: 0)
  - [x] 줌 레벨 (플레이스홀더: 100%)

- [x] Task 6: 레이아웃 통합 (AC: #1, #4)
  - [x] App.tsx에 TopBar, StatusBar 추가
  - [x] 전체 레이아웃: TopBar | 3Panels | StatusBar

## Dev Notes

### 의존성: Story 7-1-1, 7-1-2

- Story 7-1-1: React 프로젝트 초기화
- Story 7-1-2: 3패널 레이아웃

### 레이아웃 구조

```
┌──────────────────────────────────────────────────────────────┐
│ 🔶 scene.json │ Grid ☑️ │ Rulers ☑️ │ ✏️ Sketch │  ☀️  ⚙️  │  ← TopBar (32px)
├──────────┬───────────────────────────────────────┬───────────┤
│  Layer   │               Canvas                  │   Info    │
│  Panel   │                                       │   Panel   │
├──────────┴───────────────────────────────────────┴───────────┤
│ Normal │ Entities: 47 │ Selected: 3 │ x: 120, y: -45 │ 100% │  ← StatusBar (24px)
└──────────────────────────────────────────────────────────────┘
```

[Source: docs/ux-design-specification.md#Design Direction]

### TopBar 구조

| 영역 | 내용 | 아이콘 |
|------|------|--------|
| 좌측 | 앱 로고 + scene.json | - |
| 중앙 | Grid, Rulers, Sketch 토글 | Grid3x3, Ruler, Pencil |
| 우측 | 테마, 설정 | Sun/Moon, Settings |

### StatusBar 구조

| 항목 | 표시 예 | 비고 |
|------|---------|------|
| Mode | Normal / Sketch | 볼드 처리 |
| Entities | Entities: 47 | scene 엔티티 수 |
| Selected | Selected: 3 | 선택된 수 |
| Coordinates | x: 120, y: -45 | 마우스 위치 |
| Zoom | 100% | 줌 레벨 |

### Lucide 아이콘 매핑

```tsx
import {
  Grid3x3,    // Grid 토글
  Ruler,      // Rulers 토글
  Pencil,     // Sketch 모드
  Sun,        // Light 테마
  Moon,       // Dark 테마
  Settings,   // 설정
  Layers,     // 엔티티 수
  CheckSquare // 선택 수
} from 'lucide-react'
```

### 테마 시스템

```tsx
// hooks/useTheme.ts
function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored as 'dark' | 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return { theme, toggle }
}
```

### TailwindCSS Dark Mode

```css
/* globals.css */
@import "tailwindcss";

/* 다크 모드 변수 */
:root {
  --bg-app: #1e1e1e;
  --bg-panel: #252526;
  --text-primary: #cccccc;
}

.light {
  --bg-app: #f5f5f5;
  --bg-panel: #ffffff;
  --text-primary: #1e1e1e;
}
```

### 컴포넌트 구조

```
src/components/
├── TopBar/
│   ├── TopBar.tsx
│   ├── ToggleButton.tsx
│   └── index.ts
├── StatusBar/
│   ├── StatusBar.tsx
│   └── index.ts
└── hooks/
    └── useTheme.ts
```

### TopBar 컴포넌트 예시

```tsx
// TopBar.tsx
export function TopBar() {
  const { theme, toggle } = useTheme()
  const [gridEnabled, setGridEnabled] = useState(true)
  const [rulersEnabled, setRulersEnabled] = useState(false)
  const [sketchMode, setSketchMode] = useState(false)

  return (
    <header className="h-8 bg-panel flex items-center justify-between px-3 border-b border-border">
      {/* 좌측: 로고 + 파일명 */}
      <div className="flex items-center gap-3">
        <span className="font-bold text-selection">AI-Native CAD</span>
        <span className="text-secondary text-sm">scene.json</span>
      </div>

      {/* 중앙: 토글 버튼 */}
      <div className="flex items-center gap-1">
        <ToggleButton icon={Grid3x3} label="Grid" active={gridEnabled} onClick={() => setGridEnabled(!gridEnabled)} />
        <ToggleButton icon={Ruler} label="Rulers" active={rulersEnabled} onClick={() => setRulersEnabled(!rulersEnabled)} />
        <ToggleButton icon={Pencil} label="Sketch" active={sketchMode} onClick={() => setSketchMode(!sketchMode)} />
      </div>

      {/* 우측: 테마, 설정 */}
      <div className="flex items-center gap-2">
        <button onClick={toggle} className="p-1 rounded hover:bg-hover">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="p-1 rounded hover:bg-hover">
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}
```

### StatusBar 컴포넌트 예시

```tsx
// StatusBar.tsx
interface StatusBarProps {
  mode: 'Normal' | 'Sketch'
  entityCount: number
  selectedCount: number
  mouseX: number
  mouseY: number
  zoom: number
}

export function StatusBar({ mode, entityCount, selectedCount, mouseX, mouseY, zoom }: StatusBarProps) {
  return (
    <footer className="h-6 bg-panel flex items-center gap-5 px-3 border-t border-border text-xs text-secondary">
      <span>MODE: <strong className="text-primary">{mode}</strong></span>
      <span className="flex items-center gap-1">
        <Layers size={12} />
        Entities: {entityCount}
      </span>
      <span className="flex items-center gap-1">
        <CheckSquare size={12} />
        Selected: {selectedCount}
      </span>
      <div className="flex-1" />
      <span>x: {mouseX.toFixed(0)}, y: {mouseY.toFixed(0)}</span>
      <span>{zoom}%</span>
    </footer>
  )
}
```

### Anti-Patterns (금지)

```typescript
// ❌ 인라인 스타일로 높이 지정 금지
<header style={{ height: '32px' }}>

// ❌ 하드코딩된 색상 금지
<header className="bg-[#252526]">

// ❌ 아이콘 라이브러리 혼용 금지 (Lucide만 사용)
import { FaGrid } from 'react-icons/fa'
```

### References

- [docs/ux-design-specification.md#Design Direction] - 레이아웃 구조
- [docs/ux-design-specification.md#Visual Design] - 색상, 아이콘
- [docs/ux-design-specification.md#Mode Patterns] - Normal/Sketch 표시
- [Lucide Icons](https://lucide.dev/icons/) - 아이콘 목록

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/components/TopBar/TopBar.tsx (new)
- src/components/TopBar/ToggleButton.tsx (new)
- src/components/TopBar/index.ts (new)
- src/components/StatusBar/StatusBar.tsx (new)
- src/components/StatusBar/index.ts (new)
- src/hooks/useTheme.ts (new)
- src/styles/globals.css (modify - add theme variables)
- src/App.tsx (modify)
- package.json (modify - add lucide-react)
