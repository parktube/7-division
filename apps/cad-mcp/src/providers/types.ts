/**
 * LLM Provider Types - LLM-agnostic 인터페이스
 */

import type { ToolSchema } from '../schema.js';
import type { ToolResult } from '../executor.js';

/**
 * 도구 호출 정보 (내부 표준)
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * LLM Provider 인터페이스 - 새 LLM 추가 시 이것만 구현
 */
export interface LLMProvider {
  readonly name: string;

  /**
   * Canonical 스키마 → Provider 스키마로 변환
   */
  convertToolSchema(tool: ToolSchema): unknown;

  /**
   * Provider 응답에서 ToolCall 배열 추출
   * @returns [toolCalls, isComplete] - isComplete: 대화 종료 여부
   */
  parseResponse(response: unknown): [ToolCall[], boolean];

  /**
   * Provider 응답에서 텍스트 추출
   */
  extractText(response: unknown): string;

  /**
   * User 메시지 생성 (provider 포맷)
   */
  buildUserMessage(content: string): unknown;

  /**
   * Tool results를 포함한 User 메시지 생성
   * @precondition results.length === callIds.length (index 매칭)
   */
  buildToolResultMessage(results: ToolResult[], callIds: string[]): unknown;

  /**
   * Assistant 응답을 메시지로 변환 (히스토리 저장용)
   */
  responseToMessage(response: unknown): unknown;

  /**
   * 메시지 전송 (tool 포함)
   */
  sendMessage(messages: unknown[], tools: unknown[]): Promise<unknown>;
}
