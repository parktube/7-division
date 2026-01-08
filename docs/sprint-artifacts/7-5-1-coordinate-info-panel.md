# Story 7.5.1: Info Panel 좌표 토글

Status: done

> **✅ 아키텍처 재설계 완료**: "Dumb View" 원칙에 따라 Viewer는 scene.json의
> computed 필드에서 읽기만 합니다. WASM이 모든 bounds 계산을 담당합니다.
> MAMA Decision: `cad:viewer_dumb_view_architecture`

## Story

As a **사용자**,
I want **Info Panel에서 로컬 좌표와 월드 좌표를 토글하여 볼 수 있기를**,
so that **엔티티의 실제 위치와 그룹 내 상대 위치를 모두 확인할 수 있다** (FR41).

## Background

그룹 시스템에서 로컬 좌표만 표시되면 혼란 발생:
- 스케치는 World 좌표로 그려짐
- get_entity는 로컬 좌표 반환
- 사용자/LLM이 "내가 본 위치"와 "시스템이 보여주는 위치"가 다름

해결: Info Panel에 Local/World 토글 추가, 기본값 World.

## Architecture Principle: "Dumb View"

```
Viewer는 계산하지 않는다. scene.json에서 읽기만 한다.

❌ calculateWorldBounds(entity, entityMap)  // Viewer에서 계산 금지
✅ entity.computed.world_bounds              // scene.json에서 읽기
```

**구현 방향:**
1. WASM export_json()이 computed 필드 포함하도록 수정
2. Viewer는 entity.computed.world_bounds / local_bounds 읽기만
3. calculateBounds.ts, buildTree.ts 삭제

## Acceptance Criteria

1. **AC1**: Info Panel에 "Local / World" 토글 버튼 표시
2. **AC2**: 기본값은 World (화면에 보이는 좌표)
3. **AC3**: World 모드에서 worldBounds 표시 (min/max)
4. **AC4**: Local 모드에서 로컬 좌표 + 부모 그룹 이름 표시
5. **AC5**: 루트 엔티티(그룹 없음)는 World/Local 동일하게 표시
6. **AC6**: [Bug Fix] 그룹 자식 선택 시 선택 점선이 월드 좌표로 표시됨

## Tasks / Subtasks

### Phase 1: WASM/scene.json 수정 (Backend)

- [x] Task 0: WASM export_json() computed 필드 추가 ✅
  - [x] entity.computed.world_bounds: { min: [x, y], max: [x, y] }
  - [x] entity.computed.local_bounds: { min: [x, y], max: [x, y] }
  - [x] entity.computed.center: [x, y]
  - [x] entity.computed.size: [w, h]
  - [x] 기존 get_world_bounds_internal() 로직 활용
  - [x] scene.json에 tree 필드 추가 (LayerPanel용 pre-computed tree)

### Phase 2: Viewer UI 수정

- [x] Task 1: 좌표계 토글 UI (AC: #1, #2) ✅ 유지
  - [x] SegmentedControl 또는 토글 버튼 컴포넌트
  - [x] coordinateSpace 상태: 'world' | 'local'
  - [x] 기본값 'world' 설정

- [x] Task 2: World 좌표 표시 (AC: #3) ✅
  - [x] entity.computed.world_bounds 사용
  - [x] entity.computed.center, entity.computed.size 사용 (WASM 제공)

- [x] Task 3: Local 좌표 표시 (AC: #4) ✅
  - [x] entity.computed.local_bounds 사용
  - [x] parent 정보 표시 (있는 경우)
  - [x] "Parent: group_name" 레이블

- [x] Task 4: 루트 엔티티 처리 (AC: #5) ✅ 유지
  - [x] parent가 없으면 "Root entity (World = Local)" 표시
  - [x] 토글은 활성화 상태 유지 (동일 값 표시)

- [x] Task 5: [Bug Fix] 선택 점선 월드 좌표 수정 (AC: #6) ✅
  - [x] Canvas에서 computed.world_bounds 읽기
  - [x] 그룹 자식 선택 시 올바른 위치에 점선 표시

### Phase 3: 정리

- [x] Task 6: 레거시 코드 삭제 ✅
  - [x] calculateBounds.ts 삭제
  - [x] calculateBounds.test.ts 삭제
  - [x] buildTree.ts 삭제 (scene.json에 tree 필드 추가됨)
  - 모든 계산은 Rust에서 수행, Viewer는 읽기만

## Dev Notes

### 의존성

- Story 7.2.3: 엔티티 단일 선택 (선택 시 Info Panel 표시)
- **WASM**: export_json()이 computed 필드 포함해야 함 (Phase 1 선행 필수)

### UI 디자인

```
┌─────────────────────────────┐
│ Info Panel                  │
├─────────────────────────────┤
│ Name: house1_wall           │
│ Type: Rect                  │
│ Parent: house1              │
├─────────────────────────────┤
│ Coordinates  [World ▼ Local]│
├─────────────────────────────┤
│ Bounds:                     │
│   min: (-145, 10)           │
│   max: (-95, 50)            │
│ Center: (-120, 30)          │
│ Size: 50 × 40               │
└─────────────────────────────┘
```

### scene.json Entity 형식 (목표)

```typescript
// scene.json의 entity 구조
{
  id: "house1_wall",
  entity_type: "Rect",
  parent_id: "house1",
  geometry: { Rect: { center: [0, 20], width: 50, height: 40 } },
  transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
  // ✅ WASM이 계산해서 넣어주는 필드 (Rust 테스트 포함)
  computed: {
    world_bounds: { min: [-145, 10], max: [-95, 50] },
    local_bounds: { min: [-25, 0], max: [25, 40] },
    center: [-120, 30],
    size: [50, 40]
  }
}

// Viewer에서 사용 - 읽기만, 계산 금지
const { world_bounds, center, size } = entity.computed;
```

## Testing Checklist

- [x] 토글 클릭 시 좌표 전환 확인
- [x] 그룹 내 엔티티: World/Local 값이 다름 확인 (house1_wall: World min=(-145,10), Local min=(-25,0))
- [x] 루트 엔티티: World/Local 값이 동일 확인 (h1_grid_window_group)
- [x] 기본값 World 확인
- [x] [Bug] 그룹 자식 선택 시 점선이 실제 위치에 표시되는지 확인
- [x] [Bug] translate된 그룹 내 엔티티 선택 시 점선 위치 정확성 확인 (house1 translate=(-120,10))
