/**
 * Anthropic Provider Adapter
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ToolCall } from './types.js';
import type { ToolSchema } from '../schema.js';
import type { ToolResult } from '../executor.js';

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;
const MIN_MAX_TOKENS = 1;
const MAX_MAX_TOKENS = 8192;

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(options: AnthropicProviderOptions = {}) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model || DEFAULT_MODEL;

    // Validate maxTokens
    const tokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    if (tokens < MIN_MAX_TOKENS || tokens > MAX_MAX_TOKENS) {
      throw new Error(`maxTokens must be between ${MIN_MAX_TOKENS} and ${MAX_MAX_TOKENS}, got ${tokens}`);
    }
    this.maxTokens = tokens;
  }

  /**
   * Canonical → Anthropic tool format
   *
   * Note: We use `as unknown as` for properties because Anthropic SDK's InputSchema
   * type doesn't include 'items' for array schemas. This is a known SDK limitation.
   * Runtime works correctly as the API accepts full JSON Schema.
   */
  convertToolSchema(tool: ToolSchema): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: tool.parameters.type,
        properties: tool.parameters.properties as unknown as Record<string, Anthropic.Tool.InputSchema>,
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
   * @throws Error if results and callIds arrays have different lengths
   */
  buildToolResultMessage(results: ToolResult[], callIds: string[]): Anthropic.MessageParam {
    if (results.length !== callIds.length) {
      throw new Error(`results and callIds must have same length: ${results.length} vs ${callIds.length}`);
    }
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

  /**
   * LLM에 메시지 전송
   *
   * @throws Error - API 호출 실패 시 (rate limit, auth, network 등)
   */
  async sendMessage(
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[]
  ): Promise<Anthropic.Message> {
    try {
      return await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages,
        tools,
      });
    } catch (error) {
      // Rate limit 에러 처리
      if (error instanceof Anthropic.RateLimitError) {
        const retryAfter = error.headers?.get?.('retry-after');
        console.error('[AnthropicProvider.sendMessage] Rate limit exceeded', {
          model: this.model,
          retryAfter,
        });
        throw new Error('Anthropic rate limit exceeded. Please wait before retrying.');
      }

      // 인증 에러 처리
      if (error instanceof Anthropic.AuthenticationError) {
        console.error('[AnthropicProvider.sendMessage] Authentication failed');
        throw new Error('Anthropic API authentication failed. Check your API key.');
      }

      // 기타 API 에러 로깅
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[AnthropicProvider.sendMessage] API call failed', {
        model: this.model,
        maxTokens: this.maxTokens,
        messageCount: messages.length,
        toolCount: tools.length,
        error: errorMessage,
      });
      throw error;
    }
  }
}
