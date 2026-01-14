import {
  Circle,
  Square,
  Minus,
  Hexagon,
  CircleDot,
  Spline,
  Folder,
  type LucideIcon,
} from 'lucide-react'
import type { EntityType } from '@/types/scene'

export const ENTITY_ICONS: Record<EntityType, LucideIcon> = {
  Circle: Circle,
  Rect: Square,
  Line: Minus,
  Polygon: Hexagon,
  Arc: CircleDot,
  Bezier: Spline,
  Group: Folder,
}

// Icon colors by type
export const ENTITY_ICON_COLORS: Record<EntityType, string> = {
  Circle: '#16a34a',   // green
  Rect: '#16a34a',     // green
  Line: '#16a34a',     // green
  Polygon: '#16a34a',  // green
  Arc: '#16a34a',      // green
  Bezier: '#16a34a',   // green
  Group: '#7c3aed',    // purple
}
