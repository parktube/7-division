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
// 그룹 생성 - children은 Entity ID 배열
createGroup(name: string, children: string[]): void

// 그룹에 엔티티 추가
addToGroup(groupName: string, entityName: string): void

// 그룹 해제 - 자식들을 최상위로 이동
ungroup(groupName: string): string[]  // 반환: 해제된 자식 ID들
```

## Consequences

- 그룹 중첩 지원
- Cascade Delete: `delete(group)` 시 자식도 삭제
- 자식 독립: `ungroup()` 후 삭제

## 관련 코드

- `cad-engine/src/scene/entity.rs`
- `cad-tools/src/commands/`
