import { describe, it, expect } from 'vitest'
import {
  getWorldTransform,
  calculateEntityBounds,
  calculateWorldBounds,
} from './calculateBounds'
import type { Entity } from '@/types/scene'

// Helper to create a minimal entity
function createEntity(
  id: string,
  overrides: Partial<Entity> = {}
): Entity {
  return {
    id,
    entity_type: 'Rect',
    geometry: { Rect: { origin: [0, 0], width: 10, height: 10 } },
    transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
    style: {},
    ...overrides,
  }
}

// Helper to create entity map
function createEntityMap(...entities: Entity[]): Map<string, Entity> {
  const map = new Map<string, Entity>()
  for (const e of entities) {
    map.set(e.id, e)
    if (e.metadata?.name) {
      map.set(e.metadata.name, e)
    }
  }
  return map
}

describe('getWorldTransform', () => {
  it('returns identity transform for root entity (no parents)', () => {
    const entity = createEntity('root')
    const entityMap = createEntityMap(entity)

    const result = getWorldTransform(entity, entityMap)

    // Root has no parents, so world transform is identity
    expect(result.translate).toEqual([0, 0])
    expect(result.scale).toEqual([1, 1])
  })

  it('returns identity for root even with own transform (only parents matter)', () => {
    const entity = createEntity('root', {
      transform: { translate: [100, 50], rotate: 0, scale: [1, 1] },
    })
    const entityMap = createEntityMap(entity)

    const result = getWorldTransform(entity, entityMap)

    // getWorldTransform returns PARENT transforms only, not entity's own
    expect(result.translate).toEqual([0, 0])
  })

  it('returns parent transform for child entity', () => {
    // Parent at (100, 50)
    // getWorldTransform for child should return parent's transform
    const parent = createEntity('parent', {
      transform: { translate: [100, 50], rotate: 0, scale: [1, 1] },
      entity_type: 'Group',
      geometry: 'Empty',
      children: ['child'],
    })
    const child = createEntity('child', {
      transform: { translate: [10, 20], rotate: 0, scale: [1, 1] },
      parent_id: 'parent',
    })
    const entityMap = createEntityMap(parent, child)

    const result = getWorldTransform(child, entityMap)

    // Only parent's transform, not child's
    expect(result.translate).toEqual([100, 50])
  })

  it('returns parent scale for child entity', () => {
    // Parent scaled 2x
    const parent = createEntity('parent', {
      transform: { translate: [0, 0], rotate: 0, scale: [2, 2] },
      entity_type: 'Group',
      geometry: 'Empty',
      children: ['child'],
    })
    const child = createEntity('child', {
      transform: { translate: [10, 10], rotate: 0, scale: [1, 1] },
      parent_id: 'parent',
    })
    const entityMap = createEntityMap(parent, child)

    const result = getWorldTransform(child, entityMap)

    // Parent's transform only
    expect(result.translate).toEqual([0, 0])
    expect(result.scale).toEqual([2, 2])
  })

  it('accumulates grandparent and parent transforms for deeply nested', () => {
    // grandparent at (100, 0)
    // parent at local (50, 0)
    // For child, world transform = grandparent + parent = (150, 0)
    const grandparent = createEntity('grandparent', {
      transform: { translate: [100, 0], rotate: 0, scale: [1, 1] },
      entity_type: 'Group',
      geometry: 'Empty',
      children: ['parent'],
    })
    const parent = createEntity('parent', {
      transform: { translate: [50, 0], rotate: 0, scale: [1, 1] },
      entity_type: 'Group',
      geometry: 'Empty',
      children: ['child'],
      parent_id: 'grandparent',
    })
    const child = createEntity('child', {
      transform: { translate: [25, 0], rotate: 0, scale: [1, 1] },
      parent_id: 'parent',
    })
    const entityMap = createEntityMap(grandparent, parent, child)

    const result = getWorldTransform(child, entityMap)

    // grandparent + parent transforms
    expect(result.translate).toEqual([150, 0])
  })
})

describe('calculateEntityBounds', () => {
  it('calculates Rect bounds correctly', () => {
    const entity = createEntity('rect', {
      geometry: { Rect: { origin: [-25, 0], width: 50, height: 40 } },
      transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
    })

    const bounds = calculateEntityBounds(entity)

    expect(bounds).toEqual({
      minX: -25,
      minY: 0,
      maxX: 25,
      maxY: 40,
    })
  })

  it('calculates Circle bounds correctly', () => {
    const entity = createEntity('circle', {
      entity_type: 'Circle',
      geometry: { Circle: { center: [0, 0], radius: 50 } },
      transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
    })

    const bounds = calculateEntityBounds(entity)

    expect(bounds).toEqual({
      minX: -50,
      minY: -50,
      maxX: 50,
      maxY: 50,
    })
  })

  it('applies transform to bounds', () => {
    const entity = createEntity('rect', {
      geometry: { Rect: { origin: [0, 0], width: 10, height: 10 } },
      transform: { translate: [100, 50], rotate: 0, scale: [1, 1] },
    })

    const bounds = calculateEntityBounds(entity)

    expect(bounds).toEqual({
      minX: 100,
      minY: 50,
      maxX: 110,
      maxY: 60,
    })
  })

  it('applies scale to bounds', () => {
    const entity = createEntity('rect', {
      geometry: { Rect: { origin: [0, 0], width: 10, height: 10 } },
      transform: { translate: [0, 0], rotate: 0, scale: [2, 3] },
    })

    const bounds = calculateEntityBounds(entity)

    expect(bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 30,
    })
  })

  it('returns null for Empty geometry', () => {
    const entity = createEntity('group', {
      entity_type: 'Group',
      geometry: 'Empty',
    })

    const bounds = calculateEntityBounds(entity)

    expect(bounds).toBeNull()
  })

  it('calculates Group bounds from children', () => {
    const parent = createEntity('group', {
      entity_type: 'Group',
      geometry: 'Empty',
      transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
      children: ['child1', 'child2'],
    })
    const child1 = createEntity('child1', {
      geometry: { Rect: { origin: [0, 0], width: 10, height: 10 } },
      transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
      parent_id: 'group',
    })
    const child2 = createEntity('child2', {
      geometry: { Rect: { origin: [20, 20], width: 10, height: 10 } },
      transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
      parent_id: 'group',
    })
    const entityMap = createEntityMap(parent, child1, child2)

    const bounds = calculateEntityBounds(parent, entityMap)

    expect(bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 30,
      maxY: 30,
    })
  })
})

describe('calculateWorldBounds', () => {
  it('returns same as local bounds for root entity', () => {
    const entity = createEntity('root', {
      geometry: { Rect: { origin: [-25, 0], width: 50, height: 40 } },
      transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
    })
    const entityMap = createEntityMap(entity)

    const worldBounds = calculateWorldBounds(entity, entityMap)
    const localBounds = calculateEntityBounds(entity)

    expect(worldBounds).toEqual(localBounds)
  })

  it('applies parent transform to child bounds', () => {
    // This is the house1_wall test case
    // Parent (house1) at translate (-120, 10)
    // Child (wall) local origin (-25, 0), size 50x40
    // Expected world: min (-145, 10), max (-95, 50)
    const parent = createEntity('house1', {
      entity_type: 'Group',
      geometry: 'Empty',
      transform: { translate: [-120, 10], rotate: 0, scale: [1, 1] },
      children: ['house1_wall'],
      metadata: { name: 'house1' },
    })
    const child = createEntity('house1_wall', {
      geometry: { Rect: { origin: [-25, 0], width: 50, height: 40 } },
      transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
      parent_id: 'house1',
      metadata: { name: 'house1_wall' },
    })
    const entityMap = createEntityMap(parent, child)

    const bounds = calculateWorldBounds(child, entityMap)

    expect(bounds).toEqual({
      minX: -145,
      minY: 10,
      maxX: -95,
      maxY: 50,
    })
  })

  it('handles parent scale', () => {
    // Parent scaled 2x
    // Child at local origin (0, 0), size 10x10
    // World bounds should be 20x20
    const parent = createEntity('parent', {
      entity_type: 'Group',
      geometry: 'Empty',
      transform: { translate: [0, 0], rotate: 0, scale: [2, 2] },
      children: ['child'],
    })
    const child = createEntity('child', {
      geometry: { Rect: { origin: [0, 0], width: 10, height: 10 } },
      transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
      parent_id: 'parent',
    })
    const entityMap = createEntityMap(parent, child)

    const bounds = calculateWorldBounds(child, entityMap)

    expect(bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 20,
    })
  })

  it('handles child with own translate inside scaled parent', () => {
    // Parent scaled 2x
    // Child at local translate (10, 10), origin (0, 0), size 10x10
    // Child local bounds: (10, 10) to (20, 20)
    // World: (20, 20) to (40, 40)
    const parent = createEntity('parent', {
      entity_type: 'Group',
      geometry: 'Empty',
      transform: { translate: [0, 0], rotate: 0, scale: [2, 2] },
      children: ['child'],
    })
    const child = createEntity('child', {
      geometry: { Rect: { origin: [0, 0], width: 10, height: 10 } },
      transform: { translate: [10, 10], rotate: 0, scale: [1, 1] },
      parent_id: 'parent',
    })
    const entityMap = createEntityMap(parent, child)

    const bounds = calculateWorldBounds(child, entityMap)

    expect(bounds).toEqual({
      minX: 20,
      minY: 20,
      maxX: 40,
      maxY: 40,
    })
  })

  it('handles deeply nested hierarchy', () => {
    // grandparent at (100, 0)
    // parent at local (50, 0)
    // child rect at local origin (0, 0), size 10x10
    // World: grandparent + parent + child = (150, 0) to (160, 10)
    const grandparent = createEntity('grandparent', {
      entity_type: 'Group',
      geometry: 'Empty',
      transform: { translate: [100, 0], rotate: 0, scale: [1, 1] },
      children: ['parent'],
    })
    const parent = createEntity('parent', {
      entity_type: 'Group',
      geometry: 'Empty',
      transform: { translate: [50, 0], rotate: 0, scale: [1, 1] },
      children: ['child'],
      parent_id: 'grandparent',
    })
    const child = createEntity('child', {
      geometry: { Rect: { origin: [0, 0], width: 10, height: 10 } },
      transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
      parent_id: 'parent',
    })
    const entityMap = createEntityMap(grandparent, parent, child)

    const bounds = calculateWorldBounds(child, entityMap)

    expect(bounds).toEqual({
      minX: 150,
      minY: 0,
      maxX: 160,
      maxY: 10,
    })
  })
})
