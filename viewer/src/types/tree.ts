import type { Entity, EntityType } from './scene'

export interface TreeNode {
  id: string
  name: string
  type: EntityType
  zOrder: number
  children?: TreeNode[]
  entity: Entity
}
