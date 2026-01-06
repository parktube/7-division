# Story 7.5.2: 이중 좌표 API

Status: ready-for-dev

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

- [ ] Task 1: get_entity 응답 확장 (AC: #1)
  - [ ] Rust executor에서 world bounds 계산
  - [ ] 응답 JSON에 local/world 섹션 추가
  - [ ] TypeScript 타입 정의 업데이트

- [ ] Task 2: translate space 옵션 (AC: #2, #5)
  - [ ] Rust executor에 space 파라미터 추가
  - [ ] world: 현재 world 위치 기준 이동
  - [ ] local: 부모 좌표계 기준 이동
  - [ ] 기본값 'world'

- [ ] Task 3: rotate space 옵션 (AC: #3, #5)
  - [ ] world: 월드 축 기준 회전
  - [ ] local: 부모 축 기준 회전
  - [ ] 기본값 'world'

- [ ] Task 4: scale space 옵션 (AC: #4, #5)
  - [ ] world: 월드 기준 스케일
  - [ ] local: 부모 기준 스케일
  - [ ] 기본값 'world'

- [ ] Task 5: Sandbox 바인딩 업데이트 (AC: #2, #3, #4)
  - [ ] translate(name, dx, dy, options?) 시그니처
  - [ ] rotate(name, angle, options?) 시그니처
  - [ ] scale(name, sx, sy, options?) 시그니처

- [ ] Task 6: CLAUDE.md 문서화 (AC: #6)
  - [ ] space 옵션 설명 추가
  - [ ] 사용 예시 추가

## Dev Notes

### get_entity 응답 형식

```json
{
  "name": "house1_wall",
  "type": "Rect",
  "parent": "house1",
  "local": {
    "bounds": { "min": [-25, 0], "max": [25, 40] },
    "position": [-25, 0],
    "transform": { "translate": [0, 0], "rotate": 0, "scale": [1, 1] }
  },
  "world": {
    "bounds": { "min": [-145, 10], "max": [-95, 50] },
    "center": [-120, 30]
  }
}
```

### API 사용 예시

```javascript
// 스케치 위치에 맞춰 이동 (world 기준)
translate('window', 10, 0)  // 기본값 world
translate('window', 10, 0, { space: 'world' })

// 벽 기준 상대 이동 (local 기준)
translate('window', 5, 0, { space: 'local' })

// 회전
rotate('arm', 0.5)  // world 기준
rotate('arm', 0.5, { space: 'local' })  // 부모 기준
```

### Rust 변경 범위

- `cad-engine/src/commands/transform.rs`: space 파라미터 처리
- `cad-engine/src/commands/query.rs`: get_entity world bounds 추가
- Matrix 연산: world→local, local→world 변환

## Testing Checklist

- [ ] get_entity가 local/world 둘 다 반환
- [ ] translate world: 화면 기준 이동 확인
- [ ] translate local: 부모 기준 이동 확인
- [ ] 옵션 생략 시 world로 동작 확인
- [ ] 루트 엔티티: world/local 동일하게 동작
