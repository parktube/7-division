import type { Transform } from '@/types/scene'

/**
 * Setup canvas for Y-up coordinate system (CAD standard)
 * @param width - CSS pixel width (not physical pixels)
 * @param height - CSS pixel height (not physical pixels)
 */
export function setupCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Move origin to center and flip Y axis
  ctx.translate(width / 2, height / 2)
  ctx.scale(1, -1)
}

/**
 * Apply entity transform (TRS order: translate → rotate → scale)
 */
export function applyTransform(ctx: CanvasRenderingContext2D, transform: Transform) {
  const [tx, ty] = transform.translate
  const [sx, sy] = transform.scale
  const rotation = transform.rotate
  const pivot = transform.pivot || [0, 0]

  ctx.save()

  // 1. Move to pivot
  ctx.translate(pivot[0], pivot[1])

  // 2. Apply transform (TRS order)
  ctx.translate(tx, ty)
  ctx.rotate(rotation)
  ctx.scale(sx, sy)

  // 3. Move back from pivot
  ctx.translate(-pivot[0], -pivot[1])
}
