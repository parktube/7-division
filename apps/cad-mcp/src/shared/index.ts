// WebSocket message types and schemas
export {
  WSMessageSchema,
  SceneSchema,
  SceneUpdateDataSchema,
  SelectionDataSchema,
  ConnectionDataSchema,
  ErrorDataSchema,
  validateMessage,
  safeValidateMessage,
  // Internal schemas (exported for reusability)
  TransformSchema,
  StyleSchema,
  MetadataSchema,
  BoundsSchema,
  ComputedSchema,
  EntitySchema,
  SceneTreeNodeSchema,
} from './ws-messages.js';

export type {
  WSMessage,
  WSMessageType,
  Scene,
  SceneUpdateData,
  SelectionData,
  ConnectionData,
  ErrorData,
  MCPCommandData,
  MCPResponseData,
  SelectionUpdateData,
  SketchUpdateData,
  // Internal schema types (exported for reusability)
  Transform,
  Style,
  Metadata,
  Bounds,
  Computed,
  Entity,
  SceneTreeNode,
} from './ws-messages.js';
