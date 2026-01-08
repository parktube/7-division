export interface Transform {
  translate: [number, number]
  rotate: number
  scale: [number, number]
  pivot?: [number, number]
}

export interface StrokeStyle {
  width: number
  color: [number, number, number, number]
  dash?: number[] | null
  cap?: string
  join?: string
}

export interface FillStyle {
  color: [number, number, number, number]
}

export interface Style {
  fill?: FillStyle | null
  stroke?: StrokeStyle | null
}

export interface Metadata {
  name?: string
  layer?: string | null
  locked?: boolean
  z_index?: number
}

// Geometry types (nested structure)
export interface CircleGeometry {
  Circle: {
    center: [number, number]
    radius: number
  }
}

export interface RectGeometry {
  Rect: {
    center: [number, number]
    width: number
    height: number
  }
}

export interface LineGeometry {
  Line: {
    points: [number, number][]
  }
}

export interface PolygonGeometry {
  Polygon: {
    points: [number, number][]
    holes?: [number, number][][]  // 구멍들 (inner contours)
  }
}

export interface ArcGeometry {
  Arc: {
    center: [number, number]
    radius: number
    start_angle: number
    end_angle: number
  }
}

export interface BezierGeometry {
  Bezier: {
    start: [number, number]
    segments: [number, number][][] // [[cp1, cp2, end], ...]
    closed: boolean
  }
}

export interface GroupGeometry {
  Group: {
    children: string[]
  }
}

export type Geometry =
  | CircleGeometry
  | RectGeometry
  | LineGeometry
  | PolygonGeometry
  | ArcGeometry
  | BezierGeometry
  | GroupGeometry
  | 'Empty' // Groups may have "Empty" geometry string

export type EntityType = 'Circle' | 'Rect' | 'Line' | 'Polygon' | 'Arc' | 'Bezier' | 'Group'

/** Bounds (min/max) */
export interface Bounds {
  min: [number, number]
  max: [number, number]
}

/** Computed fields (calculated by WASM, read-only in Viewer) */
export interface Computed {
  world_bounds?: Bounds
  local_bounds?: Bounds
  center?: [number, number]
  size?: [number, number]
}

export interface Entity {
  id: string
  entity_type: EntityType
  geometry: Geometry
  transform: Transform
  style: Style
  metadata?: Metadata
  children?: string[] // For Group entities: child entity IDs
  parent_id?: string // Reference to parent group
  computed?: Computed // WASM에서 계산된 필드 (Dumb View)
}

/** Tree node from WASM (pre-computed for LayerPanel) */
export interface SceneTreeNode {
  id: string
  name: string
  type: EntityType
  zOrder: number
  children?: SceneTreeNode[]
}

export interface Scene {
  name?: string
  entities: Entity[]
  tree?: SceneTreeNode[] // Pre-computed tree from WASM (Dumb View)
  last_operation?: string | null // 마지막 실행된 작업 (LLM 작업 추적용)
}
