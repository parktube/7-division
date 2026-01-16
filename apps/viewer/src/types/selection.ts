export interface Selection {
  selected_entities: string[]
  locked_entities?: string[]   // Story 7-3-2에서 추가
  hidden_entities?: string[]   // Story 7-3-1에서 추가
  timestamp?: number           // Optional: saveSelection sets it automatically
}

export const DEFAULT_SELECTION: Selection = {
  selected_entities: [],
  timestamp: 0,
}
