export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: string
  points: Point[]
  color: string
  width: number
}

export type SketchTool = 'pen' | 'eraser'

export interface SketchState {
  strokes: Stroke[]
  currentStroke: Stroke | null
  activeTool: SketchTool
}
