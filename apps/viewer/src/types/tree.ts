import type { EntityType } from './scene'

/** TreeNode for LayerPanel (uses SceneTreeNode from scene.json) */
export interface TreeNode {
  id: string
  name: string
  type: EntityType
  zOrder: number
  children?: TreeNode[]
}
