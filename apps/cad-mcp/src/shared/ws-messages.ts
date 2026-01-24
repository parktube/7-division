import { z } from 'zod';

// Scene entity schemas (mirrors apps/viewer/src/types/scene.ts)
// Export for reusability in other packages
export const TransformSchema = z.object({
  translate: z.tuple([z.number(), z.number()]),
  rotate: z.number(),
  scale: z.tuple([z.number(), z.number()]),
  pivot: z.tuple([z.number(), z.number()]).optional(),
});

export const StyleSchema = z.object({
  fill: z.object({ color: z.tuple([z.number(), z.number(), z.number(), z.number()]) }).nullable().optional(),
  stroke: z.object({
    width: z.number(),
    color: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    dash: z.array(z.number()).nullable().optional(),
    cap: z.string().optional(),
    join: z.string().optional(),
  }).nullable().optional(),
});

export const MetadataSchema = z.object({
  name: z.string().optional(),
  layer: z.string().nullable().optional(),
  locked: z.boolean().optional(),
  z_index: z.number().optional(),
});

export const BoundsSchema = z.object({
  min: z.tuple([z.number(), z.number()]),
  max: z.tuple([z.number(), z.number()]),
});

export const ComputedSchema = z.object({
  world_bounds: BoundsSchema.optional(),
  local_bounds: BoundsSchema.optional(),
  center: z.tuple([z.number(), z.number()]).optional(),
  size: z.tuple([z.number(), z.number()]).optional(),
});

export const EntitySchema = z.object({
  id: z.string(),
  entity_type: z.enum(['Circle', 'Rect', 'Line', 'Polygon', 'Arc', 'Bezier', 'Text', 'Group']),
  geometry: z.unknown(), // Complex union, validated at runtime
  transform: TransformSchema,
  style: StyleSchema,
  metadata: MetadataSchema.optional(),
  children: z.array(z.string()).optional(),
  parent_id: z.string().optional(),
  computed: ComputedSchema.optional(),
});

export const SceneTreeNodeSchema: z.ZodType<{
  id: string;
  name: string;
  type: string;
  zOrder: number;
  children?: unknown[];
}> = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  zOrder: z.number(),
  children: z.lazy(() => z.array(SceneTreeNodeSchema)).optional(),
});

// Full Scene schema
export const SceneSchema = z.object({
  name: z.string().optional(),
  entities: z.array(EntitySchema),
  tree: z.array(SceneTreeNodeSchema).optional(),
  last_operation: z.string().nullable().optional(),
});

// Data Schemas for WebSocket messages
export const SceneUpdateDataSchema = z.object({
  scene: SceneSchema,
});

export const SelectionDataSchema = z.object({
  selected: z.array(z.string()),
});

export const ConnectionDataSchema = z.object({
  mcpVersion: z.string(),
  protocolVersion: z.number().int().positive(),
  minViewerVersion: z.string().optional(),
});

export const ErrorDataSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
});

// Client → Server: Selection update from viewer
export const SelectionUpdateDataSchema = z.object({
  selected_entities: z.array(z.string()),
  locked_entities: z.array(z.string()).optional(),
  hidden_entities: z.array(z.string()).optional(),
});

// Client → Server: Sketch update from viewer
// NOTE: Sketch strokes use hex color (#RRGGBB) instead of RGBA tuple because:
// 1. Sketch is a separate feature (user annotations) from CAD entity styles
// 2. Viewer's sketch UI uses HTML color picker which returns hex format
// 3. Simpler for human-readable sketch data export
export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const StrokeSchema = z.object({
  id: z.string(),
  points: z.array(PointSchema),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex string (#RRGGBB)'),
  width: z.number().positive(),
});

export const SketchUpdateDataSchema = z.object({
  strokes: z.array(StrokeSchema),
});

// WebSocket Message Schema (Discriminated Union)
export const WSMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scene_update'),
    data: SceneUpdateDataSchema,
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('selection'),
    data: SelectionDataSchema,
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('connection'),
    data: ConnectionDataSchema,
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('error'),
    data: ErrorDataSchema,
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('ping'),
    data: z.object({}),
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('pong'),
    data: z.object({}),
    timestamp: z.number().int().positive(),
  }),
  // Client → Server messages (viewer to MCP)
  z.object({
    type: z.literal('selection_update'),
    data: SelectionUpdateDataSchema,
    timestamp: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('sketch_update'),
    data: SketchUpdateDataSchema,
    timestamp: z.number().int().positive(),
  }),
]);

// Type exports
export type WSMessage = z.infer<typeof WSMessageSchema>;
export type WSMessageType = WSMessage['type'];
export type Scene = z.infer<typeof SceneSchema>;
export type SceneUpdateData = z.infer<typeof SceneUpdateDataSchema>;
export type SelectionData = z.infer<typeof SelectionDataSchema>;
export type ConnectionData = z.infer<typeof ConnectionDataSchema>;
export type ErrorData = z.infer<typeof ErrorDataSchema>;
export type SelectionUpdateData = z.infer<typeof SelectionUpdateDataSchema>;
export type SketchUpdateData = z.infer<typeof SketchUpdateDataSchema>;
export type Point = z.infer<typeof PointSchema>;
export type Stroke = z.infer<typeof StrokeSchema>;

// Internal schema types (exported for reusability)
export type Transform = z.infer<typeof TransformSchema>;
export type Style = z.infer<typeof StyleSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type Bounds = z.infer<typeof BoundsSchema>;
export type Computed = z.infer<typeof ComputedSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type SceneTreeNode = z.infer<typeof SceneTreeNodeSchema>;

// Validation helper
export function validateMessage(raw: unknown): WSMessage {
  return WSMessageSchema.parse(raw);
}

// Safe validation (returns null on error)
export function safeValidateMessage(raw: unknown): WSMessage | null {
  const result = WSMessageSchema.safeParse(raw);
  return result.success ? result.data : null;
}
