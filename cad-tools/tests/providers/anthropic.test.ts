import { describe, it, expect } from 'vitest';
import { AnthropicProvider } from '../../src/providers/anthropic.js';
import { CAD_TOOLS } from '../../src/schema.js';

describe('AnthropicProvider', () => {
  const provider = new AnthropicProvider({ apiKey: 'fake-key' });

  describe('constructor', () => {
    it('should use default maxTokens when not provided', () => {
      const p = new AnthropicProvider({ apiKey: 'key' });
      expect(p).toBeDefined();
    });

    it('should accept custom maxTokens', () => {
      const p = new AnthropicProvider({ apiKey: 'key', maxTokens: 2048 });
      expect(p).toBeDefined();
    });

    it('should throw on invalid maxTokens (too low)', () => {
      expect(() => new AnthropicProvider({ apiKey: 'key', maxTokens: 0 }))
        .toThrow('maxTokens must be between');
    });

    it('should throw on invalid maxTokens (too high)', () => {
      expect(() => new AnthropicProvider({ apiKey: 'key', maxTokens: 10000 }))
        .toThrow('maxTokens must be between');
    });
  });

  describe('convertToolSchema', () => {
    it('should convert canonical schema to Anthropic format', () => {
      const canonical = CAD_TOOLS['draw_rect'];
      const anthropic = provider.convertToolSchema(canonical);

      expect(anthropic).toHaveProperty('name', 'draw_rect');
      expect(anthropic).toHaveProperty('description');
      expect(anthropic).toHaveProperty('input_schema');
      expect(anthropic.input_schema).toHaveProperty('type', 'object');
      expect(anthropic.input_schema).toHaveProperty('properties');
      expect(anthropic.input_schema).toHaveProperty('required');
    });
  });

  describe('parseResponse', () => {
    it('should parse tool_use blocks', () => {
      const mockResponse = {
        content: [
          { type: 'text', text: 'Drawing a rect' },
          {
            type: 'tool_use',
            id: 'call_123',
            name: 'draw_rect',
            input: { name: 'wall', x: 0, y: 0, width: 100, height: 50 },
          },
        ],
        stop_reason: 'tool_use',
      };

      const [toolCalls, isComplete] = provider.parseResponse(mockResponse as any);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].id).toBe('call_123');
      expect(toolCalls[0].name).toBe('draw_rect');
      expect(toolCalls[0].input.name).toBe('wall');
      expect(isComplete).toBe(false);
    });

    it('should detect end_turn', () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Done!' }],
        stop_reason: 'end_turn',
      };

      const [toolCalls, isComplete] = provider.parseResponse(mockResponse as any);

      expect(toolCalls).toHaveLength(0);
      expect(isComplete).toBe(true);
    });
  });

  describe('extractText', () => {
    it('should extract text from response', () => {
      const mockResponse = {
        content: [
          { type: 'text', text: 'Hello world' },
          { type: 'tool_use', id: 'x', name: 'y', input: {} },
        ],
      };

      const text = provider.extractText(mockResponse as any);
      expect(text).toBe('Hello world');
    });

    it('should return empty string if no text', () => {
      const mockResponse = {
        content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
      };

      const text = provider.extractText(mockResponse as any);
      expect(text).toBe('');
    });
  });

  describe('buildUserMessage', () => {
    it('should create user message', () => {
      const msg = provider.buildUserMessage('Draw a room');
      expect(msg).toEqual({ role: 'user', content: 'Draw a room' });
    });
  });

  describe('buildToolResultMessage', () => {
    it('should create tool result message', () => {
      const results = [
        { success: true, entity: 'wall', type: 'rect' },
        { success: true, entity: 'door', type: 'arc' },
      ];
      const callIds = ['call_1', 'call_2'];

      const msg = provider.buildToolResultMessage(results, callIds) as any;

      expect(msg.role).toBe('user');
      expect(msg.content).toHaveLength(2);
      expect(msg.content[0].type).toBe('tool_result');
      expect(msg.content[0].tool_use_id).toBe('call_1');
      expect(msg.content[1].tool_use_id).toBe('call_2');
    });

    it('should throw on array length mismatch', () => {
      const results = [{ success: true, entity: 'wall', type: 'rect' }];
      const callIds = ['call_1', 'call_2'];

      expect(() => provider.buildToolResultMessage(results, callIds))
        .toThrow('results and callIds must have same length');
    });
  });

  describe('responseToMessage', () => {
    it('should convert response to assistant message', () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Done' }],
      };

      const msg = provider.responseToMessage(mockResponse as any) as any;

      expect(msg.role).toBe('assistant');
      expect(msg.content).toEqual(mockResponse.content);
    });
  });
});
