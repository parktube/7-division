/**
 * Runtime Tests - Provider-agnostic Agent Loop
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runAgentLoop } from '../src/runtime.js';
import { CADExecutor } from '../src/executor.js';
import type { LLMProvider, ToolCall } from '../src/providers/types.js';
import type { ToolResult } from '../src/executor.js';
import type { ToolSchema } from '../src/schema.js';

/**
 * Mock LLM Provider for testing
 *
 * sendMessage returns a response object that contains the response data.
 * parseResponse and extractText use the response object directly.
 */
class MockProvider implements LLMProvider {
  readonly name = 'mock';
  private responses: Array<{
    toolCalls: ToolCall[];
    isComplete: boolean;
    text: string;
  }> = [];
  private responseIndex = 0;
  public sentMessages: unknown[] = [];
  public sentTools: unknown[] = [];

  /**
   * Add a response to the queue
   */
  addResponse(toolCalls: ToolCall[], isComplete: boolean, text = ''): void {
    this.responses.push({ toolCalls, isComplete, text });
  }

  /**
   * Add a simple completion response
   */
  addCompletionResponse(text: string): void {
    this.responses.push({ toolCalls: [], isComplete: true, text });
  }

  convertToolSchema(tool: ToolSchema): unknown {
    return { name: tool.name, description: tool.description };
  }

  parseResponse(response: unknown): [ToolCall[], boolean] {
    const resp = response as { toolCalls: ToolCall[]; isComplete: boolean; text: string };
    return [resp.toolCalls, resp.isComplete];
  }

  extractText(response: unknown): string {
    const resp = response as { toolCalls: ToolCall[]; isComplete: boolean; text: string };
    return resp.text;
  }

  buildUserMessage(content: string): unknown {
    return { role: 'user', content };
  }

  buildToolResultMessage(results: ToolResult[], callIds: string[]): unknown {
    return {
      role: 'user',
      content: results.map((r, i) => ({
        type: 'tool_result',
        tool_use_id: callIds[i],
        content: JSON.stringify(r),
      })),
    };
  }

  responseToMessage(_response: unknown): unknown {
    return { role: 'assistant', content: 'mock response' };
  }

  async sendMessage(messages: unknown[], tools: unknown[]): Promise<unknown> {
    this.sentMessages = messages;
    this.sentTools = tools;
    const response = this.responses[this.responseIndex];
    this.responseIndex++;
    return response || { toolCalls: [], isComplete: true, text: '' };
  }

  reset(): void {
    this.responses = [];
    this.responseIndex = 0;
    this.sentMessages = [];
    this.sentTools = [];
  }
}

describe('runAgentLoop', () => {
  let executor: CADExecutor;
  let provider: MockProvider;

  beforeEach(() => {
    executor = CADExecutor.create('test-scene');
    provider = new MockProvider();
  });

  afterEach(() => {
    executor.free();
  });

  it('should return text when LLM completes without tool use', async () => {
    provider.addCompletionResponse('Hello, I will help you draw!');

    const result = await runAgentLoop(provider, executor, 'Draw a circle');

    expect(result).toBe('Hello, I will help you draw!');
  });

  it('should execute tool calls from LLM', async () => {
    // First response: tool call
    provider.addResponse(
      [
        {
          id: 'call_1',
          name: 'draw_circle',
          input: { name: 'head', x: 0, y: 0, radius: 50 },
        },
      ],
      false
    );
    // Second response: complete
    provider.addCompletionResponse('I drew a circle called head');

    const result = await runAgentLoop(provider, executor, 'Draw a head');

    expect(result).toBe('I drew a circle called head');
    expect(executor.getEntityCount()).toBe(1);
  });

  it('should handle multiple tool calls in sequence', async () => {
    // First response: draw rect
    provider.addResponse(
      [
        {
          id: 'call_1',
          name: 'draw_rect',
          input: { name: 'wall', x: 0, y: 0, width: 100, height: 200 },
        },
      ],
      false
    );
    // Second response: draw circle
    provider.addResponse(
      [
        {
          id: 'call_2',
          name: 'draw_circle',
          input: { name: 'window', x: 50, y: 50, radius: 20 },
        },
      ],
      false
    );
    // Third response: complete
    provider.addCompletionResponse('Drew wall and window');

    const result = await runAgentLoop(provider, executor, 'Draw a house');

    expect(result).toBe('Drew wall and window');
    expect(executor.getEntityCount()).toBe(2);
  });

  it('should pass correct domains to provider', async () => {
    provider.addCompletionResponse('Done');

    await runAgentLoop(provider, executor, 'Test', {
      domains: ['primitives'],
    });

    // Should only have primitives tools (4 tools)
    expect(provider.sentTools).toHaveLength(4);
  });

  it('should throw on max iterations exceeded', async () => {
    // Always return tool calls, never complete
    for (let i = 0; i < 15; i++) {
      provider.addResponse(
        [{ id: `call_${i}`, name: 'draw_circle', input: { name: `c${i}`, x: 0, y: 0, radius: 1 } }],
        false
      );
    }

    await expect(
      runAgentLoop(provider, executor, 'Infinite loop', { maxIterations: 5 })
    ).rejects.toThrow('Max iterations (5) exceeded');
  });

  it('should handle empty tool calls as completion', async () => {
    // Response with no tool calls and not marked complete
    provider.addResponse([], false, 'Nothing to do');

    const result = await runAgentLoop(provider, executor, 'Do nothing');

    expect(result).toBe('Nothing to do');
  });

  it('should use default domains when not specified', async () => {
    provider.addCompletionResponse('Done');

    await runAgentLoop(provider, executor, 'Test');

    // Default: primitives (4) + style (4) + export (1) = 9 tools
    expect(provider.sentTools).toHaveLength(9);
  });
});
