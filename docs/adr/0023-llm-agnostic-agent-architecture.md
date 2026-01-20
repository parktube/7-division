# ADR 0023: LLM-Agnostic Agent Architecture

**Status:** Accepted (PoC Validated)
**Date:** 2026-01-10
**Context:** Epic 9 MAMA Integration

---

## 1. 요약

CAD 도구는 **어떤 LLM에서도 동작**해야 합니다. Claude Code CLI 뿐만 아니라, API 기반 LLM(Claude API, OpenAI, Ollama 등)에서도 동일한 도구를 사용할 수 있어야 합니다.

본 문서는 PoC를 통해 검증된 LLM-Agnostic 아키텍처를 정의합니다.

---

## 2. 접근 방식 비교

### 2.1 CLI 방식 (Claude Code)

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code 프로세스                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User: "원 그려줘"                                          │
│           ↓                                                 │
│  Claude (내장 LLM)                                          │
│           ↓                                                 │
│  "run_cad_code 호출해야겠다"                                 │
│           ↓                                                 │
│  Bash 실행: run_cad_code main "drawCircle(...)"             │
│           ↓                                                 │
│  결과 수신 → 자동으로 다음 추론                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**특징:**
- 단일 프로세스 내에서 모든 것 처리
- 도구 실행이 자동화됨
- API 호출 비용 없음 (로컬 추론 가능)
- Claude Code에 종속

### 2.2 Direct API 방식 (Function Calling)

```
┌─────────────────┐         ┌─────────────────┐
│    Your App     │         │   LLM API       │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │  1. 메시지 + 도구 정의 ──▶│
         │                           │
         │◀── 2. tool_use 반환 ──────│
         │                           │
    3. 로컬 실행                      │
    executeCode(...)                 │
         │                           │
         │  4. tool_result 전송 ────▶│
         │                           │
         │◀── 5. 최종 응답 ──────────│
         │                           │
```

**특징:**
- 핑퐁 방식 (여러 번 API 호출)
- 개발자가 루프 관리
- LLM 교체 가능 (Claude, OpenAI, Ollama...)
- API 비용 발생 (로컬 LLM 제외)

### 2.3 비교표

| 항목 | CLI (Claude Code) | Direct API |
|------|-------------------|------------|
| **도구 실행 주체** | Claude Code 내장 | 개발자 구현 |
| **API 호출 횟수** | 0회 (로컬) | 여러 번 |
| **루프 관리** | 자동 | 개발자 책임 |
| **LLM 교체** | ❌ 불가 | ✅ 가능 |
| **비용** | $0 | API별 상이 |
| **오프라인** | ✅ 가능 | 로컬 LLM만 |

---

## 3. 아키텍처

### 3.1 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                     Entry Points (진입점)                    │
├──────────────┬──────────────┬──────────────┬───────────────┤
│   CLI        │  Agent Loop  │  MCP Server  │  HTTP API     │
│ (현재)       │  (PoC 완료)  │  (향후)      │  (향후)       │
└──────┬───────┴──────┬───────┴──────┬───────┴───────┬───────┘
       │              │              │               │
       └──────────────┴──────────────┴───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Core Logic (핵심 로직)                   │
├─────────────────────────────────────────────────────────────┤
│  CADExecutor    │  Sandbox    │  Scene Manager  │  Modules  │
│  (executor.ts)  │  (sandbox/) │  (scene/)       │           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     CAD Engine (WASM)                        │
├─────────────────────────────────────────────────────────────┤
│  Primitives  │  Transforms  │  Boolean  │  Geometry         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 LLM Adapter 패턴

```typescript
// 공통 인터페이스
interface LLMAdapter {
  chat(messages: Message[], tools: ToolDef[]): Promise<LLMResponse>;
}

// Claude Adapter
class ClaudeAdapter implements LLMAdapter { ... }

// OpenAI Adapter
class OpenAIAdapter implements LLMAdapter { ... }

// Ollama Adapter (로컬)
class OllamaAdapter implements LLMAdapter { ... }
```

**원칙:** 도구 실행 로직은 LLM과 **완전 분리**. 어댑터만 교체하면 어떤 LLM이든 사용 가능.

---

## 4. MAMA의 역할

### 4.1 LLM 성능 보완

MAMA는 **외부 메모리 + 힌트 시스템**으로 작은 LLM의 한계를 보완합니다.

```
Without MAMA:
┌─────────────────────────────────┐
│  User: "벽 그려줘"              │
│           ↓                     │
│  Small LLM: "두께는? 위치는?"   │  ← 모든 것을 추론해야 함
│           ↓                     │
│  결과: 부정확                   │
└─────────────────────────────────┘

With MAMA:
┌─────────────────────────────────┐
│  User: "벽 그려줘"              │
│           ↓                     │
│  MAMA: "💡 표준: 150mm, (0,0)"  │  ← 컨텍스트 주입
│           ↓                     │
│  Small LLM: "표준대로 그릴게요" │
│           ↓                     │
│  결과: 정확 ✅                  │
└─────────────────────────────────┘
```

### 4.2 효과 예측

| LLM 크기 | Without MAMA | With MAMA | 개선 |
|---------|--------------|-----------|------|
| 70B+ (Claude, GPT-4) | 95% | 98% | +3% |
| 13B (Llama 13B) | 70% | 85% | +15% |
| 8B (Llama 8B) | 50% | 75% | **+25%** |
| 3B (Phi, Gemma) | 30% | 60% | **+30%** |

**핵심:** 작은 LLM일수록 MAMA 효과가 큼!

### 4.3 하이브리드 전략

```
설계/계획 단계:                    실행 단계:
┌──────────────────┐              ┌──────────────────┐
│  고지능 LLM       │              │  로컬 LLM        │
│  (Claude, GPT-4) │              │  (Ollama 8B)     │
├──────────────────┤              ├──────────────────┤
│  • 워크플로우 설계 │              │  • 단순 실행     │
│  • ActionHints   │      →       │  • MAMA 힌트 활용 │
│  • 결정 저장     │   MAMA DB    │  • 표준 따르기   │
│  • 품질 검증     │              │  • 비용 $0       │
└──────────────────┘              └──────────────────┘
```

---

## 5. PoC 결과

### 5.1 테스트 환경

- **하드웨어:** 32GB RAM, RTX 4070 (8GB VRAM)
- **테스트 모델:** 4종 (exaone 2.4B, qwen2.5 7B, llama3.1 8B, qwen3 8B)
- **추가 코드:** ~150줄 (ollama-poc.ts, exaone-poc.ts)

### 5.2 모델별 성능 비교

| 모델 | 크기 | 응답시간 | Tool Calling | 코드 품질 |
|------|------|----------|--------------|----------|
| **exaone3.5:2.4b** | 1.6GB | **8.7s** | ❌ Direct | ⭐⭐⭐ 상세 (문,창문까지) |
| llama3.1:8b-instruct | 4.9GB | 19.1s | ✅ | ⭐⭐ 기본 (wall, roof) |
| qwen3:8b | 5.2GB | 123.9s | ✅ | ⭐⭐ 중간 (+ 색상) |
| qwen2.5:7b-instruct | 4.7GB | 136.9s | ✅ | ⭐ 느림 |

**결론:**
- **가장 빠른 모델:** `exaone3.5:2.4b` (8.7초) - 가장 작은 모델이 가장 빠름
- **코드 품질 최고:** `exaone3.5:2.4b` - 집 그리기에서 벽, 지붕, 문, 창문까지 생성
- **Tool Calling 최고:** `llama3.1:8b` (19초) - 안정적

### 5.3 테스트 시나리오

| 테스트 | 명령 | 결과 |
|--------|------|------|
| 기본 생성 | "빨간 원 그려줘" | ✅ `drawCircle + setFill` |
| 복합 생성 | "로봇 그려줘 (머리, 몸, 발)" | ✅ 4개 엔티티 생성 |
| 수정 | "파란색으로 바꿔줘" | ✅ `setFill` 적용 |
| 이동 | "오른쪽으로 100 이동" | ✅ `translate` 적용 |
| MAMA 기본값 | "원 하나 그려줘" (크기 미지정) | ✅ MAMA 기본값 50 사용 |
| 복잡 워크플로우 | "집+태양+이동" (4단계) | ⚠️ 부분 성공 |

### 5.4 검증된 것

- ✅ 로컬 LLM이 도구 호출 가능
- ✅ 한국어/영어 프롬프트 이해
- ✅ 기존 CLI 코드 100% 재사용
- ✅ MAMA 컨텍스트가 LLM 정확도 향상
- ✅ 2.4B 모델도 CAD 작업 수행 가능

### 5.5 발견된 문제점

#### 5.5.1 Qwen3 Thinking Mode 문제

Qwen3:8b는 기본적으로 Thinking Mode가 활성화되어 있어 **설명만 하고 실제 도구를 호출하지 않음**.

```
User: "Draw a robot"
Qwen3 응답:
  "### 1. Body (Green Square)
   setFill([0, 1, 0, 1])
   drawRect(-50, -50, 100, 100)
   ..."
   ← 설명만 하고 tool_call 없음!
```

**해결 방법:** 시스템 프롬프트에 "Do not explain, just execute" 추가 또는 `/nothink` 모드 사용

#### 5.5.2 ActionHints 활용 문제

LLM이 JSON 안의 hints를 적극 활용하지 못함:

```
현재 결과:
{
  "success": true,
  "hints": ["수정 시 reset 대신 setFill 사용"]  ← JSON 안에 묻혀있음
}

문제:
- 에러 정보가 stderr로만 출력되고 JSON에 포함되지 않음
- 수정 예시가 없어 LLM이 오류 수정 못함
- drawLine(['name', ...]) 형태로 잘못 호출해도 정확한 피드백 없음

개선 방향 (Story 9.2.2):
{
  "success": false,
  "error": "draw_line: Expected string for 'name'",
  "correction_hint": "올바른 형식: drawLine('name', [x1,y1, x2,y2])",
  "example": "drawLine('myLine', [0, 0, 100, 100])"
}
```

#### 5.5.3 함수 시그니처 오류

- `drawLine(['name', ...])` → 올바른 형식: `drawLine('name', [...])`
- `translate('all')` → 'all'이라는 엔티티는 존재하지 않음
- 중복 이름 생성 시도 시 에러

---

## 6. 구현 가이드

### 6.1 Agent Loop 구조

```typescript
async function runAgent(adapter: LLMAdapter, prompt: string) {
  const tools = [{ name: 'run_cad_code', execute: executeCode }];
  let messages = [{ role: 'user', content: prompt }];

  while (true) {
    // 1. LLM 호출
    const response = await adapter.chat(messages, tools);

    // 2. 완료 확인
    if (response.done) return response.content;

    // 3. 도구 실행
    for (const call of response.toolCalls) {
      const result = await tools.find(t => t.name === call.name).execute(call.input);
      messages.push({ role: 'tool', content: result });
    }
  }
}
```

### 6.2 MAMA 통합

```typescript
// 도구 호출 전 MAMA 컨텍스트 주입
const systemPrompt = `
You are a CAD assistant.

MAMA Context:
- 프로젝트 표준: ${mama.getProjectStandards()}
- 최근 결정: ${mama.getRecentDecisions()}
- 현재 엔티티: ${mama.getCurrentEntities()}

Available tools: run_cad_code
`;
```

---

## 7. 결론

### 7.1 핵심 원칙

1. **Core Logic 분리:** 도구 실행 로직은 LLM과 독립
2. **Adapter 패턴:** 진입점만 다르게, 핵심은 공유
3. **MAMA 보완:** 외부 메모리로 작은 LLM 한계 극복

### 7.2 권장 전략

| 사용 사례 | 권장 LLM | MAMA 역할 | 비고 |
|----------|---------|-----------|------|
| 개발/디버깅 | Claude Code (CLI) | 글로벌 MAMA | 최고 품질 |
| 프로덕션 API | Claude/GPT API | CAD MAMA | 안정적 |
| **빠른 실행** | **exaone3.5:2.4b** | CAD MAMA | **8.7초, 코드 품질 최고** |
| Tool Calling 필수 | llama3.1:8b | CAD MAMA | 19초, 안정적 |
| 오프라인/보안 | Ollama (로컬) | CAD MAMA (필수) | - |

### 7.3 모델 선택 가이드

```
┌─────────────────────────────────────────────────────────────────┐
│                    로컬 LLM 선택 기준                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  속도 우선 → exaone3.5:2.4b (8.7초)                             │
│             Direct Code Generation 방식                         │
│             ⚠️ Tool Calling 미지원                              │
│                                                                 │
│  안정성 우선 → llama3.1:8b (19초)                               │
│               Tool Calling 지원                                 │
│               표준적인 Agent Loop 가능                          │
│                                                                 │
│  ❌ 비추천 → qwen3:8b (Thinking Mode 문제)                      │
│            → qwen2.5:7b (느림)                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 코딩 특화 모델

run_cad_code는 코드 생성이 핵심이므로 코딩 특화 모델이 유리합니다.

| 모델 | 크기 | 속도 | 코드 품질 | 특징 |
|------|------|------|----------|------|
| **qwen2.5-coder:7b** | 4.7GB | ~11초 | ⭐⭐⭐ | Polygon 삼각형, 색상 자동 |
| exaone3.5:2.4b | 1.6GB | ~8초 | ⭐⭐ | 가장 빠름, 상세 |
| qwen3-coder | 19GB+ | - | - | 8GB VRAM 초과 |

**권장:** `qwen2.5-coder:7b` - 코딩 특화 + 8GB VRAM 적합

### 7.5 다음 단계

1. Ollama PoC 코드 정리 및 통합
2. LLM Adapter 인터페이스 정규화
3. MAMA Dynamic Hints 구현 (Story 9.2.2)
4. Agent Loop SDK 제공 검토

### 7.6 핵심 인사이트: Code Generation vs Tool Calling

**왜 작은 LLM에서 Tool Calling 없이 더 잘 작동하는가?**

일반적으로 Tool Calling은 작은 모델에서 어렵다고 가정합니다. 그러나 PoC 결과, **Direct Code Generation이 오히려 더 빠르고 정확**했습니다.

#### 비교 분석

| 측면 | 일반적인 Tool Calling | run_cad_code 방식 |
|------|----------------------|-------------------|
| **모델 추론 과정** | 도구 선택 → 매개변수 결정 → JSON 생성 | 그냥 코드 작성 |
| **컨텍스트 사용량** | JSON Schema 정의 (수백 토큰) | 함수 시그니처 몇 줄 |
| **출력 형식** | 구조화된 JSON | 자연스러운 코드 텍스트 |
| **도구 개수** | 여러 개 중 선택 | 1개 (run_cad_code) |

#### 왜 이런 현상이 발생하는가?

```
일반 Tool Calling (메타 레벨 추론 필요):
  "사용자가 원을 그리고 싶다"
  → "어떤 도구? run_cad_code"          ← 도구 선택
  → "매개변수? code 필드에 문자열"       ← 매개변수 매핑
  → "JSON 형식 맞춰서 출력"             ← 구조화된 출력
  → 3단계 추론

Direct Code Generation:
  "사용자가 원을 그리고 싶다"
  → "drawCircle('c', 0, 0, 50)"        ← 바로 코드
  → 1단계 추론
```

**핵심:** 코드 생성은 LLM의 "모국어"입니다. Pre-training 데이터에 코드가 풍부하므로, 작은 모델도 코드 생성은 잘 합니다.

#### 결론

> **"run_cad_code는 Tool Calling을 가장한 Code Interpreter다"**

우리 시스템은:
- 도구가 1개뿐 (선택 복잡성 없음)
- 그 도구의 역할이 "코드 실행" (코드 생성 능력만 필요)
- MAMA Context로 필요한 정보 제공 (함수 목록, 규칙 등)

따라서 **Tool Calling의 형식**을 유지하면서 **Code Generation의 본질**을 활용하는 하이브리드 접근법입니다.

#### 다른 도메인 확장 가능성

이 패턴은 CAD 외 도메인에서도 적용 가능합니다:

| 도메인 | Tool Calling 대신 | 장점 |
|--------|-------------------|------|
| DB 조작 | SQL 생성 | LLM이 SQL에 능숙 |
| 파일 시스템 | Shell 스크립트 생성 | 자연스러운 출력 |
| API 호출 | HTTP 요청 코드 생성 | 유연한 파라미터 |

### 7.7 MAMA Context 필수 정보

PoC에서 발견된 **LLM이 자주 실수하는 부분**:

| 실수 | 원인 | MAMA Context에 추가할 정보 |
|------|------|---------------------------|
| rect를 corner-based로 가정 | 대부분의 API가 corner 기준 | `⚠️ drawRect의 x,y는 CENTER 좌표` |
| 색상을 0~255로 지정 | 일반적인 RGB 표현 | `색상은 0~1 범위 (예: [1,0,0,1])` |
| 함수 정의 생성 | 코딩 모델의 습관 | `함수 호출만 하세요, 정의하지 마세요` |

**교훈:** MAMA Context는 "프로젝트 설정값" 뿐 아니라 **CAD API 동작 방식**도 명시해야 합니다.

### 7.8 MAMA의 Post-Learning 역할

작은 LLM의 한계는 **"지식 부족"이 아니라 "컨텍스트 부족"**입니다. MAMA가 적절한 컨텍스트를 제공하면, 2.4B 모델도 복잡한 작업을 수행할 수 있습니다.

#### 실험: 모듈 없이 vs 모듈 있을 때

```
Without MAMA:
  User: "고양이 그려줘"
  2.4B Model: drawCircle("kitty", 100, 150, 30)  ← 원 하나만 (실패)

With MAMA + cat_lib:
  MAMA Context: "cat_lib 모듈 있음, new Cat(name, x, y).build()"
  User: "고양이 그려줘"
  2.4B Model:
    import 'cat_lib';
    new Cat('Whiskers', 0, 0).build();  ← 성공! (16개 엔티티로 구성된 고양이)
```

#### 실험: 복잡한 씬에서 특정 엔티티 수정

```
MAMA Context:
  "현재 씬 - 집1: h1 (h1_wall, h1_roof, h1_door, h1_window)
            집2: h2 (h2_wall, h2_roof, h2_door, h2_window)
            집3: h3 (...)"

User: "두번째 집 지붕을 빨간색으로"
2.4B Model: setFill('h2_roof', [1,0,0,1])  ← 정확히 h2_roof 식별!
```

#### MAMA Post-Learning 효과 정리

| MAMA 역할 | 제공 정보 | 효과 |
|----------|----------|------|
| **모듈 목록** | Cat, House, Tree 클래스 | 복잡한 도형 → 간단한 호출 |
| **엔티티 구조** | h1, h2, h3 그룹 구조 | 1000개 중 정확한 대상 찾기 |
| **API 힌트** | center-based, 0~1 색상 | 실수 방지 |
| **프로젝트 규칙** | 기본 크기, 색상 | 일관성 유지 |

#### 패턴: Retrieval-Augmented Code Generation

이 패턴은 RAG(Retrieval-Augmented Generation)의 코드 생성 버전입니다:

```
┌─────────────────────────────────────────────────────────────────┐
│                 Retrieval-Augmented Code Generation              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Input: "고양이와 집 그려줘"                                │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────┐                       │
│  │  MAMA Retrieval                      │                       │
│  │  - 사용 가능 모듈: cat_lib, house_lib │                       │
│  │  - 현재 엔티티: sky, ground, h1...    │                       │
│  │  - API 힌트: rect=center-based       │                       │
│  └─────────────────────────────────────┘                       │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────┐                       │
│  │  Small LLM (2.4B)                    │                       │
│  │  역할: 어떤 모듈/함수를 쓸지 결정     │                       │
│  │  (기하학적 상세는 모듈이 처리)        │                       │
│  └─────────────────────────────────────┘                       │
│                    │                                            │
│                    ▼                                            │
│  Output:                                                        │
│    import 'cat_lib';                                            │
│    import 'house_lib';                                          │
│    new Cat('c1', -50, 0).build();                               │
│    new House('h1', 50, 0).build();                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 결론

> **"작은 LLM + MAMA = 큰 LLM의 효과"**

작은 모델은 "고양이를 기하학적으로 어떻게 그리는지" 모르지만:
1. MAMA가 "cat_lib 모듈이 있다"고 알려주면
2. 모델은 "Cat 클래스를 사용하면 되겠구나"라고 패턴 매칭
3. 복잡한 기하학은 모듈이 처리

이것이 **MAMA의 Post-Learning 역할**입니다:
- Pre-training에서 배우지 못한 것을
- Runtime에 컨텍스트로 제공하여
- 작은 모델의 능력을 확장

### 7.9 로컬 LLM의 ActionHints 생성 능력

작은 모델도 적절한 컨텍스트(API 목록 + 예시)가 주어지면 ActionHints를 생성할 수 있습니다.

#### 실험: ActionHints 생성

```
Prompt: "Draw a blue rectangle"

2.4B Model Output:
  Code: drawRect('r1', 50, 50, 100, 200)

  NextActions:
  1. setFill('r1', [0,0,1,1])  // 색상 0~1 범위로 정확!
  2. createGroup('rectGroup', ['r1'])  // 그룹화 제안
```

#### 조건별 ActionHints 품질

| 조건 | 힌트 품질 | 예시 |
|------|----------|------|
| 일반 프롬프트 | ❌ 너무 일반적 | "소프트웨어 확인하세요" |
| API 목록만 | ⚠️ 약간 개선 | 관련 없는 JS 코드 제안 |
| **API + 예시** | ✅ 정확 | `setFill('r1', [0,0,1,1])` |

#### 핵심: Few-shot 예시가 중요

```
MAMA Context 필요 요소:
├── API 목록 (drawCircle, setFill, translate...)
├── API 형식 (색상 0~1, 좌표 center-based)
└── 예시 (User → Code → NextActions)
```

### 7.10 MAMA + 상주 로컬 LLM 아키텍처

가장 흥미로운 발견: **MAMA에 로컬 LLM을 상주시켜 보조 작업을 수행**할 수 있습니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    하이브리드 아키텍처                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │  메인 LLM       │         │  MAMA           │               │
│  │  (Claude API)   │◄───────►│  + 로컬 LLM     │               │
│  │                 │         │  (exaone 2.4B)  │               │
│  │  • 사용자 대화   │         │                 │               │
│  │  • 복잡한 추론   │         │  • ActionHints  │               │
│  │  • 최종 코드 생성 │         │  • 모듈 추천     │               │
│  └─────────────────┘         │  • 엔티티 분석   │               │
│                              │  • 컨텍스트 필터  │               │
│                              └─────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 역할 분담

| 역할 | 메인 LLM (Claude) | 로컬 LLM (2.4B) |
|------|------------------|-----------------|
| 사용자 대화 | ✅ | ❌ |
| 복잡한 추론 | ✅ | ❌ |
| **ActionHints 생성** | ❌ | ✅ (~8초) |
| **모듈 추천** | ❌ | ✅ |
| **엔티티 구조 요약** | ❌ | ✅ |
| 최종 코드 결정 | ✅ | ❌ |

#### 장점

| 항목 | 효과 |
|------|------|
| **비용 절감** | 간단한 작업은 로컬에서 처리 (API 호출 $0) |
| **속도 향상** | ActionHints 사전 생성 (~8초) |
| **프라이버시** | 민감한 프로젝트 데이터 로컬 처리 |
| **오프라인** | 인터넷 없이도 힌트 제공 가능 |

#### 구현 시나리오

```
1. 사용자가 코드 실행
2. MAMA의 로컬 LLM이 백그라운드에서:
   - 실행 결과 분석
   - 다음 가능한 ActionHints 생성
   - 관련 모듈 추천
3. 메인 LLM이 사용자와 대화할 때:
   - MAMA가 미리 생성한 힌트를 컨텍스트로 제공
   - 더 빠르고 정확한 응답 가능
```

> **"MAMA는 단순한 DB가 아니라, 로컬 LLM을 품은 지능형 컨텍스트 시스템"**

---

## 8. 관련 문서

- [ADR-0011: MAMA Core 4 Tools 재사용](./0011-mama-core-reuse.md)
- [ADR-0018: LLM-Agnostic Hook Abstraction](./0018-llm-agnostic-hooks.md)
- [Architecture: Part 4 MAMA Integration](../architecture.md#part-4-mama-integration-epic-11---계획됨)
- [Epics: Epic 11 MAMA](../epics.md#epic-11-mama-integration---계획됨)
