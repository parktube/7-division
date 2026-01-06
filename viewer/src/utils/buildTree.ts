import type { Scene, Entity } from '@/types/scene'
import type { TreeNode } from '@/types/tree'

/**
 * Convert Scene to TreeNode array for LayerPanel
 * - Groups become parent nodes with children
 * - Sorted by z-order (higher = top of list)
 */
export function buildTree(scene: Scene): TreeNode[] {
  // Build lookup maps by both ID and name
  const entityById = new Map<string, Entity>()
  const entityByName = new Map<string, Entity>()
  scene.entities.forEach(e => {
    entityById.set(e.id, e)
    if (e.metadata?.name) {
      entityByName.set(e.metadata.name, e)
    }
  })

  // Lookup entity by ID or name (children array may use either)
  function findEntity(key: string): Entity | undefined {
    return entityById.get(key) || entityByName.get(key)
  }

  // Collect all child keys (entities that belong to a group)
  // Note: children array is at entity level, not inside geometry
  const childIds = new Set<string>()
  scene.entities.forEach(e => {
    if (e.entity_type === 'Group' && e.children) {
      e.children.forEach(key => {
        const child = findEntity(key)
        if (child) childIds.add(child.id)
      })
    }
  })

  // Get z-order from entity (metadata.z_index or default 0)
  function getZOrder(entity: Entity): number {
    return entity.metadata?.z_index ?? 0
  }

  // Recursively convert Entity to TreeNode
  function toTreeNode(entity: Entity): TreeNode {
    const node: TreeNode = {
      id: entity.id,
      name: entity.metadata?.name || entity.id,
      type: entity.entity_type,
      zOrder: getZOrder(entity),
      entity,
    }

    // If group, add children (children array is at entity level)
    if (entity.entity_type === 'Group' && entity.children) {
      const childEntities = entity.children
        .map((key, idx) => ({ entity: findEntity(key), idx }))
        .filter((item): item is { entity: Entity; idx: number } => item.entity !== undefined)

      if (childEntities.length > 0) {
        node.children = childEntities
          .sort((a, b) => {
            const zDiff = getZOrder(b.entity) - getZOrder(a.entity)
            if (zDiff !== 0) return zDiff
            // Same z-order: later in array renders on top, should be higher in list
            return b.idx - a.idx
          })
          .map(item => toTreeNode(item.entity))
      }
    }

    return node
  }

  // Get root-level entities (not children of any group)
  const rootEntities = scene.entities
    .map((e, idx) => ({ entity: e, idx }))
    .filter(item => !childIds.has(item.entity.id))
    .sort((a, b) => {
      const zDiff = getZOrder(b.entity) - getZOrder(a.entity)
      if (zDiff !== 0) return zDiff
      // Same z-order: later in array renders on top, should be higher in list
      return b.idx - a.idx
    })

  return rootEntities.map(item => toTreeNode(item.entity))
}

/**
 * Flatten tree to array of IDs (in display order)
 * Used for range selection (Shift+click)
 */
export function flattenTree(nodes: TreeNode[]): string[] {
  const result: string[] = []

  function traverse(node: TreeNode) {
    result.push(node.id)
    node.children?.forEach(traverse)
  }

  nodes.forEach(traverse)
  return result
}
