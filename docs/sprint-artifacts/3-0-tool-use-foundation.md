# Story 3.0: Tool Use Foundation (에이전트 런타임)

Status: done

## Story

As a **AI 에이전트 (any LLM)**,
I want **CAD 도구를 LLM-agnostic한 tool_use 스키마로 직접 호출할 수 있도록**,
So that **스크립트 작성 없이 도구를 자기 몸처럼 사용할 수 있고, 다른 LLM으로도 교체 가능하다**.

## Background

### 현재 문제

```text
1. Claude가 "원을 그려줘" 요청 받음
2. Claude가 JavaScript 스크립트 작성
3. 스크립트가 WASM 함수 호출
4. 결과를 Claude가 다시 해석

문제점:
- Float64Array, JSON.stringify 등 보일러플레이트 반복
- 스크립트 작성/실행/파싱 오버헤드
- 에러 발생 시 디버깅 어려움
- 도구를 "자기 몸처럼" 사용하지 못함
- 특정 LLM에 종속됨
```

### 목표 상태

```text
1. LLM이 "원을 그려줘" 요청 받음
2. LLM이 tool_use 블록 생성: { name: "draw_circle", input: {...} }
3. 에이전트 런타임이 WASM 함수 직접 호출
4. 결과를 tool_result로 LLM에게 반환

장점:
- 스크립트 없이 직접 도구 호출
- 입력 변환 자동화 (배열 → Float64Array)
- 구조화된 결과 반환
- LLM이 도구를 "자기 몸처럼" 사용
- Anthropic, OpenAI, Google 등 LLM 교체 가능
```

## Acceptance Criteria

### AC1: Canonical 도구 스키마 정의

**Given** CAD 도구가 정의된 상태
**When** 도구 스키마를 조회
**Then** 각 도구의 name, description, parameters가 **내부 표준 포맷**으로 반환된다
**And** 이 포맷은 특정 LLM 벤더에 종속되지 않는다

### AC2: WASM Executor 래핑

**Given** tool_use 입력이 주어진 경우 (예: points: [0, 0, 100, 100])
**When** WASM Executor가 실행
**Then** 입력이 WASM 형식으로 자동 변환된다 (Float64Array)
**And** style 객체가 있으면 내부에서 JSON.stringify하여 WASM에 전달한다
**And** style이 생략되면 빈 객체('{}')가 사용된다
**And** 결과가 내부 ToolResult 포맷으로 반환된다

### AC3: Provider-Agnostic 에이전트 런타임

**Given** LLMProvider 인터페이스를 구현한 adapter가 주입된 경우
**When** 에이전트 런타임이 동작
**Then** provider에 맞는 tool schema 포맷으로 변환하여 전달한다
**And** provider 응답에서 tool_use를 파싱하여 Executor 호출한다
**And** 결과를 provider 포맷의 tool_result로 변환하여 반환한다

### AC4: Progressive Exposure API (런타임 내부 Pre-filter)

**Given** 런타임이 LLM에 도구를 전달하기 전
**When** getToolsForDomains(domains) 호출로 필요한 도메인만 선택
**Then** 선택된 도메인의 도구만 LLM에 노출된다
**And** 전체 API 대비 컨텍스트 토큰을 절약한다 (~2000 → ~110 토큰)

> **Note**: Progressive Exposure는 **런타임 내부 pre-filter**입니다.
> LLM이 직접 호출하는 discovery tool이 아니라, 앱이 사전에 도메인을 선택합니다.
> 런타임은 canonical 스키마를 provider adapter로 변환하여 LLM에 전달합니다.

### AC5: LLM Provider Adapter

**Given** Anthropic adapter가 구현된 상태
**When** 다른 LLM (OpenAI 등)을 사용하려는 경우
**Then** 해당 LLM용 adapter만 추가하면 동일한 executor 재사용 가능
**And** schema.ts, executor.ts, discovery.ts는 수정 불필요

## Tasks / Subtasks

- [x] **Task 1: cad-tools 디렉토리 구조 생성** (AC: #1)
  - [x] 1.1: `cad-tools/` 디렉토리 생성
  - [x] 1.2: `package.json` 생성 (TypeScript + Vitest)
  - [x] 1.3: `tsconfig.json` 설정

- [x] **Task 2: Canonical 도구 스키마 정의** (AC: #1)
  - [x] 2.1: `schema.ts` - 내부 표준 ToolSchema 타입 정의
  - [x] 2.2: primitives 도메인: draw_circle, draw_line, draw_rect, draw_arc
  - [x] 2.3: style 도메인: set_stroke, set_fill, remove_stroke, remove_fill
  - [x] 2.4: export 도메인: export_json
  > **Note**: transforms (translate, rotate, scale, delete), export_svg는 Story 3.1~3.6 완료 후 추가

- [x] **Task 3: Progressive Exposure API 구현** (AC: #4)
  - [x] 3.1: `discovery.ts` 파일 생성
  - [x] 3.2: listDomains() - 도메인 목록 반환
  - [x] 3.3: listTools(domain) - 도메인별 도구 이름 목록
  - [x] 3.4: getTool(name) - 특정 도구의 canonical 스키마 반환
  - [x] 3.5: getToolsForDomains(domains) - 런타임용 도구 배열 반환

- [x] **Task 4: WASM Executor 구현** (AC: #2)
  - [x] 4.1: `executor.ts` 파일 생성
  - [x] 4.2: CADExecutor 클래스 (LLM 무관, WASM만 래핑)
  - [x] 4.3: 입력 변환 로직 (배열 → Float64Array, 기본값 처리)
  - [x] 4.4: 내부 ToolResult 포맷 정의

- [x] **Task 5: LLM Provider Adapter 구현** (AC: #5)
  - [x] 5.1: `providers/types.ts` - LLMProvider 인터페이스 정의
  - [x] 5.2: `providers/anthropic.ts` - Anthropic adapter 구현
  - [x] 5.3: convertToolSchema(): canonical → Anthropic tool format
  - [x] 5.4: parseResponse(): Anthropic response → internal ToolCall[]
  - [x] 5.5: extractText(): 응답에서 텍스트 추출
  - [x] 5.6: buildUserMessage() / buildToolResultMessage(): 메시지 생성
  - [x] 5.7: responseToMessage(): 히스토리 저장용 변환

- [x] **Task 6: Provider-Agnostic 런타임 구현** (AC: #3, #4)
  - [x] 6.1: `runtime.ts` - LLMProvider 주입 받는 runAgentLoop()
  - [x] 6.2: Progressive Exposure로 도메인별 도구 선택
  - [x] 6.3: 다중 tool_use 올바르게 처리

- [x] **Task 7: 통합 테스트 (Vitest)** (AC: #1~#5)
  - [x] 7.1: schema.test.ts - canonical 스키마 테스트
  - [x] 7.2: discovery.test.ts - Progressive Exposure API 테스트
  - [x] 7.3: executor.test.ts - WASM 입력 변환 테스트
  - [x] 7.4: providers/anthropic.test.ts - adapter 변환 테스트
  - [x] 7.5: runtime.test.ts - 모의 provider로 E2E 테스트

## Dev Notes

### Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     LLM-Agnostic Foundation                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │  schema.ts   │   │ discovery.ts │   │     executor.ts          │ │
│  │ (canonical)  │   │ (조회 API)   │   │ (WASM 래퍼, LLM 무관)    │ │
│  └──────┬───────┘   └──────┬───────┘   └────────────┬─────────────┘ │
│         │                  │                        │               │
│         └────────┬─────────┘                        │               │
│                  │                                  │               │
│                  ▼                                  │               │
│  ┌───────────────────────────────────┐              │               │
│  │         runtime.ts                │──────────────┘               │
│  │  (provider-agnostic loop)         │                              │
│  └───────────────┬───────────────────┘                              │
│                  │                                                   │
│                  │ LLMProvider interface                            │
│                  ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    providers/                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │  │
│  │  │ anthropic.ts│  │  openai.ts  │  │   (future: gemini)  │    │  │
│  │  │  adapter    │  │  adapter    │  │                     │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Canonical Tool Schema (LLM-agnostic)

```typescript
// cad-tools/src/schema.ts

/**
 * 내부 표준 도구 스키마 - 특정 LLM에 종속되지 않음
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ParameterSchema>;
    required: string[];
  };
}

export interface ParameterSchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  items?: ParameterSchema;  // array인 경우
}

// 도메인 정의 (현재 WASM에 구현된 도구만)
export const DOMAINS = {
  primitives: ["draw_line", "draw_circle", "draw_rect", "draw_arc"],
  style: ["set_stroke", "set_fill", "remove_stroke", "remove_fill"],
  export: ["export_json"]
  // transforms: Story 3.1~3.4 완료 후 추가 (translate, rotate, scale, delete)
  // export_svg: Story 3.6 완료 후 추가
} as const;

export type DomainName = keyof typeof DOMAINS;

// Canonical 스키마 정의
export const CAD_TOOLS: Record<string, ToolSchema> = {
  draw_circle: {
    name: "draw_circle",
    description: "원을 그립니다. 머리, 관절, 버튼 등에 사용",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "엔티티 이름 (예: 'head')" },
        x: { type: "number", description: "중심 x 좌표" },
        y: { type: "number", description: "중심 y 좌표" },
        radius: { type: "number", description: "반지름 (양수)" },
        style: { type: "object", description: "스타일 객체 (선택). 예: { stroke: { color: [r,g,b,a], width: 2 }, fill: { color: [r,g,b,a] } }" }
      },
      required: ["name", "x", "y", "radius"]
    }
  },
  draw_line: {
    name: "draw_line",
    description: "선분을 그립니다. 척추, 팔, 다리 등에 사용",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "엔티티 이름" },
        points: {
          type: "array",
          items: { type: "number" },
          description: "[x1, y1, x2, y2, ...] 형태의 좌표 배열"
        },
        style: { type: "object", description: "스타일 객체 (선택)" }
      },
      required: ["name", "points"]
    }
  }
  // ... draw_rect, draw_arc, set_stroke, set_fill, remove_stroke, remove_fill, export_json
};
```

### LLM Provider Interface

```typescript
// cad-tools/src/providers/types.ts
import type { ToolSchema } from '../schema.js';

/**
 * 내부 표준 - tool 호출 정보
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * 내부 표준 - tool 실행 결과
 */
export interface ToolResult {
  success: boolean;
  entity?: string;
  type?: string;
  error?: string;
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
  sendMessage(
    messages: unknown[],
    tools: unknown[]
  ): Promise<unknown>;
}
```

### Anthropic Adapter

```typescript
// cad-tools/src/providers/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ToolCall, ToolResult } from './types.js';
import type { ToolSchema } from '../schema.js';

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
      input_schema: tool.parameters
    };
  }

  /**
   * Anthropic 응답 → ToolCall[] 추출
   */
  parseResponse(response: Anthropic.Message): [ToolCall[], boolean] {
    const isComplete = response.stop_reason === 'end_turn';
    const toolCalls: ToolCall[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map(block => ({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>
      }));
    return [toolCalls, isComplete];
  }

  /**
   * 응답에서 텍스트 추출
   */
  extractText(response: Anthropic.Message): string {
    const textBlock = response.content.find(b => b.type === 'text');
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
      content: JSON.stringify(result)
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
      max_tokens: 1024,
      messages,
      tools
    });
  }
}
```

### Provider-Agnostic Runtime

```typescript
// cad-tools/src/runtime.ts
import type { LLMProvider, ToolCall, ToolResult } from './providers/types.js';
import type { DomainName, ToolSchema } from './schema.js';
import { getToolsForDomains } from './discovery.js';
import { CADExecutor } from './executor.js';

export interface AgentOptions {
  domains?: DomainName[];
}

export async function runAgentLoop(
  provider: LLMProvider,          // Provider-agnostic!
  executor: CADExecutor,
  userMessage: string,
  options: AgentOptions = {}
): Promise<string> {
  // 1. Progressive Exposure: 필요한 도메인의 canonical 스키마
  const domains = options.domains || ['primitives', 'style', 'export'];
  const canonicalTools: ToolSchema[] = getToolsForDomains(domains);

  // 2. Provider 포맷으로 변환
  const providerTools = canonicalTools.map(t => provider.convertToolSchema(t));

  // 3. 메시지 초기화 - provider가 포맷 결정
  const messages: unknown[] = [
    provider.buildUserMessage(userMessage)
  ];

  while (true) {
    // 4. Provider로 메시지 전송
    const response = await provider.sendMessage(messages, providerTools);

    // 5. 응답 파싱
    const [toolCalls, isComplete] = provider.parseResponse(response);

    if (isComplete) {
      // Provider가 텍스트 추출 책임
      return provider.extractText(response);
    }

    if (toolCalls.length === 0) break;

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

  return '';
}
```

### WASM Executor (LLM-agnostic)

```typescript
// cad-tools/src/executor.ts
import { Scene, init } from '../../cad-engine/pkg/cad_engine.js';
import type { ToolResult } from './providers/types.js';

/**
 * CAD Executor - LLM과 무관하게 WASM만 래핑
 * 입력: 표준 JavaScript 타입 (style은 객체)
 * 출력: 내부 ToolResult
 *
 * 중요: style 객체를 WASM이 요구하는 JSON 문자열로 변환
 */
export class CADExecutor {
  private scene: Scene;

  private constructor(scene: Scene) {
    this.scene = scene;
  }

  static create(sceneName: string): CADExecutor {
    init();
    return new CADExecutor(new Scene(sceneName));
  }

  /**
   * style 객체를 JSON 문자열로 변환 (WASM 경계 처리)
   */
  private styleToJson(style: unknown): string {
    if (!style) return '{}';
    return JSON.stringify(style);
  }

  exec(toolName: string, input: Record<string, unknown>): ToolResult {
    try {
      const styleJson = this.styleToJson(input.style);  // LLM은 객체, WASM은 문자열

      switch (toolName) {
        // === primitives ===
        case 'draw_circle':
          return {
            success: true,
            entity: this.scene.draw_circle(
              input.name as string,
              input.x as number, input.y as number,
              input.radius as number,
              styleJson  // 내부에서 변환된 JSON 문자열
            ),
            type: 'circle'
          };

        case 'draw_line':
          return {
            success: true,
            entity: this.scene.draw_line(
              input.name as string,
              new Float64Array(input.points as number[]),
              styleJson
            ),
            type: 'line'
          };

        case 'draw_rect':
          return {
            success: true,
            entity: this.scene.draw_rect(
              input.name as string,
              input.x as number, input.y as number,
              input.width as number, input.height as number,
              styleJson
            ),
            type: 'rect'
          };

        case 'draw_arc':
          return {
            success: true,
            entity: this.scene.draw_arc(
              input.name as string,
              input.cx as number, input.cy as number,
              input.radius as number,
              input.start_angle as number, input.end_angle as number,
              styleJson
            ),
            type: 'arc'
          };

        // === style ===
        case 'set_stroke':
          return {
            success: this.scene.set_stroke(input.name as string, this.toJson(input.stroke)),
            entity: input.name as string
          };

        case 'set_fill':
          return {
            success: this.scene.set_fill(input.name as string, this.toJson(input.fill)),
            entity: input.name as string
          };

        case 'remove_stroke':
          return {
            success: this.scene.remove_stroke(input.name as string),
            entity: input.name as string
          };

        case 'remove_fill':
          return {
            success: this.scene.remove_fill(input.name as string),
            entity: input.name as string
          };

        // === export ===
        case 'export_json':
          return { success: true, type: 'json', entity: this.scene.export_json() };

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  exportScene(): string {
    return this.scene.export_json();
  }

  free(): void {
    this.scene.free();
  }
}
```

### 사용 예시

```typescript
// Anthropic 사용
import { AnthropicProvider } from './providers/anthropic.js';
import { CADExecutor } from './executor.js';
import { runAgentLoop } from './runtime.js';

const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
const executor = CADExecutor.create('my-scene');

// 기본: primitives, style, export 도메인 사용
const result = await runAgentLoop(
  provider,
  executor,
  '빨간 원을 그려줘'
);

// 도메인 선택: primitives만 사용
const result2 = await runAgentLoop(
  provider,
  executor,
  '사람 스켈레톤을 그려줘',
  { domains: ['primitives'] }
);

// OpenAI 사용 (adapter 추가 후)
// const provider = new OpenAIProvider(process.env.OPENAI_API_KEY);
// const result = await runAgentLoop(provider, executor, '...');
```

### 디렉토리 구조

```text
cad-tools/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── schema.ts           # Canonical 스키마 (LLM-agnostic)
│   ├── discovery.ts        # Progressive Exposure API
│   ├── executor.ts         # WASM 래퍼 (LLM-agnostic)
│   ├── runtime.ts          # Provider-agnostic 에이전트 루프
│   ├── providers/
│   │   ├── types.ts        # LLMProvider 인터페이스
│   │   ├── anthropic.ts    # Anthropic adapter
│   │   └── openai.ts       # (Phase 2) OpenAI adapter
│   └── index.ts
└── tests/
    ├── schema.test.ts
    ├── discovery.test.ts
    ├── executor.test.ts
    ├── providers/
    │   └── anthropic.test.ts
    └── runtime.test.ts
```

### 아키텍처 경계

```text
┌─────────────────────────────────────────────────────────────────┐
│                    cad-tools (Node.js)                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Foundation Layer (LLM-agnostic)           │   │
│  │  schema.ts │ discovery.ts │ executor.ts │ runtime.ts    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ LLMProvider interface            │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Provider Layer (adapters)                  │   │
│  │  anthropic.ts │ openai.ts │ (future providers)           │   │
│  └───────────────────────────┬─────────────────────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Anthropic API   │  │   OpenAI API    │  │  (Future LLMs)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 3가지 WASM 접근 경로 (업데이트)

| 경로 | 사용자 | 런타임 | LLM | 도구 사용법 |
|------|--------|--------|-----|-------------|
| **1. CLI LLM** | Claude Code, Cursor | 내장 | 내장 | schema.ts + executor.ts |
| **2. BYOK** | 사용자 API 키 | 우리 제공 | Anthropic/OpenAI | runtime.ts + provider |
| **3. SaaS** | 우리 API | 우리 제공 | 선택 가능 | runtime.ts + provider |

### Project Structure Notes

- Epic 3의 전제조건 (3.1~3.6 전에 완료 필요)
- **LLM-agnostic Foundation**: 새 LLM 추가 시 adapter만 구현
- Phase 1: Anthropic adapter 구현
- Phase 2+: OpenAI, Gemini adapter 추가 가능
- 테스트: Vitest (프로젝트 표준)

### Tool 확장성 (각 스토리 책임)

> **원칙**: 새 WASM 함수를 구현하는 스토리가 **직접 Tool을 등록**합니다.
> Story 3.0은 Foundation만 제공하고, 개별 도구 등록은 각 스토리에서 수행합니다.

```text
Story 3.1 (Translate) → schema.ts에 translate 추가, executor.ts에 case 추가
Story 3.2 (Rotate)    → schema.ts에 rotate 추가, executor.ts에 case 추가
Story 3.3 (Scale)     → schema.ts에 scale 추가, executor.ts에 case 추가
Story 3.4 (Delete)    → schema.ts에 delete 추가, executor.ts에 case 추가
Story 3.6 (SVG Export) → schema.ts에 export_svg 추가, executor.ts에 case 추가
```

각 스토리는 WASM 구현과 함께 **Tool Use 등록 Task**를 포함합니다.

### Dependencies

- Story 1.2 (Scene 클래스)
- Story 2.1 (JSON Export)
- **cad-engine WASM 빌드 완료** (Node.js 타겟)

### Prerequisites (테스트 실행 전)

```bash
# WASM 패키지 빌드 필요 (executor.test.ts가 의존)
cd cad-engine
wasm-pack build --target nodejs --dev

# 패키지 확인
ls pkg/cad_engine.js pkg/cad_engine.d.ts
```

> **Note**: executor.test.ts와 runtime.test.ts는 WASM 패키지에 직접 의존합니다.
> CI에서는 `npm run build:wasm` 스크립트가 선행되어야 합니다.

### WASM 초기화 전제

```typescript
// cad-engine의 init()은 동기 함수
import { Scene, init } from '../cad-engine/pkg/cad_engine.js';
init();  // 동기 호출
const scene = new Scene("test");
```

## References

- [Source: docs/architecture.md#Tool Use Foundation]
- [Source: docs/prd.md#Tool Use Foundation]
- [Source: docs/epics.md#Story 3.0]

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

- cad-tools/package.json (신규)
- cad-tools/tsconfig.json (신규)
- cad-tools/vitest.config.ts (신규)
- cad-tools/src/schema.ts (신규) - Canonical 스키마
- cad-tools/src/discovery.ts (신규)
- cad-tools/src/executor.ts (신규)
- cad-tools/src/runtime.ts (신규) - Provider-agnostic
- cad-tools/src/providers/types.ts (신규) - LLMProvider 인터페이스
- cad-tools/src/providers/anthropic.ts (신규) - Anthropic adapter
- cad-tools/src/index.ts (신규)
