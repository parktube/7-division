import { z } from 'zod';

// Data Schemas
export const SceneUpdateDataSchema = z.object({
  entities: z.array(z.record(z.unknown())),
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
]);

// Type exports
export type WSMessage = z.infer<typeof WSMessageSchema>;
export type WSMessageType = WSMessage['type'];
export type SceneUpdateData = z.infer<typeof SceneUpdateDataSchema>;
export type SelectionData = z.infer<typeof SelectionDataSchema>;
export type ConnectionData = z.infer<typeof ConnectionDataSchema>;
export type ErrorData = z.infer<typeof ErrorDataSchema>;

// Validation helper
export function validateMessage(raw: unknown): WSMessage {
  return WSMessageSchema.parse(raw);
}

// Safe validation (returns null on error)
export function safeValidateMessage(raw: unknown): WSMessage | null {
  const result = WSMessageSchema.safeParse(raw);
  return result.success ? result.data : null;
}
