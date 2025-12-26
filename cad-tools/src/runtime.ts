/**
 * Provider-Agnostic Agent Runtime
 */

import type { LLMProvider } from './providers/types.js';
import type { DomainName, ToolSchema } from './schema.js';
import { getToolsForDomains } from './discovery.js';
import { CADExecutor, type ToolResult } from './executor.js';

export interface AgentOptions {
  domains?: DomainName[];
  maxIterations?: number;
}

const DEFAULT_DOMAINS: DomainName[] = ['primitives', 'style', 'export'];
const DEFAULT_MAX_ITERATIONS = 10;

/**
 * Provider-agnostic 에이전트 루프 실행
 */
export async function runAgentLoop(
  provider: LLMProvider,
  executor: CADExecutor,
  userMessage: string,
  options: AgentOptions = {}
): Promise<string> {
  const domains = options.domains || DEFAULT_DOMAINS;
  const maxIterations = options.maxIterations || DEFAULT_MAX_ITERATIONS;

  // 1. Progressive Exposure: 필요한 도메인의 canonical 스키마
  const canonicalTools: ToolSchema[] = getToolsForDomains(domains);

  // 2. Provider 포맷으로 변환
  const providerTools = canonicalTools.map((t) => provider.convertToolSchema(t));

  // 3. 메시지 초기화 - provider가 포맷 결정
  const messages: unknown[] = [provider.buildUserMessage(userMessage)];

  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    // 4. Provider로 메시지 전송
    const response = await provider.sendMessage(messages, providerTools);

    // 5. 응답 파싱
    const [toolCalls, isComplete] = provider.parseResponse(response);

    if (isComplete) {
      // Provider가 텍스트 추출 책임
      return provider.extractText(response);
    }

    if (toolCalls.length === 0) {
      // 도구 호출도 없고 완료도 아닌 경우
      return provider.extractText(response);
    }

    // 6. Assistant 응답 추가 - provider가 변환
    messages.push(provider.responseToMessage(response));

    // 7. 모든 tool 실행 및 결과 수집
    const results: ToolResult[] = [];
    const callIds: string[] = [];
    for (const call of toolCalls) {
      results.push(executor.exec(call.name, call.input));
      callIds.push(call.id);
    }

    // 8. Tool 결과 추가 - provider가 포맷
    messages.push(provider.buildToolResultMessage(results, callIds));
  }

  throw new Error(`Max iterations (${maxIterations}) exceeded`);
}
