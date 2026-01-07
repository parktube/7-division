# Story 7.2.5: selection.json 연동

Status: done

## Story

As a **LLM**,
I want **사용자가 선택한 엔티티 목록이 selection.json에 저장되기를**,
so that **get_selection 명령으로 컨텍스트를 받을 수 있다**.

## Acceptance Criteria

1. **AC1**: 선택된 엔티티 이름 배열이 selection.json에 저장
2. **AC2**: 선택 변경 즉시 파일 업데이트
3. **AC3**: 웹과 Electron 모두에서 동작
4. **AC4**: selection.json 포맷 기존 호환 유지
5. **AC5**: 타임스탬프 필드 포함

## Tasks / Subtasks

- [x] Task 1: Selection 타입 정의 (AC: #4)
  - [x] src/types/selection.ts 생성
  - [x] 기존 포맷 호환 인터페이스

- [x] Task 2: 웹 저장 (Vite middleware) (AC: #3)
  - [x] POST /selection.json 핸들러
  - [x] JSON 파싱 및 파일 저장

- [x] Task 3: Electron 저장 (Preload API) (AC: #3)
  - [x] isElectron() 플랫폼 감지
  - [x] cadAPI 인터페이스 정의 (Electron 미구현)

- [x] Task 4: 자동 저장 구현 (AC: #2)
  - [x] useSelectionSync 훅 생성
  - [x] 디바운스 적용 (100ms)
  - [x] ID↔name 변환

- [x] Task 5: 타임스탬프 추가 (AC: #5)
  - [x] Date.now() 포함
  - [x] 저장 시 자동 갱신

## Dev Notes

### 의존성: Story 7-2-4, 7-1-6

- Story 7-2-4: 다중 선택
- Story 7-1-6: Electron 통합 (플랫폼 분기)

### selection.json 포맷

```typescript
// src/types/selection.ts
export interface Selection {
  selected_entities: string[];
  locked_entities?: string[];   // Story 7-3-2에서 추가
  hidden_entities?: string[];   // Story 7-3-1에서 추가
  timestamp: number;
}

// 기본값
export const DEFAULT_SELECTION: Selection = {
  selected_entities: [],
  timestamp: 0,
};
```

[Source: docs/architecture.md#파일 통신 확장]

### 저장 함수 (플랫폼 분기)

```typescript
// src/utils/selectionIO.ts
import { Selection } from '@/types/selection';
import { isElectron } from './platform';

export async function saveSelection(selection: Selection): Promise<void> {
  const data = {
    ...selection,
    timestamp: Date.now(),
  };

  if (isElectron()) {
    // Electron: Preload API 사용
    window.cadAPI?.writeSelection(data);
  } else {
    // 웹: Vite middleware POST
    await fetch('/selection.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    });
  }
}

export async function loadSelection(): Promise<Selection> {
  if (isElectron()) {
    return window.cadAPI?.readSelection() ?? DEFAULT_SELECTION;
  } else {
    try {
      const res = await fetch('/selection.json');
      if (!res.ok) return DEFAULT_SELECTION;
      return await res.json();
    } catch {
      return DEFAULT_SELECTION;
    }
  }
}
```

### Vite Middleware

```typescript
// viewer/vite.config.ts
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'selection-middleware',
      configureServer(server) {
        server.middlewares.use('/selection.json', (req, res, next) => {
          const filePath = path.join(__dirname, 'selection.json');

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                // JSON 유효성 검사
                JSON.parse(body);
                fs.writeFileSync(filePath, body, 'utf-8');
                res.statusCode = 200;
                res.end('OK');
              } catch (e) {
                res.statusCode = 400;
                res.end('Invalid JSON');
              }
            });
          } else if (req.method === 'GET') {
            // 기존 정적 파일 서빙으로 위임
            next();
          } else {
            next();
          }
        });
      },
    },
  ],
});
```

### useSelection 자동 저장

```typescript
// src/hooks/useSelection.ts
import { useEffect, useRef } from 'react';
import { saveSelection } from '@/utils/selectionIO';
import { debounce } from '@/utils/debounce';

export function useSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 디바운스된 저장 함수
  const debouncedSave = useRef(
    debounce((ids: string[]) => {
      saveSelection({
        selected_entities: ids,
        timestamp: Date.now(),
      });
    }, 100)
  ).current;

  // 선택 변경 시 자동 저장
  useEffect(() => {
    debouncedSave(Array.from(selectedIds));
  }, [selectedIds, debouncedSave]);

  // ... 나머지 로직
}
```

### 디바운스 유틸

```typescript
// src/utils/debounce.ts
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
```

### 초기 로드

```typescript
// src/hooks/useSelection.ts
export function useSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // 초기 selection.json 로드
  useEffect(() => {
    loadSelection().then((data) => {
      if (data.selected_entities.length > 0) {
        setSelectedIds(new Set(data.selected_entities));
      }
      setIsLoaded(true);
    });
  }, []);

  // 로드 전에는 저장하지 않음
  useEffect(() => {
    if (!isLoaded) return;
    debouncedSave(Array.from(selectedIds));
  }, [selectedIds, isLoaded, debouncedSave]);

  // ...
}
```

### selection.json 예시

```json
{
  "selected_entities": [
    "circle_1",
    "rect_2",
    "group_3"
  ],
  "timestamp": 1704499200000
}
```

### LLM 연동 (get_selection)

```bash
# cad-tools에서 selection.json 읽기
npx tsx cad-cli.ts get_selection
# → ["circle_1", "rect_2", "group_3"]
```

### Anti-Patterns (금지)

```typescript
// ❌ 선택 변경마다 즉시 저장 (디바운스 없음)
useEffect(() => {
  saveSelection(selectedIds);  // 빠른 클릭 시 과도한 I/O
}, [selectedIds]);

// ❌ 저장 실패 무시
await fetch('/selection.json', { method: 'POST' });
// 에러 핸들링 필요

// ❌ 플랫폼 하드코딩
if (true) {  // isElectron() 대신
  window.cadAPI.writeSelection();
}
```

### References

- [docs/architecture.md#파일 통신 확장] - selection.json 포맷
- [docs/architecture.md#Integration Points] - Vite middleware
- CLAUDE.md - get_selection 명령어

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/types/selection.ts (new)
- src/utils/selectionIO.ts (new)
- src/utils/debounce.ts (new)
- src/hooks/useSelection.ts (modify)
- viewer/vite.config.ts (modify)
