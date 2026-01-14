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
} from './ws-messages.js';

export type {
  WSMessage,
  WSMessageType,
  Scene,
  SceneUpdateData,
  SelectionData,
  ConnectionData,
  ErrorData,
} from './ws-messages.js';
