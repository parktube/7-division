import type { Entity } from '@/types/scene'

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Transform2D {
  translate: [number, number]
  rotate: number
  scale: [number, number]
}

function isObject(geo: unknown): geo is object {
  return typeof geo === 'object' && geo !== null
}

/**
 * Get the accumulated parent transform by walking up the parent chain
 * Does NOT include entity's own transform (only parents)
 * @internal Used by calculateWorldBounds
 */
export function getWorldTransform(entity: Entity, entityMap: Map<string, Entity>): Transform2D {
  const transforms: Transform2D[] = []

  // Start from parent, not entity itself (entity's transform is in local bounds)
  let current: Entity | undefined = entity.parent_id
    ? entityMap.get(entity.parent_id)
    : undefined

  // Collect transforms from parent to root
  while (current) {
    transforms.push({
      translate: current.transform.translate as [number, number],
      rotate: current.transform.rotate,
      scale: current.transform.scale as [number, number],
    })

    if (current.parent_id) {
      current = entityMap.get(current.parent_id)
    } else {
      break
    }
  }

  // If no parents, return identity transform
  if (transforms.length === 0) {
    return {
      translate: [0, 0],
      rotate: 0,
      scale: [1, 1],
    }
  }

  // Combine transforms from root to immediate parent (reverse order)
  // Formula: worldPos = parentTranslate + parentScale * localPos
  // Combined: translate = t1 + s1*t2, scale = s1*s2
  let totalTranslateX = 0
  let totalTranslateY = 0
  let totalScaleX = 1
  let totalScaleY = 1

  // Process from root (last) to immediate parent (first)
  for (let i = transforms.length - 1; i >= 0; i--) {
    const t = transforms[i]
    // Apply accumulated scale to current translate, then add to accumulated translate
    totalTranslateX = totalTranslateX + totalScaleX * t.translate[0]
    totalTranslateY = totalTranslateY + totalScaleY * t.translate[1]
    totalScaleX *= t.scale[0]
    totalScaleY *= t.scale[1]
  }

  return {
    translate: [totalTranslateX, totalTranslateY],
    rotate: 0, // Simplified: not accumulating rotation
    scale: [totalScaleX, totalScaleY],
  }
}

// Merge two bounds into one
function mergeBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

export function calculateEntityBounds(
  entity: Entity,
  entityMap?: Map<string, Entity>
): Bounds | null {
  const geo = entity.geometry

  // Group: calculate bounds from children
  if (entity.entity_type === 'Group' && entity.children && entityMap) {
    let groupBounds: Bounds | null = null

    for (const childKey of entity.children) {
      // children can be name or id
      const child = entityMap.get(childKey)
      if (!child) continue

      const childBounds = calculateEntityBounds(child, entityMap)
      if (!childBounds) continue

      if (!groupBounds) {
        groupBounds = childBounds
      } else {
        groupBounds = mergeBounds(groupBounds, childBounds)
      }
    }

    if (!groupBounds) return null

    // Apply group transform
    const { translate, scale } = entity.transform
    return {
      minX: groupBounds.minX * scale[0] + translate[0],
      minY: groupBounds.minY * scale[1] + translate[1],
      maxX: groupBounds.maxX * scale[0] + translate[0],
      maxY: groupBounds.maxY * scale[1] + translate[1],
    }
  }

  if (geo === 'Empty' || !isObject(geo)) {
    return null
  }

  let bounds: Bounds | null = null

  if ('Circle' in geo) {
    const { center, radius } = geo.Circle
    bounds = {
      minX: center[0] - radius,
      minY: center[1] - radius,
      maxX: center[0] + radius,
      maxY: center[1] + radius,
    }
  } else if ('Rect' in geo) {
    const { origin, width, height } = geo.Rect
    bounds = {
      minX: origin[0],
      minY: origin[1],
      maxX: origin[0] + width,
      maxY: origin[1] + height,
    }
  } else if ('Line' in geo) {
    const points = geo.Line.points
    if (points.length === 0) return null

    let minX = points[0][0], maxX = points[0][0]
    let minY = points[0][1], maxY = points[0][1]

    for (const [x, y] of points) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }

    bounds = { minX, minY, maxX, maxY }
  } else if ('Polygon' in geo) {
    const points = geo.Polygon.points
    if (points.length === 0) return null

    let minX = points[0][0], maxX = points[0][0]
    let minY = points[0][1], maxY = points[0][1]

    for (const [x, y] of points) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }

    bounds = { minX, minY, maxX, maxY }
  } else if ('Arc' in geo) {
    const { center, radius } = geo.Arc
    // Approximate with full circle bounds
    bounds = {
      minX: center[0] - radius,
      minY: center[1] - radius,
      maxX: center[0] + radius,
      maxY: center[1] + radius,
    }
  } else if ('Bezier' in geo) {
    const { start, segments } = geo.Bezier
    let minX = start[0], maxX = start[0]
    let minY = start[1], maxY = start[1]

    for (const segment of segments) {
      for (const point of segment) {
        if (point[0] < minX) minX = point[0]
        if (point[0] > maxX) maxX = point[0]
        if (point[1] < minY) minY = point[1]
        if (point[1] > maxY) maxY = point[1]
      }
    }

    bounds = { minX, minY, maxX, maxY }
  }

  if (!bounds) return null

  // Apply transform
  const { translate, scale } = entity.transform
  return {
    minX: bounds.minX * scale[0] + translate[0],
    minY: bounds.minY * scale[1] + translate[1],
    maxX: bounds.maxX * scale[0] + translate[0],
    maxY: bounds.maxY * scale[1] + translate[1],
  }
}

/**
 * Calculate world bounds by applying all parent transforms
 * This gives the actual position on screen (world coordinates)
 */
export function calculateWorldBounds(
  entity: Entity,
  entityMap: Map<string, Entity>
): Bounds | null {
  // First get local bounds (relative to parent)
  const localBounds = calculateLocalBounds(entity, entityMap)
  if (!localBounds) return null

  // Get accumulated world transform from parent chain
  const worldTransform = getWorldTransform(entity, entityMap)

  // Apply world transform to local bounds
  return {
    minX: localBounds.minX * worldTransform.scale[0] + worldTransform.translate[0],
    minY: localBounds.minY * worldTransform.scale[1] + worldTransform.translate[1],
    maxX: localBounds.maxX * worldTransform.scale[0] + worldTransform.translate[0],
    maxY: localBounds.maxY * worldTransform.scale[1] + worldTransform.translate[1],
  }
}

/**
 * Calculate local bounds (geometry only, no transform)
 * Used internally for world bounds calculation
 */
function calculateLocalBounds(
  entity: Entity,
  entityMap: Map<string, Entity>
): Bounds | null {
  const geo = entity.geometry

  // Group: calculate bounds from children (in group's local space)
  if (entity.entity_type === 'Group' && entity.children && entityMap) {
    let groupBounds: Bounds | null = null

    for (const childKey of entity.children) {
      const child = entityMap.get(childKey)
      if (!child) continue

      // Get child's bounds in group's local space
      const childBounds = calculateEntityBounds(child, entityMap)
      if (!childBounds) continue

      if (!groupBounds) {
        groupBounds = childBounds
      } else {
        groupBounds = mergeBounds(groupBounds, childBounds)
      }
    }

    return groupBounds
  }

  if (geo === 'Empty' || !isObject(geo)) {
    return null
  }

  let bounds: Bounds | null = null

  if ('Circle' in geo) {
    const { center, radius } = geo.Circle
    bounds = {
      minX: center[0] - radius,
      minY: center[1] - radius,
      maxX: center[0] + radius,
      maxY: center[1] + radius,
    }
  } else if ('Rect' in geo) {
    const { origin, width, height } = geo.Rect
    bounds = {
      minX: origin[0],
      minY: origin[1],
      maxX: origin[0] + width,
      maxY: origin[1] + height,
    }
  } else if ('Line' in geo) {
    const points = geo.Line.points
    if (points.length === 0) return null

    let minX = points[0][0], maxX = points[0][0]
    let minY = points[0][1], maxY = points[0][1]

    for (const [x, y] of points) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }

    bounds = { minX, minY, maxX, maxY }
  } else if ('Polygon' in geo) {
    const points = geo.Polygon.points
    if (points.length === 0) return null

    let minX = points[0][0], maxX = points[0][0]
    let minY = points[0][1], maxY = points[0][1]

    for (const [x, y] of points) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }

    bounds = { minX, minY, maxX, maxY }
  } else if ('Arc' in geo) {
    const { center, radius } = geo.Arc
    bounds = {
      minX: center[0] - radius,
      minY: center[1] - radius,
      maxX: center[0] + radius,
      maxY: center[1] + radius,
    }
  } else if ('Bezier' in geo) {
    const { start, segments } = geo.Bezier
    let minX = start[0], maxX = start[0]
    let minY = start[1], maxY = start[1]

    for (const segment of segments) {
      for (const point of segment) {
        if (point[0] < minX) minX = point[0]
        if (point[0] > maxX) maxX = point[0]
        if (point[1] < minY) minY = point[1]
        if (point[1] > maxY) maxY = point[1]
      }
    }

    bounds = { minX, minY, maxX, maxY }
  }

  if (!bounds) return null

  // Apply entity's own transform to get local bounds
  const { translate, scale } = entity.transform
  return {
    minX: bounds.minX * scale[0] + translate[0],
    minY: bounds.minY * scale[1] + translate[1],
    maxX: bounds.maxX * scale[0] + translate[0],
    maxY: bounds.maxY * scale[1] + translate[1],
  }
}
