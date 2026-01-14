import { describe, it, expect } from 'vitest';
import {
  WSMessageSchema,
  SceneSchema,
  validateMessage,
  safeValidateMessage,
  type WSMessage,
} from '../src/index';

describe('WSMessageSchema', () => {
  const validTimestamp = Date.now();

  describe('scene_update', () => {
    it('should validate valid scene_update message', () => {
      const message = {
        type: 'scene_update',
        data: {
          scene: {
            entities: [],
          },
        },
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate scene_update with full scene data', () => {
      const message = {
        type: 'scene_update',
        data: {
          scene: {
            name: 'test-scene',
            entities: [
              {
                id: 'circle1',
                entity_type: 'Circle',
                geometry: { Circle: { center: [0, 0], radius: 50 } },
                transform: {
                  translate: [0, 0],
                  rotate: 0,
                  scale: [1, 1],
                },
                style: {
                  fill: { color: [1, 0, 0, 1] },
                },
              },
            ],
            tree: [
              { id: 'circle1', name: 'circle1', type: 'Circle', zOrder: 0 },
            ],
          },
        },
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('selection', () => {
    it('should validate valid selection message', () => {
      const message = {
        type: 'selection',
        data: {
          selected: ['entity1', 'entity2'],
        },
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate empty selection', () => {
      const message = {
        type: 'selection',
        data: {
          selected: [],
        },
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('connection', () => {
    it('should validate valid connection message', () => {
      const message = {
        type: 'connection',
        data: {
          mcpVersion: '1.0.0',
          protocolVersion: 1,
        },
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate connection with minViewerVersion', () => {
      const message = {
        type: 'connection',
        data: {
          mcpVersion: '1.0.0',
          protocolVersion: 1,
          minViewerVersion: '0.9.0',
        },
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('error', () => {
    it('should validate valid error message', () => {
      const message = {
        type: 'error',
        data: {
          message: 'Something went wrong',
        },
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate error with code', () => {
      const message = {
        type: 'error',
        data: {
          message: 'Connection failed',
          code: 'CONNECTION_ERROR',
        },
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('ping/pong', () => {
    it('should validate ping message', () => {
      const message = {
        type: 'ping',
        data: {},
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate pong message', () => {
      const message = {
        type: 'pong',
        data: {},
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid messages', () => {
    it('should reject unknown message type', () => {
      const message = {
        type: 'unknown_type',
        data: {},
        timestamp: validTimestamp,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it('should reject missing timestamp', () => {
      const message = {
        type: 'ping',
        data: {},
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it('should reject invalid timestamp (negative)', () => {
      const message = {
        type: 'ping',
        data: {},
        timestamp: -1,
      };

      const result = WSMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });
  });
});

describe('SceneSchema', () => {
  it('should validate minimal scene', () => {
    const scene = {
      entities: [],
    };

    const result = SceneSchema.safeParse(scene);
    expect(result.success).toBe(true);
  });

  it('should validate scene with all entity types', () => {
    const scene = {
      name: 'test',
      entities: [
        {
          id: 'c1',
          entity_type: 'Circle',
          geometry: {},
          transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
          style: {},
        },
        {
          id: 'r1',
          entity_type: 'Rect',
          geometry: {},
          transform: { translate: [0, 0], rotate: 0, scale: [1, 1] },
          style: {},
        },
      ],
    };

    const result = SceneSchema.safeParse(scene);
    expect(result.success).toBe(true);
  });
});

describe('validateMessage', () => {
  it('should return parsed message for valid input', () => {
    const raw = {
      type: 'ping',
      data: {},
      timestamp: Date.now(),
    };

    const result = validateMessage(raw);
    expect(result.type).toBe('ping');
  });

  it('should throw for invalid input', () => {
    const raw = {
      type: 'invalid',
      data: {},
    };

    expect(() => validateMessage(raw)).toThrow();
  });
});

describe('safeValidateMessage', () => {
  it('should return parsed message for valid input', () => {
    const raw = {
      type: 'pong',
      data: {},
      timestamp: Date.now(),
    };

    const result = safeValidateMessage(raw);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('pong');
  });

  it('should return null for invalid input', () => {
    const raw = {
      type: 'invalid',
      data: {},
    };

    const result = safeValidateMessage(raw);
    expect(result).toBeNull();
  });
});
