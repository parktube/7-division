import type {
  Entity,
  Scene,
  Style,
  CircleGeometry,
  RectGeometry,
  LineGeometry,
  PolygonGeometry,
  ArcGeometry,
  BezierGeometry,
} from '@/types/scene'
import { applyTransform } from './transform'

// Type guards (with defensive checks for "Empty" geometry)
function isObject(geo: unknown): geo is object {
  return typeof geo === 'object' && geo !== null
}
function isCircle(geo: Entity['geometry']): geo is CircleGeometry {
  return isObject(geo) && 'Circle' in geo
}
function isRect(geo: Entity['geometry']): geo is RectGeometry {
  return isObject(geo) && 'Rect' in geo
}
function isLine(geo: Entity['geometry']): geo is LineGeometry {
  return isObject(geo) && 'Line' in geo
}
function isPolygon(geo: Entity['geometry']): geo is PolygonGeometry {
  return isObject(geo) && 'Polygon' in geo
}
function isArc(geo: Entity['geometry']): geo is ArcGeometry {
  return isObject(geo) && 'Arc' in geo
}
function isBezier(geo: Entity['geometry']): geo is BezierGeometry {
  return isObject(geo) && 'Bezier' in geo
}

// Geometry rendering functions - return true if path was created
function renderCircle(ctx: CanvasRenderingContext2D, geo: CircleGeometry): boolean {
  const { center, radius } = geo.Circle
  ctx.beginPath()
  ctx.arc(center[0], center[1], radius, 0, Math.PI * 2)
  ctx.closePath()
  return true
}

function renderRect(ctx: CanvasRenderingContext2D, geo: RectGeometry): boolean {
  const { center, width, height } = geo.Rect
  const hw = width / 2
  const hh = height / 2
  // ctx.rect()는 Y-flip 후 height 방향이 일관되지 않아 명시적 path 사용
  ctx.beginPath()
  ctx.moveTo(center[0] - hw, center[1] - hh) // bottom-left
  ctx.lineTo(center[0] + hw, center[1] - hh) // bottom-right
  ctx.lineTo(center[0] + hw, center[1] + hh) // top-right
  ctx.lineTo(center[0] - hw, center[1] + hh) // top-left
  ctx.closePath()
  return true
}

function renderLine(ctx: CanvasRenderingContext2D, geo: LineGeometry): boolean {
  const points = geo.Line.points
  if (points.length < 2) return false

  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1])
  }
  return true
}

function renderPolygon(ctx: CanvasRenderingContext2D, geo: PolygonGeometry): boolean {
  const { points, holes } = geo.Polygon
  if (points.length < 3) return false

  ctx.beginPath()

  // 외곽선 (outer contour)
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1])
  }
  ctx.closePath()

  // 구멍들 (holes) - evenodd fill rule로 구멍 생성
  if (holes && holes.length > 0) {
    for (const hole of holes) {
      if (hole.length < 3) continue
      ctx.moveTo(hole[0][0], hole[0][1])
      for (let i = 1; i < hole.length; i++) {
        ctx.lineTo(hole[i][0], hole[i][1])
      }
      ctx.closePath()
    }
  }
  return true
}

function renderArc(ctx: CanvasRenderingContext2D, geo: ArcGeometry): boolean {
  const { center, radius, start_angle, end_angle } = geo.Arc
  ctx.beginPath()
  ctx.arc(center[0], center[1], radius, start_angle, end_angle)
  return true
}

function renderBezier(ctx: CanvasRenderingContext2D, geo: BezierGeometry): boolean {
  const { start, segments, closed } = geo.Bezier
  if (segments.length === 0) return false

  ctx.beginPath()
  ctx.moveTo(start[0], start[1])

  for (const segment of segments) {
    if (segment.length === 3) {
      // Cubic bezier: [cp1, cp2, end]
      const [cp1, cp2, end] = segment
      ctx.bezierCurveTo(cp1[0], cp1[1], cp2[0], cp2[1], end[0], end[1])
    }
  }

  if (closed) {
    ctx.closePath()
  }
  return true
}

// Style application
function applyStyle(ctx: CanvasRenderingContext2D, style: Style, hasHoles = false) {
  if (style.fill) {
    const [r, g, b, a] = style.fill.color
    ctx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`
    // holes가 있을 때만 evenodd 사용 (성능 최적화)
    if (hasHoles) {
      ctx.fill('evenodd')
    } else {
      ctx.fill()
    }
  }

  if (style.stroke) {
    const [r, g, b, a] = style.stroke.color
    ctx.strokeStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`
    ctx.lineWidth = style.stroke.width
    ctx.stroke()
  }
}

// Main entity renderer
function renderEntity(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  findEntity: (key: string) => Entity | undefined,
  hiddenIds?: Set<string>
) {
  // Skip hidden entities
  if (hiddenIds?.has(entity.id)) {
    return
  }
  applyTransform(ctx, entity.transform)

  const geo = entity.geometry

  // Groups: check entity_type and use entity.children (not geometry)
  if (entity.entity_type === 'Group' && entity.children) {
    // Render children (sorted by z-index)
    const children = entity.children
      .map((key) => findEntity(key))
      .filter((e): e is Entity => e !== undefined)
      .sort((a, b) => (a.metadata?.z_index ?? 0) - (b.metadata?.z_index ?? 0))

    for (const child of children) {
      renderEntity(ctx, child, findEntity, hiddenIds)
    }
  } else if (geo !== 'Empty') {
    // Render geometry - only apply style if path was created
    let hasHoles = false
    let pathCreated = false
    if (isCircle(geo)) {
      pathCreated = renderCircle(ctx, geo)
    } else if (isRect(geo)) {
      pathCreated = renderRect(ctx, geo)
    } else if (isLine(geo)) {
      pathCreated = renderLine(ctx, geo)
    } else if (isPolygon(geo)) {
      pathCreated = renderPolygon(ctx, geo)
      hasHoles = (geo.Polygon.holes?.length ?? 0) > 0
    } else if (isArc(geo)) {
      pathCreated = renderArc(ctx, geo)
    } else if (isBezier(geo)) {
      pathCreated = renderBezier(ctx, geo)
    }
    if (pathCreated) {
      applyStyle(ctx, entity.style, hasHoles)
    }
  }

  ctx.restore()
}

// Scene renderer
export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene, hiddenIds?: Set<string>) {
  // Build lookup maps by both ID and name
  const entityById = new Map<string, Entity>()
  const entityByName = new Map<string, Entity>()
  scene.entities.forEach((e) => {
    entityById.set(e.id, e)
    if (e.metadata?.name) {
      entityByName.set(e.metadata.name, e)
    }
  })

  // Lookup entity by ID or name (children array may use either)
  function findEntity(key: string): Entity | undefined {
    return entityById.get(key) || entityByName.get(key)
  }

  // Find root entities (not children of any group)
  const childIds = new Set<string>()
  scene.entities.forEach((e) => {
    if (e.entity_type === 'Group' && e.children) {
      e.children.forEach((key) => {
        const child = findEntity(key)
        if (child) childIds.add(child.id)
      })
    }
  })

  // Sort root entities by z-index
  const rootEntities = scene.entities
    .filter((e) => !childIds.has(e.id))
    .sort((a, b) => (a.metadata?.z_index ?? 0) - (b.metadata?.z_index ?? 0))

  for (const entity of rootEntities) {
    renderEntity(ctx, entity, findEntity, hiddenIds)
  }
}
