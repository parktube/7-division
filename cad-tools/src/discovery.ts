/**
 * Progressive Exposure API - 런타임 내부 Pre-filter
 * LLM에 전달할 도구를 도메인별로 선택
 */

import { DOMAINS, CAD_TOOLS, type DomainName, type ToolSchema } from './schema.js';

/**
 * 사용 가능한 도메인 목록 반환
 */
export function listDomains(): DomainName[] {
  return Object.keys(DOMAINS) as DomainName[];
}

/**
 * 특정 도메인의 도구 이름 목록 반환
 */
export function listTools(domain: DomainName): string[] {
  return [...DOMAINS[domain]];
}

/**
 * 특정 도구의 canonical 스키마 반환
 */
export function getTool(name: string): ToolSchema | undefined {
  return CAD_TOOLS[name];
}

/**
 * 여러 도메인의 도구 스키마 배열 반환 (런타임용)
 */
export function getToolsForDomains(domains: DomainName[]): ToolSchema[] {
  const tools: ToolSchema[] = [];

  for (const domain of domains) {
    const toolNames = DOMAINS[domain];
    for (const name of toolNames) {
      const tool = CAD_TOOLS[name];
      if (tool) {
        tools.push(tool);
      }
    }
  }

  return tools;
}

/**
 * 모든 도구 스키마 반환
 */
export function getAllTools(): ToolSchema[] {
  return Object.values(CAD_TOOLS);
}
