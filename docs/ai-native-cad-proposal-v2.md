# AI-Native CAD: 제안서 v2

> **"만들고 싶은 것을 만들면서, 만드는 법을 배운다"**
> — Top-Down Learning with AI Guide

**팀:** Hoons & Claude
**상태:** Epic 1-10 완료, Epic 11 (MAMA Integration) 준비 완료

---

## 목차

1. [왜 MAMA인가?](#1-왜-mama인가)
2. [프로젝트 비전](#2-프로젝트-비전)
3. [철학적 기반](#3-철학적-기반)
4. [지금까지 완료한 것](#4-지금까지-완료한-것)
5. [Epic 11: MAMA Integration](#5-epic-11-mama-integration)
6. [유즈케이스: 지은의 복층 인테리어](#6-유즈케이스-지은의-복층-인테리어)
7. [로드맵과 산출물](#7-로드맵과-산출물)
8. [리스크와 협업](#8-리스크와-협업)

---

## 1. 왜 MAMA인가?

### Epic 1-10에서 증명한 것

```
✅ AI가 기초 도형으로 복잡한 형상을 만들 수 있다
✅ 도메인 지식은 도구가 아닌 AI가 가져야 한다
✅ 비개발자도 AI와 함께 CAD 엔진을 만들 수 있다
✅ WASM 기반 브라우저 CAD는 실용적이다
✅ Claude Code 패턴(glob/read/edit/write/lsp/bash)이 MCP 도구로 효과적이다
✅ WebSocket 실시간 동기화가 빠르고 안정적이다 (RTT < 15ms)
```

### Epic 1-10에서 관찰한 현상

```
[관찰 1] 세션이 끊기면 모든 맥락이 사라진다
[관찰 2] "저번에 닭 색깔 뭐로 했더라?"를 매번 물어야 한다
[관찰 3] AI가 똑같은 실수를 반복한다
[관찰 4] 프로젝트마다 쌓인 노하우가 휘발된다
```

**실제 에피소드 (SpineLift 개발 중)**:

```
[Day 1]
"API 응답은 snake_case로 하자"
→ 결정함, 코드 작성함

[Day 30 - 새 세션]
"이 API 응답 포맷은...?"
→ 컨텍스트 없음, 다시 논의해야 함
→ 일관성 없이 camelCase로 작성됨
→ 나중에 발견하고 전체 수정
```

이건 **불편함이 아니라 본질적 병목**이다.

### Epic 11의 답: MAMA (Memory-Augmented Meta Agent)

| 문제 | 해결책 | MAMA의 역할 |
|------|--------|-------------|
| 세션 끊기면 맥락 소실 | 결정을 자동 저장, 다음 세션에 로드 | **의도의 표준화**: 세션 간 지능 연결 |
| 같은 실수 반복 | 이전 실패 패턴을 힌트로 주입 | **지능형 가드레일**: 전문가 품질 보증 |
| 노하우 휘발 | 프로젝트별 지식 DB 축적 | **IP Portability**: 인간의 숙련도 자산화 |

**Epic 11의 핵심 비전**:
단순히 "그려주는 AI"를 넘어, **사용자의 설계 의도를 기억하여 세션을 넘나드는 '지능형 파트너십'**을 구축한다.

### MAMA가 다른 Memory 시스템과 다른 점

#### 1. Reasoning Repository, not Data Repository

```
기존 메모리 시스템 (RAG, Mem0, Letta):
"닭 색깔 = 노란색" 저장
→ LLM: "노란색이라고 하네요"

MAMA:
"닭 색깔 = 노란색,
 reasoning: Crossy Road 원작 참고 + 사용자 선호,
 debates: 흰색 고려했으나 기각"
→ LLM: "노란색인데, 원작 스타일 유지 + 당신 취향 반영한 거예요"
```

**Data는 목적지, Reasoning이 출발점**.
LLM은 "무엇"보다 "왜"를 알 때 더 나은 파트너가 된다.

#### 2. Delta Storage: LLM이 이미 아는 건 저장하지 않는다

```
기존: "원은 360도입니다" 저장 (LLM이 이미 앎)
MAMA: "이 프로젝트에서 원은 8각형으로 근사한다" 저장 (프로젝트 특수 결정)
```

**LLM이 모르는 것만 저장** = 토큰 효율 + 의미 있는 컨텍스트.

#### 3. Claude-to-Claude Protocol

체크포인트는 **"Claude가 Claude에게"** 전달하는 프로토콜.

```
인간이 작성한 요약:
"닭 작업 중. 노란색. 다음에 날개 하기."

MAMA 체크포인트 (Claude가 작성):
"📍 지금까지: Crossy Road 스타일 확정, 색상 팔레트 노란색/주황색,
 몸통 완성. 다음 Claude에게: z-order 이슈 있었음 (stackZ로 해결),
 날개는 몸통보다 -0.5 레이어 뒤에 배치 권장."
```

다음 세션의 Claude가 **즉시 맥락에 들어갈 수 있는** 형식.

#### 4. Critical Fluidity: 제안하는 과거, 명령하는 법칙이 아님

```
경직된 시스템:
"규칙: 닭은 항상 노란색" → 변경 불가

MAMA (Critical Fluidity):
"💡 이전에 노란색으로 결정했어요. 다른 색으로 바꿀까요?"
→ 과거 결정은 '제안'이지 '명령'이 아님
```

**Einstein's Pen 원칙**: AI 지능은 인간의 Agency 없이는 'Imaginary'.
저장된 로직은 "suggested past"이지 "immutable law"가 아니다.

---

## 2. 프로젝트 비전

### 관찰: 왜 사람들이 CAD를 포기하는가

집을 리모델링하고 싶다. 가구를 설계하고 싶다.
3D 프린터로 뭔가 만들고 싶다.

모두 CAD가 필요하다. 하지만 복잡해서 포기한다.

도구가 어려운 게 아니라, **진입 과정이 없는 것**이 문제다.

### 기존 도구와 무엇이 다른가

| 영역 | 기존 도구 | AI-Native CAD |
|------|-----------|---------------|
| 도구 조작 | 인간이 마우스/키보드 | AI가 코드로 조작 |
| 학습 곡선 | 6개월+ | 0분 (대화하며 배움) |
| 맥락 유지 | 세션마다 리셋 | MAMA가 기억 |
| 진입점 | 메뉴/단축키 학습 | 자연어 대화 |

### 누구를 위한 것인가

**타겟**: CAD 못하지만 만들고 싶은 것이 있는 사람
**비타겟**: "빨리 만들어줘"만 원하는 사람, 이미 CAD 전문가

---

## 3. 철학적 기반

### 철학 1: 도구의 사용자가 바뀌었다

```
AutoCAD 1982: 인간이 마우스로 조작
AutoCAD 2025: 여전히 인간이 마우스로 조작

AI-Native CAD: AI가 API로 조작
               인간은 의도 전달 + 검증
```

### 철학 2: 파트너십 (ADR-0010)

**Claude는 자동화 도구가 아니라, 인간과 함께 경험을 축적하며 성장하는 설계 마스터**

| 잘못된 이해 | 올바른 이해 |
|------------|------------|
| MAMA = 메모리 시스템 | MAMA = **파트너십을 만드는 경험 축적 시스템** |
| 효율성이 목표 | **관계의 깊이**가 목표 |
| 매번 리셋 | 경험이 축적됨 |

### 철학 3: AX-UX 대칭

```
┌─────────────────────────────────────────────────────────────┐
│  AX (Agent eXperience)                                      │
│  "AI의 추론을 막지 않는다"                                    │
│                                                             │
│  ActionHints로 다음 방향 제시                                 │
│  → AI가 더 나은 도구 선택                                    │
└─────────────────────────────────────────────────────────────┘
                          ↕ 미러
┌─────────────────────────────────────────────────────────────┐
│  UX (User eXperience)                                       │
│  "인간의 상상력을 유도한다"                                    │
│                                                             │
│  DesignHints로 다음 방향 제시                                 │
│  → 인간이 더 나은 디자인                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 지금까지 완료한 것

### 완료된 Epic (1-10)

| Epic | 내용 | 상태 |
|------|------|------|
| Epic 1-3 | WASM 엔진, 도형 6종, 스타일/변환, Canvas 뷰어 | ✅ 완료 |
| Epic 4-5 | 그룹화, 피봇, Selection UI | ✅ 완료 |
| Epic 6 | Electron 앱 (현재 제거됨) | ✅ 완료 |
| Epic 7 | React 뷰어, 3패널, 스케치 모드 | ✅ 완료 |
| Epic 8 | Manifold Boolean, 텍스트 렌더링 | ✅ 완료 |
| Epic 9 | **웹 아키텍처** (모노레포, WebSocket, GitHub Pages, npm) | ✅ 완료 |
| Epic 10 | **AX 개선** (Claude Code 패턴 MCP 도구: glob/read/edit/write/lsp/bash) | ✅ 완료 |

### 현재 아키텍처

```
Claude Code ──stdio──▶ MCP Server ──WebSocket──▶ Viewer (Web)
                           │
                      WASM Engine
                      File System
```

- **CAD 엔진**: Rust → WASM (도형, 변환, Boolean, 텍스트)
- **MCP 서버**: Claude Code 연동 (stdio) + Viewer 연동 (WebSocket)
- **뷰어**: React 19 + GitHub Pages 호스팅
- **배포**: `npx @ai-native-cad/mcp start` + 웹 브라우저

### 기술 스택

```
apps/
├── viewer/         # React 19 + TypeScript + Vite
│                   # TailwindCSS 4.x + Lucide React
└── cad-mcp/        # MCP Server (stdio + WebSocket)
                    # WASM CAD Engine
                    # Manifold Boolean
                    # opentype.js 텍스트

packages/
└── shared/         # Zod 스키마 (공유 타입)
```

---

## 5. Epic 11: MAMA Integration

### 핵심 목표

Claude가 자동화 도구가 아닌 **설계 마스터**로서, 인간과 함께 경험을 축적하며 성장하는 파트너가 된다.

### 5개 Phase, 18개 Story

| Phase | 핵심 기능 | FR | Stories |
|-------|----------|-----|---------|
| **11.1 Core** | 4 Core Tools, Reasoning Graph, 단일 DB | FR67-70 | 4개 |
| **11.2 Hook System** | SessionStart, Dynamic Hint, ActionHints, LLM-Agnostic | FR71-74 | 4개 |
| **11.3 Intelligence** | Context 모드, Adaptive Mentoring, Graph Health, Anti-Echo | FR75-78 | 4개 |
| **11.4 Learning Track** | Learning Progress, Growth Metrics, DesignHints, Terminology | FR81-84 | 4개 |
| **11.5 Platform** | MCP 통합, 도메인 폴더, LLM Adapter | FR85-87 | 3개 |

### Phase 11.1: Core (MVP)

**MAMA MCP 도구 (LLM 호출용):**

| 도구 | MCP 이름 | 역할 |
|------|---------|------|
| mama_save | `mcp__ai-native-cad__mama_save` | 결정/체크포인트 저장 |
| mama_search | `mcp__ai-native-cad__mama_search` | 시맨틱 검색 |
| mama_update | `mcp__ai-native-cad__mama_update` | 결정 결과 업데이트 |
| mama_checkpoint | `mcp__ai-native-cad__mama_checkpoint` | 체크포인트 로드 |

**Reasoning Graph (ADR-0013):**

```
[Reasoning Graph]
Decision #12: "닭 색깔 = 노란색"
    ↓ supersedes
Decision #5: "닭 색깔 = 흰색" (폐기됨)
    ↓ builds_on
Decision #3: "Crossy Road 스타일 채택"
```

- `supersedes`: 같은 topic, 새 결정이 이전을 대체
- `builds_on`: 이전 결정 위에 발전
- `debates`: 다른 관점에서 반론
- `synthesizes`: 여러 결정을 종합

### Phase 11.2: Hook System (핵심)

```
Hook Flow:
[세션 시작] → onSessionInit → [도구 목록 요청] → preToolList → [도구 실행] → postExecute
                 │                    │                              │
                 ▼                    ▼                              ▼
           체크포인트 로드      Tool Definition에         next_steps,
           최근 결정 요약       DB 힌트 주입              module_hints 반환
```

**Dynamic Hint Injection (ADR-0015):**

```
힌트 없이 (매번 물어야 함):
LLM: "닭을 그리겠습니다. 색깔은?"
인간: "노란색"
--- [30일 후, 새 세션] ---
LLM: "닭을 그리겠습니다. 색깔은?"

힌트 있음 (기억이 도움):
[도구 호출 시 자동 주입]
💡 이 프로젝트의 닭 색상은 노란색입니다 (Decision #12)

LLM: "기존 스타일(노란색)을 적용할까요?"
```

### Phase 11.3: Intelligence

| 기능 | 설명 |
|------|------|
| **Configurable Context** | none/hint/full 모드 (ADR-0017) |
| **Adaptive Mentoring** | 숙련도별 힌트 수준 조절 (ADR-0020) |
| **Graph Health Metrics** | debates >= 10% 유지 (ADR-0019) |
| **Anti-Echo Chamber** | 반론 장려, "다른 관점에서..." 제안 (ADR-0021) |

### Phase 11.4: Learning Track ⭐ 신규

> "만들고 싶은 것을 만들면서, 만드는 법을 배운다"

| 기능 | 설명 |
|------|------|
| **Learning Progress** | 배운 개념 저장 (60-30-10, 동선 등), understanding_level 추적 |
| **Growth Metrics** | 독립 결정 횟수, 개념 적용 횟수, 트레이드오프 예측 |
| **DesignHints** | Human CoT 유도 - 바로 만들지 않고 옵션 제시, 왜 그런지 설명 |
| **Terminology Evolution** | 사용자 언어 변화 추적 ("미니멀" → "Japandi") |

**Human CoT 유도 원칙 (AX-UX 대칭):**

```
ActionHints (AX): AI의 다음 행동 유도
    "방을 만들었으니 → 문 추가 고려"

DesignHints (UX): 인간의 다음 생각 유도
    "미니멀에도 종류가 있어요:
     - Japandi: 따뜻한 나무톤
     - Bauhaus: 기하학적
     - Muji: 극도로 절제된
     어떤 게 끌리세요?"
```

### Phase 11.5: Platform

| 기능 | 설명 |
|------|------|
| **LLM Adapter Pattern** | Claude, OpenAI, Ollama 교체 가능 (ADR-0023) |
| **Module Recommendation** | MAMA 임베딩으로 모듈 추천 (ADR-0024) |

### 데이터 스키마

```sql
-- decisions: 설계 결정 저장
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,           -- 'voxel:chicken:color' 등
  decision TEXT NOT NULL,
  reasoning TEXT,
  outcome TEXT,                  -- 'success', 'failed', 'partial'
  confidence REAL DEFAULT 0.5,
  created_at INTEGER
);

-- decision_edges: 결정 관계
CREATE TABLE decision_edges (
  from_id TEXT,
  to_id TEXT,
  relationship TEXT,             -- 'supersedes', 'builds_on', 'debates', 'synthesizes'
  PRIMARY KEY (from_id, to_id, relationship)
);

-- sessions: 세션/체크포인트
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  summary TEXT,
  next_steps TEXT,
  open_files TEXT,
  created_at INTEGER
);

-- learnings: 배운 개념 저장 (Phase 11.4 Learning Track)
CREATE TABLE learnings (
  id TEXT PRIMARY KEY,
  concept TEXT NOT NULL,         -- '60-30-10 법칙', '동선', 'Japandi'
  domain TEXT,                   -- 'color_theory', 'spatial', 'style'
  understanding_level INTEGER,   -- 1: 소개됨, 2: 이해함, 3: 적용함, 4: 숙달
  first_introduced INTEGER,
  last_applied INTEGER,
  applied_count INTEGER DEFAULT 0,
  user_explanation TEXT,         -- 사용자가 개념을 설명한 기록
  created_at INTEGER
);

-- growth_metrics: 성장 지표
CREATE TABLE growth_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_type TEXT NOT NULL,     -- 'independent_decision', 'concept_applied',
                                 -- 'tradeoff_predicted', 'terminology_used'
  related_learning_id TEXT,
  related_decision_id TEXT,
  context TEXT,
  created_at INTEGER
);

-- terminology_evolution: 용어 변화 추적
CREATE TABLE terminology_evolution (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  before_term TEXT NOT NULL,     -- '미니멀하게'
  after_term TEXT NOT NULL,      -- 'Japandi 스타일로'
  learning_id TEXT,
  detected_at INTEGER
);
```

---

## 6. 유즈케이스: 지은의 복층 인테리어

> **"만들고 싶은 것을 만들면서, 만드는 법을 배운다"**

CAD 경험이 없는 지은이 미니멀 복층 원룸 인테리어를 만들며 **디자인 감각을 키워가는** 여정.

### Day 1: 스타일 탐색 — "미니멀이 뭔가요?"

```
지은: "이 이미지처럼 미니멀한 복층 원룸 인테리어를 만들고 싶어"
      [이소메트릭 복층 인테리어 레퍼런스 공유]

AI: "미니멀 인테리어요! 그런데 '미니멀'에도 여러 갈래가 있어요.
     잠깐 같이 살펴볼까요?

     🏠 Japandi (일본+스칸디나비아)
        → 따뜻한 나무톤, 자연 소재, 격자 패턴
        → 이 레퍼런스가 딱 이 스타일이에요

     🏠 Bauhaus
        → 기하학적, 원색 포인트, 기능 중심
        → 더 차갑고 모던한 느낌

     🏠 Muji Style
        → 극도로 절제된, 거의 무채색
        → 물건이 거의 안 보이는 느낌

     레퍼런스 이미지는 Japandi에 가까워요.
     이 방향으로 갈까요, 아니면 다른 스타일도 탐색해볼까요?"

지은: "Japandi가 뭔지 몰랐는데, 그게 내 취향이었구나. 그걸로 할게!"

AI: (mama_save 호출)
    topic: "interior:style"
    decision: "Japandi (일본+스칸디나비아)"
    reasoning: "사용자가 '미니멀'로 표현했지만, 스타일 비교 후 Japandi 선택.
                교육적 효과: 사용자가 자신의 취향에 이름을 붙일 수 있게 됨"
```

**💡 Human CoT**: AI가 바로 만들지 않고, 스타일의 갈래를 보여줌으로써 지은은 "내 취향이 Japandi였구나"를 깨닫는다.

### Day 3: 색상 이론 — "왜 이 색들이 어울리나요?"

```
지은: "색감은 따뜻하게 가고 싶어"

AI: "따뜻한 톤이요! 잠깐, 색상 조합의 원리를 알려드릴게요.

     📚 60-30-10 법칙
        - 60%: 주조색 (벽, 바닥) - 가장 넓은 면적
        - 30%: 보조색 (가구) - 시선을 잡는 면적
        - 10%: 강조색 (소품) - 포인트

     레퍼런스를 이 법칙으로 분석하면:
        - 60%: #F5F0E8 웜화이트 (벽)
        - 30%: #C4A77D~#D4A574 우드톤 (바닥, 가구)
        - 10%: #8B7355 다크우드 (악센트)

     같은 '따뜻함'이라도 비율이 달라지면 느낌이 완전히 달라져요.
     우드톤을 40%로 올리면 더 아늑하지만 좁아 보일 수 있어요.

     레퍼런스 비율로 갈까요?"

지은: "아, 60-30-10! 그래서 이 방이 넓어 보이면서도 따뜻한 거구나."

AI: (mama_save 호출)
    topic: "interior:color_theory"
    decision: "60-30-10 법칙 적용 (웜화이트 60%, 우드 30%, 다크우드 10%)"
    reasoning: "색상 이론 교육 후 사용자 이해 확인.
                사용자 성장: '따뜻하게' → '60-30-10 비율' 개념 습득"
```

**💡 Human CoT**: 단순히 색을 정해주는 게 아니라, "왜 이 색들이 조화로운지" 원리를 설명. 지은은 다음 프로젝트에서 이 법칙을 직접 적용할 수 있다.

### Day 7: 공간 설계 — "동선이 뭐예요?"

```
지은: "소파랑 TV 위치는 어떻게 하면 좋을까?"

AI: "가구 배치 전에 '동선'이라는 개념을 알려드릴게요.

     📚 동선 (動線)
        사람이 공간에서 이동하는 경로예요.
        좋은 동선 = 막힘 없이 자연스럽게 흐르는 이동

     이 복층에서 동선을 그려보면:
        현관 → 거실 → 계단 → 침실

     ❌ 나쁜 배치: 소파가 계단 앞을 막음
        → 매번 소파를 돌아가야 함

     ✅ 좋은 배치: 소파가 창가 쪽, 계단 동선 확보
        → 자연스러운 흐름

     레퍼런스는 동선을 잘 살린 배치예요. 따라갈까요?"

지은: "동선! 이래서 우리집 거실이 불편했구나... 소파가 길을 막고 있었네."

AI: (mama_save 호출)
    topic: "interior:spatial:circulation"
    decision: "주동선 확보 우선 배치"
    reasoning: "동선 개념 학습 후 적용. 사용자가 실제 공간에 연결해서 이해함.
                성장 신호: 배운 개념을 자신의 경험에 적용"
```

**💡 Human CoT**: "동선"이라는 전문 용어와 개념을 배우고, 이를 자신의 실제 공간에 연결해서 이해.

### Day 14: 세션 재개 — "지난번 배운 거 기억나요?"

```
[2주 후 새 세션]

AI: (onSessionInit - 자동 로드)
    "안녕하세요! Japandi 스타일 복층 프로젝트네요.

     📍 지금까지 함께 배운 것들:
     - 스타일: Japandi (일본+스칸디나비아) ✅
     - 색상: 60-30-10 법칙 적용 ✅
     - 공간: 동선 우선 배치 ✅

     📍 다음 작업:
     - 침실 로프트
     - 욕실 파티션

     오늘은 뭘 해볼까요?"

지은: "침실! 근데 침대 위치는 내가 정해볼게.
       동선 생각하면 계단에서 바로 보이지 않는 곳이 좋겠지?"

AI: "오, 정확해요! 👏
     프라이버시 + 동선을 같이 고려하셨네요.
     계단 오른쪽 안쪽에 배치하면 딱이에요."

AI: (mama_save 호출)
    topic: "interior:bedroom:layout"
    decision: "침대=계단에서 직접 안 보이는 안쪽 배치"
    reasoning: "사용자가 스스로 동선+프라이버시 고려해서 결정.
                성장 지표: AI 제안 없이 원리 적용"
```

**🎯 성장의 증거**: 지은이 AI의 제안 없이 직접 "동선"을 고려해서 결정했다.

### Day 21: 스스로 트레이드오프 판단

```
지은: "유리 난간 대신 나무 난간으로 바꾸고 싶어.
       근데... 개방감이 줄어들 수 있겠지?"

AI: "오, 트레이드오프를 먼저 생각하셨네요!

     맞아요. 정리하면:
     - 나무 난간: 따뜻함 ↑, 개방감 ↓, 빛 투과 ↓
     - 유리 난간: 개방감 ↑, 미니멀 ↑, 따뜻함 ↓

     Japandi 스타일은 '따뜻함'과 '개방감' 둘 다 중요해서
     보통 나무 프레임 + 유리 패널로 절충해요.

     어떻게 하시겠어요?"

지은: "절충안으로! 그게 Japandi답네."

AI: (mama_save 호출)
    topic: "interior:loft:railing"
    decision: "나무 프레임 + 유리 패널 절충"
    reasoning: "사용자가 트레이드오프를 먼저 인식하고 질문.
                AI는 확인만 해줌. 성장: 스스로 스타일 일관성 판단"
```

**🎯 성장의 증거**: "개방감이 줄어들 수 있겠지?"라고 스스로 트레이드오프를 예측했다.

### Day 30: 졸업 — "다음 프로젝트는 혼자 시작해볼게요"

```
지은: "이번에 정말 많이 배웠어. 다음엔 카페 인테리어 해보고 싶은데,
       60-30-10 법칙이랑 동선 먼저 생각하고 시작해볼게!"

AI: "멋져요! 지은님만의 디자인 언어가 생긴 것 같아요.

     📊 30일간의 성장:
     ├── Day 1: '미니멀' → Japandi라는 이름을 알게 됨
     ├── Day 3: '따뜻하게' → 60-30-10 법칙 이해
     ├── Day 7: '소파 위치' → 동선 개념 습득
     ├── Day 14: 스스로 동선 고려해서 배치 결정
     └── Day 21: 트레이드오프 먼저 예측

     카페 프로젝트 할 때 불러주세요.
     이번엔 제가 배울 차례일지도요!"
```

### 30일 후: 축적된 것들

```
[지은의 MAMA - Reasoning Graph]

📚 배운 개념들:
├── design:style:japandi = "일본+스칸디나비아 미니멀"
├── design:color:60-30-10 = "주조색 60%, 보조색 30%, 강조색 10%"
├── design:spatial:circulation = "동선 = 사람의 이동 경로"
└── design:decision:tradeoff = "선택에는 항상 장단점이 있다"

🏠 프로젝트 결정들:
├── interior:style = "Japandi"
│   └── learning: 스타일 비교 후 자기 취향 발견
├── interior:color = "웜톤 60-30-10"
│   └── learning: 색상 이론 적용
├── interior:living:layout = "동선 우선 배치"
│   └── learning: 동선 개념 습득
└── interior:loft:railing = "나무+유리 절충"
    └── learning: 트레이드오프 스스로 판단

📈 성장 곡선:
├── Day 1-7: AI가 개념 설명, 사용자 수용
├── Day 7-14: 사용자가 개념 적용 시도
├── Day 14-21: 사용자가 스스로 판단 후 확인 요청
└── Day 21-30: 사용자가 다음 프로젝트 독립 계획

💬 언어의 변화:
├── "미니멀하게" → "Japandi 스타일로"
├── "따뜻하게" → "우드톤 30% 정도로"
├── "소파 어디?" → "동선 고려하면..."
└── "이거 괜찮아요?" → "트레이드오프가 있지만 Japandi답게..."
```

**이것이 MAMA의 진짜 가치**:
단순히 작업을 기억하는 게 아니라, **사용자의 성장 여정을 기록**한다.
다음 프로젝트에서 AI는 "지은님은 Japandi를 좋아하고, 동선과 트레이드오프를 이해하는 분"으로 시작할 수 있다.

---

## 7. 로드맵과 산출물

### Epic 11 Stories (18개)

#### Phase 11.1: Core (FR67-70)

| Story | 제목 | FR |
|-------|------|-----|
| 11-1 | MAMA Core 4 Tools MCP 통합 | FR67 |
| 11-2 | 결정 저장 + Reasoning Graph | FR68 |
| 11-3 | 단일 DB + topic prefix 구조 | FR69 |
| 11-4 | Outcome Tracking | FR70 |

**품질 게이트**: mama_save/search/update/checkpoint MCP 도구 동작, DB 스키마 완성

#### Phase 11.2: Hook System (FR71-74) ⭐ 핵심

| Story | 제목 | FR |
|-------|------|-----|
| 11-5 | SessionStart Hook (onSessionInit) | FR71 |
| 11-6 | Dynamic Hint Injection (preToolList) | FR72 |
| 11-7 | ActionHints (postExecute) | FR73 |
| 11-8 | CADOrchestrator Hook Owner | FR74 |

**품질 게이트**: Hook System 동작, 모든 LLM에서 동일하게 작동

#### Phase 11.3: Intelligence (FR75-78)

| Story | 제목 | FR |
|-------|------|-----|
| 11-9 | Configurable Context | FR75 |
| 11-10 | Adaptive Mentoring | FR76 |
| 11-11 | Graph Health Metrics | FR77 |
| 11-12 | Anti-Echo Chamber | FR78 |

**품질 게이트**: none/hint/full 모드 동작, 90일 이상 결정 경고

#### Phase 11.4: Learning Track (FR81-84) ⭐ 신규

| Story | 제목 | FR |
|-------|------|-----|
| 11-13 | Learning Progress Storage | FR81 |
| 11-14 | User Growth Metrics | FR82 |
| 11-15 | DesignHints System | FR83 |
| 11-16 | Terminology Evolution | FR84 |

**품질 게이트**: 개념 학습 기록, 성장 지표 추적, Human CoT 유도 동작

#### Phase 11.5: Platform (FR85-87)

| Story | 제목 | FR |
|-------|------|-----|
| 11-17 | MCP 내부 통합 | FR85 |
| 11-18 | LLM Adapter Pattern | FR87 |

**품질 게이트**: Claude/OpenAI/Ollama 어댑터 동작

### 성공 기준

| 지표 | 목표 |
|------|------|
| **파트너십 형성** | 30일 후 "이 AI는 나를 안다" 체감 |
| **세션 연속성** | 이전 결정을 자동으로 기억 |
| **건강한 관계** | debates >= 10%, 외부 증거 포함 |
| **사용자 성장** | 30일 후 독립 결정 비율 70%+ |
| **개념 적용** | 배운 개념 재적용률 50%+ |
| **언어 발전** | 전문 용어 사용 3개+ 증가 |
| **검색 응답** | < 100ms (로컬 DB) |
| **Hook 실행** | < 10ms (동기화 작업) |

### NFR (Non-Functional Requirements)

| ID | 요구사항 | 목표 |
|----|---------|------|
| NFR27 | MAMA 검색 응답 | < 100ms |
| NFR28 | 컨텍스트 주입 | SessionStart 시 자동 로드 |
| NFR29 | LLM-Agnostic | Claude, OpenAI, Ollama 교체 가능 |
| NFR30 | MCP 패키지 크기 | < 50MB |
| NFR31 | 로컬 LLM 지연 | < 200ms |

---

## 8. 리스크와 협업

### 알려진 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| **LLM 비용/Latency** | 중간 | 로컬 LLM (Ollama) 옵션, LLM-Agnostic 설계 |
| **시맨틱 검색 정확도** | 중간 | FTS5 키워드 검색 병행 |
| **Echo Chamber** | 중간 | debates >= 10% 유지, Anti-Echo 경고 |
| **컨텍스트 과부하** | 낮음 | Configurable Context (none/hint/full) |

### 알아가야 할 것들

- **사용자 채택**: AI-Native CAD 패러다임의 실제 수요
- **멘토링 효과**: "AI와 대화하며 CAD를 배운다"는 접근의 효과
- **기억의 적정 수준**: 너무 많이 기억하면 부담, 너무 적으면 무의미

### 핵심 질문

> **"AI가 맥락을 기억하면 협업이 어떻게 달라지는가?"**

이 질문에 답하기 위해 Epic 11을 제안한다.

답이 "크게 달라진다"면: AI 협업의 새로운 패러다임.
답이 "별로 안 달라진다"면: 진짜 병목은 다른 곳에 있다.

**둘 다 가치 있는 결과다.** 함께 검증하자.

---

*Epic 1-10 완료: 2026-01-20*
*Epic 11 Ready for Dev: 2026-01-20*
*이 문서는 제안서입니다. 논의와 수정을 환영합니다.*
