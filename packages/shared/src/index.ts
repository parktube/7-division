// WebSocket message types and schemas
export {
  WSMessageSchema,
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
  SceneUpdateData,
  SelectionData,
  ConnectionData,
  ErrorData,
} from './ws-messages.js';
