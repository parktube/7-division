# ADR-001: Group System

**상태**: 완료

## Context

스켈레톤 포즈 변경을 위해 팔/다리 등을 그룹으로 관리해야 함.

## Decision

Entity 타입에 Group 추가, parent_id 필드로 계층 구조 표현.

```rust
pub enum EntityType {
    Line, Circle, Rect, Arc, Polygon, Bezier,
    Group,
}

pub struct Entity {
    pub parent_id: Option<String>,
    pub children: Vec<String>,
}
```

## API

```typescript
createGroup(name, children[])
addToGroup(group, entity)
```

## Consequences

- 그룹 중첩 지원
- Cascade Delete: `delete(group)` 시 자식도 삭제
- 자식 독립: `ungroup()` 후 삭제

## 관련 코드

- `cad-engine/src/scene/entity.rs`
- `cad-tools/src/commands/`
