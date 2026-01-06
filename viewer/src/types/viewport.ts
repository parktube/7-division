export interface ViewportState {
  offset: {
    x: number
    y: number
  }
  zoom: number // 1.0 = 100%
}

export const DEFAULT_VIEWPORT: ViewportState = {
  offset: { x: 0, y: 0 },
  zoom: 1.0,
}

export const ZOOM_MIN = 0.1 // 10%
export const ZOOM_MAX = 10.0 // 1000%
export const ZOOM_STEP = 0.1 // 10% per wheel tick
