# Story 7.1.4: Canvas 씬 렌더링

Status: done

## Story

As a **사용자**,
I want **scene.json의 모든 도형이 Canvas에 정확히 렌더링되기를**,
so that **LLM이 생성한 CAD 결과물을 확인할 수 있다**.

## Acceptance Criteria

1. **AC1**: Circle, Rect, Line, Polygon, Arc, Bezier 6종 도형이 올바르게 렌더링
2. **AC2**: Group 엔티티의 자식들이 계층적으로 렌더링
3. **AC3**: Transform (translate, rotate, scale)이 정확히 적용
4. **AC4**: Fill, Stroke 스타일이 올바르게 적용
5. **AC5**: scene.json 변경 시 100ms 폴링으로 자동 갱신
6. **AC6**: 기존 바닐라 JS 렌더러와 동일한 품질 (NFR19)

## Tasks / Subtasks

- [x] Task 1: Scene 타입 정의 (AC: #1, #2)
  - [x] src/types/scene.ts 생성
  - [x] Entity, Scene, Geometry, Transform, Style 인터페이스 정의
  - [x] 도형 타입별 geometry 구조 정의

- [x] Task 2: useScene 훅 생성 (AC: #5)
  - [x] src/hooks/useScene.ts 생성
  - [x] 100ms 폴링으로 scene.json 로드
  - [x] isLoading, error 상태 관리
  - [x] 파일 변경 감지 (timestamp 비교)

- [x] Task 3: 렌더링 유틸리티 (AC: #1, #4)
  - [x] src/utils/renderEntity.ts 생성
  - [x] renderCircle, renderRect, renderLine 구현
  - [x] renderPolygon, renderArc, renderBezier 구현
  - [x] applyStyle 헬퍼 (fill, stroke)

- [x] Task 4: Transform 처리 (AC: #3)
  - [x] src/utils/transform.ts 생성
  - [x] applyTransform: translate → rotate → scale 순서 적용
  - [x] Y-up 좌표계 변환 (Canvas는 Y-down)

- [x] Task 5: Group 렌더링 (AC: #2, #3)
  - [x] renderGroup: 자식 엔티티 재귀 렌더링
  - [x] 그룹 transform이 자식에게 전파
  - [x] z-order 기반 정렬 (기본값: 0)

- [x] Task 6: Canvas 컴포넌트 (AC: #6)
  - [x] src/components/Canvas/Canvas.tsx 리팩터링
  - [x] useRef + useEffect로 Canvas 2D 렌더링
  - [x] 전체 씬 렌더링 함수 (renderScene)

- [x] Task 7: 동작 검증 (AC: #6)
  - [x] 기존 viewer/legacy/renderer.js와 비교
  - [x] 복잡한 씬 (그룹 중첩, 다양한 도형) 테스트
  - [x] 변환 정확도 검증

## Dev Notes

### 의존성: Story 7-1-1, 7-1-2

- Story 7-1-1: React 프로젝트 초기화
- Story 7-1-2: 3패널 레이아웃

### Scene 타입 구조

```typescript
// src/types/scene.ts
export interface Point {
  x: number;
  y: number;
}

export interface Transform {
  translate: [number, number];
  rotate: number;  // 라디안
  scale: [number, number];
  pivot?: [number, number];
}

export interface Style {
  fill?: {
    color: [number, number, number, number];  // RGBA, 0~1
  };
  stroke?: {
    color: [number, number, number, number];
    width: number;
  };
}

// 도형별 Geometry
export interface CircleGeometry {
  center: [number, number];
  radius: number;
}

export interface RectGeometry {
  origin: [number, number];  // 좌하단
  width: number;
  height: number;
}

export interface LineGeometry {
  points: number[];  // [x1, y1, x2, y2, ...]
}

export interface PolygonGeometry {
  points: number[];  // [x1, y1, x2, y2, ...]
}

export interface ArcGeometry {
  center: [number, number];
  radius: number;
  start_angle: number;
  end_angle: number;
}

export interface BezierGeometry {
  points: number[];
  closed: boolean;
}

export interface GroupData {
  children: string[];
}

export type EntityType = 'Circle' | 'Rect' | 'Line' | 'Polygon' | 'Arc' | 'Bezier' | 'Group';

export interface Entity {
  id: string;
  type: EntityType;
  geometry?: CircleGeometry | RectGeometry | LineGeometry | PolygonGeometry | ArcGeometry | BezierGeometry;
  group_data?: GroupData;
  transform: Transform;
  style: Style;
  z_order?: number;
}

export interface Scene {
  entities: Entity[];
}
```

[Source: docs/architecture.md#Format Patterns]

### useScene 훅 구현

```typescript
// src/hooks/useScene.ts
const POLLING_INTERVAL = 100;  // ms

export function useScene() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastModified = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchScene = async () => {
      try {
        const res = await fetch('/scene.json', { cache: 'no-store' });
        const modified = res.headers.get('Last-Modified');

        // 변경된 경우에만 업데이트
        if (modified !== lastModified.current) {
          const data = await res.json();
          if (mounted) {
            setScene(data);
            lastModified.current = modified;
            setIsLoading(false);
          }
        }
      } catch (e) {
        console.warn('scene.json fetch failed:', e);
      }
    };

    // 초기 로드
    fetchScene();

    // 폴링
    const interval = setInterval(fetchScene, POLLING_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { scene, isLoading, error };
}
```

[Source: docs/architecture.md#상태 관리]

### 렌더링 순서 (필수!)

**좌표 변환 (Y-up):**
```typescript
function setupCanvas(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas;

  // Y축 뒤집기 (Y-up으로 변환)
  ctx.translate(width / 2, height / 2);  // 원점을 중앙으로
  ctx.scale(1, -1);  // Y축 반전
}
```

**Transform 적용 순서 (translate → rotate → scale):**
```typescript
function applyTransform(ctx: CanvasRenderingContext2D, transform: Transform) {
  const [tx, ty] = transform.translate;
  const [sx, sy] = transform.scale;
  const rotation = transform.rotate;
  const pivot = transform.pivot || [0, 0];

  ctx.save();

  // 1. Pivot으로 이동
  ctx.translate(pivot[0], pivot[1]);

  // 2. Transform 적용 (TRS 순서)
  ctx.translate(tx, ty);
  ctx.rotate(rotation);
  ctx.scale(sx, sy);

  // 3. Pivot 복귀
  ctx.translate(-pivot[0], -pivot[1]);
}
```

[Source: docs/architecture.md#Canvas 렌더링 패턴, ADR-002-pivot-system]

### 도형별 렌더링 함수

```typescript
// src/utils/renderEntity.ts
export function renderCircle(ctx: CanvasRenderingContext2D, geometry: CircleGeometry) {
  const [cx, cy] = geometry.center;
  ctx.beginPath();
  ctx.arc(cx, cy, geometry.radius, 0, Math.PI * 2);
  ctx.closePath();
}

export function renderRect(ctx: CanvasRenderingContext2D, geometry: RectGeometry) {
  const [x, y] = geometry.origin;  // 좌하단
  ctx.beginPath();
  ctx.rect(x, y, geometry.width, geometry.height);
  ctx.closePath();
}

export function renderLine(ctx: CanvasRenderingContext2D, geometry: LineGeometry) {
  const points = geometry.points;
  if (points.length < 4) return;

  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1]);
  }
}

export function renderPolygon(ctx: CanvasRenderingContext2D, geometry: PolygonGeometry) {
  const points = geometry.points;
  if (points.length < 6) return;

  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1]);
  }
  ctx.closePath();
}

export function renderArc(ctx: CanvasRenderingContext2D, geometry: ArcGeometry) {
  const [cx, cy] = geometry.center;
  ctx.beginPath();
  ctx.arc(cx, cy, geometry.radius, geometry.start_angle, geometry.end_angle);
}

export function renderBezier(ctx: CanvasRenderingContext2D, geometry: BezierGeometry) {
  const points = geometry.points;
  if (points.length < 8) return;

  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);

  // 첫 2개는 시작점, 이후 6개씩 세그먼트
  for (let i = 2; i < points.length; i += 6) {
    ctx.bezierCurveTo(
      points[i], points[i + 1],       // cp1
      points[i + 2], points[i + 3],   // cp2
      points[i + 4], points[i + 5]    // end
    );
  }

  if (geometry.closed) {
    ctx.closePath();
  }
}
```

### 스타일 적용

```typescript
function applyStyle(ctx: CanvasRenderingContext2D, style: Style) {
  if (style.fill) {
    const [r, g, b, a] = style.fill.color;
    ctx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
    ctx.fill();
  }

  if (style.stroke) {
    const [r, g, b, a] = style.stroke.color;
    ctx.strokeStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
    ctx.lineWidth = style.stroke.width;
    ctx.stroke();
  }
}
```

### Group 렌더링 (재귀)

```typescript
function renderScene(ctx: CanvasRenderingContext2D, scene: Scene) {
  // entityMap 구축 (빠른 조회)
  const entityMap = new Map<string, Entity>();
  scene.entities.forEach(e => entityMap.set(e.id, e));

  // z-order 기준 정렬 (낮은 값 먼저)
  const sortedEntities = [...scene.entities]
    .filter(e => !e.group_data)  // 그룹의 자식은 제외
    .sort((a, b) => (a.z_order ?? 0) - (b.z_order ?? 0));

  for (const entity of sortedEntities) {
    renderEntity(ctx, entity, entityMap);
  }
}

function renderEntity(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  entityMap: Map<string, Entity>
) {
  ctx.save();
  applyTransform(ctx, entity.transform);

  if (entity.type === 'Group' && entity.group_data) {
    // 자식 엔티티 렌더링 (z-order 순)
    const children = entity.group_data.children
      .map(id => entityMap.get(id))
      .filter(Boolean)
      .sort((a, b) => (a!.z_order ?? 0) - (b!.z_order ?? 0));

    for (const child of children) {
      renderEntity(ctx, child!, entityMap);
    }
  } else if (entity.geometry) {
    // 도형 렌더링
    switch (entity.type) {
      case 'Circle':
        renderCircle(ctx, entity.geometry as CircleGeometry);
        break;
      case 'Rect':
        renderRect(ctx, entity.geometry as RectGeometry);
        break;
      // ... 다른 도형들
    }
    applyStyle(ctx, entity.style);
  }

  ctx.restore();
}
```

### Canvas 컴포넌트 구조

```tsx
// src/components/Canvas/Canvas.tsx
export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scene, isLoading } = useScene();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas 크기 설정 (부모 크기에 맞춤)
    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resizeCanvas();

    // 렌더링
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setupCanvas(ctx);
    renderScene(ctx, scene);
  }, [scene]);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex-1 relative bg-canvas">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
```

### z-order 기본값과 조회

```typescript
// z_order 필드가 없으면 기본값 0 사용
const zOrder = entity.z_order ?? 0;

// 정렬: 낮은 값이 먼저 (뒤에), 높은 값이 나중에 (앞에)
entities.sort((a, b) => (a.z_order ?? 0) - (b.z_order ?? 0));
```

[Source: CLAUDE.md - setZOrder 섹션]

### Anti-Patterns (금지)

```typescript
// ❌ 잘못된 변환 순서
ctx.scale(sx, sy);
ctx.rotate(rotation);
ctx.translate(tx, ty);

// ❌ Y-down 가정 (Canvas 좌표 직접 사용)
ctx.arc(x, canvas.height - y, radius, 0, Math.PI * 2);

// ❌ 전체 씬 매번 fetch (변경 감지 없음)
setInterval(async () => {
  const data = await fetch('/scene.json').then(r => r.json());
  setScene(data);  // 매번 re-render 발생
}, 100);
```

### References

- [docs/architecture.md#Canvas 렌더링 패턴] - 변환 순서
- [docs/adr/005-coordinate-system.md] - Y-up 좌표계
- [docs/adr/002-pivot-system.md] - Pivot 시스템
- [viewer/legacy/renderer.js] - 기존 렌더러 (포팅 참고)
- NFR19: 렌더링 동등성

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- src/types/scene.ts (new)
- src/hooks/useScene.ts (new)
- src/utils/renderEntity.ts (new)
- src/utils/transform.ts (new)
- src/components/Canvas/Canvas.tsx (modify)
