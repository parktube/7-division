/**
 * Anthropic Provider Adapter
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ToolCall } from './types.js';
import type { ToolSchema } from '../schema.js';
import type { ToolResult } from '../executor.js';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(apiKey?: string, model = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /**
   * Canonical → Anthropic tool format
   */
  convertToolSchema(tool: ToolSchema): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: tool.parameters.type,
        properties: tool.parameters.properties as Record<string, Anthropic.Tool.InputSchema>,
        required: tool.parameters.required,
      },
    };
  }

  /**
   * Anthropic 응답 → ToolCall[] 추출
   */
  parseResponse(response: Anthropic.Message): [ToolCall[], boolean] {
    const isComplete = response.stop_reason === 'end_turn';
    const toolCalls: ToolCall[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((block) => ({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      }));
    return [toolCalls, isComplete];
  }

  /**
   * 응답에서 텍스트 추출
   */
  extractText(response: Anthropic.Message): string {
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  /**
   * User 메시지 생성
   */
  buildUserMessage(content: string): Anthropic.MessageParam {
    return { role: 'user', content };
  }

  /**
   * Tool results 메시지 생성
   */
  buildToolResultMessage(results: ToolResult[], callIds: string[]): Anthropic.MessageParam {
    const content: Anthropic.ToolResultBlockParam[] = results.map((result, i) => ({
      type: 'tool_result',
      tool_use_id: callIds[i],
      content: JSON.stringify(result),
    }));
    return { role: 'user', content };
  }

  /**
   * 응답 → 메시지 변환 (히스토리용)
   */
  responseToMessage(response: Anthropic.Message): Anthropic.MessageParam {
    return { role: 'assistant', content: response.content };
  }

  async sendMessage(
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[]
  ): Promise<Anthropic.Message> {
    return this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages,
      tools,
    });
  }
}
