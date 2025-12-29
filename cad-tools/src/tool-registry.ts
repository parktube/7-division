/**
 * Tool Registry - 도구 메타데이터 관리 및 요청 큐
 * LLM이 도구를 탐색하고 새 도구를 요청할 수 있게 함
 */

import { DOMAINS, DOMAIN_METADATA, CAD_TOOLS, type DomainName, type ToolSchema } from './schema.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 도메인 정보 (LLM 응답용)
 */
export interface DomainInfo {
  domain: string;
  description: string;
  count: number;
}

/**
 * 도구 요약 정보 (list_tools 응답용)
 */
export interface ToolSummary {
  name: string;
  description: string;
}

/**
 * 도구 요청 (request_tool 입력)
 */
export interface ToolRequest {
  id: string;
  name: string;
  description: string;
  rationale: string;
  suggested_params?: string[];
  status: 'queued' | 'approved' | 'rejected';
  created_at: string;
}

/**
 * ToolRegistry - 도구 메타데이터 싱글톤
 */
export class ToolRegistry {
  private static instance: ToolRegistry | null = null;
  private requests: ToolRequest[] = [];
  private requestsFilePath: string;

  private constructor(requestsFilePath?: string) {
    this.requestsFilePath = requestsFilePath || path.join(process.cwd(), 'tool-requests.json');
    this.loadRequests();
  }

  /**
   * 싱글톤 인스턴스 획득
   */
  static getInstance(requestsFilePath?: string): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry(requestsFilePath);
    }
    return ToolRegistry.instance;
  }

  /**
   * 테스트용: 인스턴스 리셋
   */
  static resetInstance(): void {
    ToolRegistry.instance = null;
  }

  /**
   * 모든 도메인 목록 반환
   */
  listDomains(): DomainInfo[] {
    return (Object.keys(DOMAINS) as DomainName[]).map((domain) => ({
      domain,
      description: DOMAIN_METADATA[domain]?.description || '',
      count: DOMAINS[domain].length,
    }));
  }

  /**
   * 도메인별 도구 목록 반환
   * @param domain 도메인 이름 (생략 시 전체)
   */
  listTools(domain?: string): { domain: string | null; tools: ToolSummary[] } {
    if (domain && domain in DOMAINS) {
      const toolNames = DOMAINS[domain as DomainName];
      return {
        domain,
        tools: toolNames.map((name) => ({
          name,
          description: CAD_TOOLS[name]?.description || '',
        })),
      };
    }

    // 전체 도구 반환
    return {
      domain: null,
      tools: Object.values(CAD_TOOLS).map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    };
  }

  /**
   * 도구 스키마 조회
   * @returns 스키마 또는 null (존재하지 않는 경우)
   */
  getToolSchema(name: string): ToolSchema | null {
    return CAD_TOOLS[name] || null;
  }

  /**
   * 유사 도구 이름 검색 (prefix/contains 매칭)
   */
  findSimilar(name: string): string[] {
    const allTools = Object.keys(CAD_TOOLS);
    const prefix = name.slice(0, 4).toLowerCase();
    const searchTerm = name.toLowerCase();

    return allTools.filter((tool) => {
      const toolLower = tool.toLowerCase();
      return (
        toolLower.startsWith(prefix) ||
        toolLower.includes(searchTerm) ||
        searchTerm.includes(toolLower.slice(0, -1))
      );
    });
  }

  /**
   * 도구 요청 추가
   */
  requestTool(request: {
    name: string;
    description: string;
    rationale: string;
    suggested_params?: string[];
  }): ToolRequest {
    const newRequest: ToolRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: request.name,
      description: request.description,
      rationale: request.rationale,
      suggested_params: request.suggested_params,
      status: 'queued',
      created_at: new Date().toISOString(),
    };

    this.requests.push(newRequest);
    this.saveRequests();

    return newRequest;
  }

  /**
   * 요청 목록 조회
   */
  listRequests(status?: 'queued' | 'approved' | 'rejected'): ToolRequest[] {
    if (status) {
      return this.requests.filter((r) => r.status === status);
    }
    return [...this.requests];
  }

  /**
   * 요청 파일 로드
   */
  private loadRequests(): void {
    try {
      if (fs.existsSync(this.requestsFilePath)) {
        const data = fs.readFileSync(this.requestsFilePath, 'utf-8');
        this.requests = JSON.parse(data);
      }
    } catch {
      // 파일이 없거나 파싱 실패 시 빈 배열로 시작
      this.requests = [];
    }
  }

  /**
   * 요청 파일 저장
   */
  private saveRequests(): void {
    try {
      fs.writeFileSync(this.requestsFilePath, JSON.stringify(this.requests, null, 2));
    } catch {
      // 저장 실패 시 무시 (로그는 선택적)
    }
  }
}
