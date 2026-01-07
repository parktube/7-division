# Story 7.5.2: 이중 좌표 API

Status: done

## Story

As a **LLM**,
I want **get_entity가 로컬/월드 좌표를 모두 반환하고, 변환 API에서 좌표계를 선택할 수 있기를**,
so that **스케치 기반 작업과 그룹 내 상대적 조정을 명확히 구분할 수 있다** (FR42).

## Background

현재 문제:
- get_entity: 로컬 좌표만 반환 → LLM이 실제 위치 파악 어려움
- translate/rotate/scale: 암묵적으로 local 기준 → 스케치 워크플로우에서 혼란

해결:
- get_entity: local + world 둘 다 반환
- 변환 API: space 옵션으로 'world' | 'local' 선택
- 기본값: 'world' (스케치 워크플로우에 자연스러움)

## Acceptance Criteria

1. **AC1**: get_entity 응답에 local/world 좌표 모두 포함
2. **AC2**: translate에 space 옵션 추가 ('world' | 'local')
3. **AC3**: rotate에 space 옵션 추가
4. **AC4**: scale에 space 옵션 추가
5. **AC5**: 기본값 'world'로 동작
6. **AC6**: CLAUDE.md 문서 업데이트

## Tasks / Subtasks

- [x] Task 1: get_entity 응답 확장 (AC: #1)
  - [x] Rust `get_entity_detailed`에서 world bounds 계산 (기존 구현)
  - [x] 응답 JSON에 local/world 섹션 추가
  - [x] executor.ts에서 `get_entity_detailed` 사용

- [x] Task 2: translate space 옵션 (AC: #2, #5)
  - [x] executor.ts에 space 파라미터 처리
  - [x] world: `translate_world()` 호출 (부모 scale 역산)
  - [x] local: `translate()` 호출 (부모 좌표계 기준)
  - [x] 기본값 'world'

- [x] Task 3: rotate space 옵션 (AC: #3, #5)
  - [x] rotate는 world/local 동작이 동일 (각도는 스칼라)
  - [x] API 일관성을 위해 space 옵션 수용
  - [x] executor.ts 주석 정리

- [x] Task 4: scale space 옵션 (AC: #4, #5)
  - [x] executor.ts에 space 파라미터 처리
  - [x] world: `scale_world()` 호출 (부모 scale 역산)
  - [x] local: `scale()` 호출 (부모 기준)
  - [x] 기본값 'world'

- [x] Task 5: Sandbox 바인딩 업데이트 (AC: #2, #3, #4)
  - [x] translate(name, dx, dy, options?) 시그니처
  - [x] rotate(name, angle, options?) 시그니처
  - [x] scale(name, sx, sy, options?) 시그니처
  - [x] get_entity(name) 바인딩 추가

- [x] Task 6: CLAUDE.md 문서화 (AC: #6)
  - [x] space 옵션 설명 추가 (기존 구현 확인)
  - [x] 사용 예시 추가 (기존 구현 확인)

## Dev Notes

### get_entity 응답 형식 (실제)

```json
{
  "name": "c1",
  "type": "Circle",
  "parent": null,
  "local": {
    "geometry": { "Circle": { "center": [100, 50], "radius": 30 } },
    "transform": { "translate": [0, 0], "rotate": 0, "scale": [1, 1], "pivot": [100, 50] },
    "bounds": { "min": [70, 20], "max": [130, 80] },
    "pivot": [100, 50]
  },
  "world": {
    "bounds": { "min_x": 70, "min_y": 20, "max_x": 130, "max_y": 80 },
    "center": [100, 50]
  },
  "style": { ... },
  "z_order": 0
}
```

### API 사용 예시

```javascript
// 스케치 위치에 맞춰 이동 (world 기준)
translate('window', 10, 0)  // 기본값 world
translate('window', 10, 0, { space: 'world' })

// 벽 기준 상대 이동 (local 기준)
translate('window', 5, 0, { space: 'local' })

// 회전 (world/local 동작 동일)
rotate('arm', 0.5)  // world 기준
rotate('arm', 0.5, { space: 'local' })  // 부모 기준

// 스케일
scale('icon', 2, 2)  // world 기준
scale('icon', 2, 2, { space: 'local' })  // 부모 기준
```

### 구현 위치

- `cad-engine/src/scene/mod.rs`: `get_entity_detailed`, `translate_world`, `scale_world`
- `cad-tools/src/executor.ts`: space 파라미터 처리 및 WASM 함수 라우팅
- `cad-tools/src/sandbox/index.ts`: QuickJS 바인딩 (options 파라미터)

### rotate space 옵션 참고

회전 각도는 스칼라 값이므로 부모의 회전에 영향받지 않습니다.
- world rotate delta = local rotate delta
- API 일관성을 위해 space 옵션을 수용하지만, 내부적으로 동일하게 처리됩니다.

## Testing Checklist

- [x] get_entity가 local/world 둘 다 반환
- [x] translate world: 화면 기준 이동 확인 (parent scale 2x에서 world 10 이동 → local 5)
- [x] translate local: 부모 기준 이동 확인
- [x] scale world: parent scale 역산 확인 (parent 2x에서 world 1.5x → local 0.75x)
- [x] 옵션 생략 시 world로 동작 확인
- [x] 루트 엔티티: world/local 동일하게 동작
