---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - docs/analysis/product-brief-r2-7f-division-2025-12-14.md
  - docs/ax-design-guide.md
  - docs/ai-native-cad-proposal.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 2
workflowType: 'prd'
lastStep: 2
project_name: 'AI-Native CAD'
user_name: 'Hoons'
date: '2025-12-14'
---

# Product Requirements Document - AI-Native CAD

**Author:** Hoons
**Date:** 2025-12-17 (Updated)

---

## Executive Summary

AI-Native CAD는 "모르는 것도 괜찮아요. 함께 만들어가요" 패러다임의 CAD 도구이다.
AI는 자동 생성기가 아닌 협업적 창작 파트너로서, 질문하고 설명하고 함께 고민한다.
결과물뿐 아니라 사용자의 성장도 성공의 정의에 포함된다.

> **검증된 경험**: Claude Code와 비개발자가 6개월간 SpineLift를 개발한 경험.
> 코드를 모르지만 아키텍처를 설계하고, 기술 결정을 내리고, 제품을 만들었다.
> 이 경험을 CAD 영역으로 확장한다.

### What Makes This Special

1. **협업적 창작**: AI가 바로 만들지 않고, 질문하고 설명하며 함께 발전시킨다
2. **AX-UX 대칭**: AI에게 ActionHints, 인간에게 DesignHints - 둘 다 더 나은 결과로 유도
3. **도구 허들 제로**: 조작은 AI가, 의사결정은 인간이 - 학습 곡선 6개월 → 0분
4. **사용자 성장**: 결과물 + CAD 지식 습득 (대화하며 자연스럽게 배움)
5. **Direct-First Architecture**: MCP 없이 WASM 직접 실행, 오프라인 우선

## Project Classification

**Technical Type:** Desktop App (Electron + WASM 기반)
**Domain:** Design Tools / Creative
**Complexity:** High (새로운 패러다임)
**Project Context:** Greenfield - 백지에서 시작

---

## Core Philosophy

### AX-UX 대칭 원칙

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

**핵심 통찰**: 인간도 CoT(Chain of Thought)를 한다. 좋은 질문이 좋은 사고를 유도한다.

### AI의 역할

| ❌ 하지 않는 것 | ✅ 하는 것 |
|---------------|----------|
| "알겠습니다" 하고 바로 생성 | 1-2개 질문 먼저 |
| 결과만 전달 | 왜 그렇게 하는지 설명 |
| 단일 결과물 | 선택지와 트레이드오프 제시 |
| 사용자를 구경꾼으로 | 사용자를 공동 창작자로 |

### DesignHints 구조

```typescript
interface DesignHints {
  next_questions: string[];    // "등받이 각도는 어떻게 할까요?"
  inspirations: string[];      // "에르곤 의자는 15도 기울기가 표준이에요"
  knowledge: string[];         // "좌석 깊이가 깊으면 허리 지지가 약해져요"
  options: {
    label: string;             // "A: 편안함 우선"
    tradeoff: string;          // "깊이 45cm, 제조 복잡도 중간"
  }[];
  constraints: string[];       // "이 각도면 3D 프린팅 시 서포트 필요"
}
```

---

## Target Users

### 우리의 사용자는

| 페르소나 | 니즈 | 기존 솔루션 문제 |
|---------|------|-----------------|
| **커스텀 물건 원하는 사람** | "내 책상에 맞는 선반" | 쿠팡에 없음, CAD 어려움 |
| **세상에 없는 걸 만드는 사람** | 아이디어 → 도면 | 전문가 고용 비용 |
| **CAD 배우고 싶은 사람** | 지식 습득 | 학습 곡선 6개월+ |
| **제품 아이디어 있는 사람** | 프로토타입 직접 제작 | 도구 진입장벽 |
| **디자인 공유하고 싶은 사람** | 완성도 있는 도면 | 전문 도구 필요 |

### 우리의 사용자가 아닌 사람

- 쿠팡/아마존에서 살 수 있는 물건으로 충분한 사람
- "그냥 빨리 만들어줘"만 원하는 사람 (→ Zoo, Adam 추천)
- 이미 CAD 전문가인 사람 (→ 기존 도구가 더 효율적)

### 공통 특성

- **적극적**: 배우려는 의지가 있음
- **창작 욕구**: 자신만의 것을 원함
- **대화 의지**: AI와 협업할 준비가 됨

---

## Technical Architecture

### Direct-First Architecture

```
Claude Code CLI (Node.js)
    ↓ WASM 직접 로드 & 실행
Rust CAD 엔진
    ↓ scene.json 출력
브라우저 뷰어 (Phase 1: Canvas 2D / Phase 2+: Three.js)
```

### 뷰어 전략 (점진적 도입)

> Phase별 점진적 복잡도 증가 - 빠른 검증 우선
> (상세: [Architecture - 렌더링 기술 선택](./architecture.md#렌더링-기술-선택-phase별-점진적-도입))

| Phase | 렌더러 | 이유 |
|-------|--------|------|
| **Phase 1** | HTML Canvas 2D | 가장 단순, 빠른 검증 |
| **Phase 2** | Three.js | 3D 준비, 마이그레이션 비용 감수 |
| **Phase 3+** | wgpu (검토) | 성능 필요 시 도입 |

- **Phase 1**: Canvas 2D로 2D 도형 렌더링 (line, circle, rect)
- **Phase 2**: Three.js로 마이그레이션 (3D 준비)
- **Phase 3+**: 성능 병목 시 wgpu 검토

### CAD 엔진 (Rust → WASM)

**Primitives** (JSCAD 참조):
- `circle(radius)` / `ellipse(rx, ry)`
- `rectangle(width, height)` / `square(size)`
- `line(points)` / `polygon(points)`
- `arc(radius, startAngle, endAngle)`

**Transforms**:
- `translate(x, y)` / `rotate(angle)` / `scale(sx, sy)`

**Output**:
- Phase 1: scene.json (Three.js 렌더링용) + SVG export
- Phase 3: DXF export (2D 업계 표준)
- Phase 4+: STL (필수), STEP (옵션) - 3D 확장 시

### Tool Use Foundation (에이전트 런타임)

> **Story 3.0** - Claude가 CAD 도구를 tool_use 스키마로 직접 호출할 수 있는 기반
> Epic 3 (도형 편집)의 전제조건

**현재 문제**: Claude가 스크립트를 작성해서 WASM을 호출
**목표 상태**: Claude가 tool_use로 도구를 직접 호출 (자기 몸처럼)

```
현재: Claude → 스크립트 작성 → WASM 호출
목표: Claude → tool_use 블록 → 에이전트 런타임 → WASM 호출
```

**핵심 컴포넌트**:
- **도구 스키마**: 각 CAD 도구의 name, description, input_schema 정의
- **WASM Executor**: 입력 변환 자동화 (배열 → Float64Array)
- **에이전트 런타임**: LLM 호출 → tool_use 감지 → 실행 → 결과 반환 루프

**Progressive Exposure 패턴**:
- `listDomains()` → `listTools(domain)` → `getTool(name)` → `exec(name, input)`
- LLM 컨텍스트 효율성: 전체 API ~2000토큰 → 필요한 것만 ~110토큰

> 상세: [Architecture - Tool Use Foundation](./architecture.md#tool-use-foundation-에이전트-런타임)

---

## Success Criteria

### User Success

| 지표 | 목표 |
|------|------|
| 첫 결과물까지 시간 | < 5분 |
| 학습 시간 | 0분 (대화하면서 자연스럽게) |
| "원하는 결과" 도달률 | 측정 예정 |
| **사용자 CAD 지식 습득** | 대화 후 관련 용어 이해 |
| **처음 의도보다 나은 결과** | AI 제안으로 개선된 비율 |

**Aha! Moment**:
- Phase 1: "말했더니 진짜 그려졌다"
- Phase 2+: "AI 덕분에 더 좋은 디자인이 됐다"
- Ultimate: "나도 이제 CAD 개념을 알게 됐다"

### Business Success

- Phase 1: 기술 검증 (스켈레톤 테스트 통과)
- Phase 2: 도메인 확장 검증 (그룹화, ActionHints)
- Phase 3: 사용자 검증 (Selection UI, 실제 사용 케이스)
- Phase 4: 시장 검증

### Technical Success

- WASM 엔진 직접 실행 성공
- SVG 출력 정상 동작
- Claude Code에서 도구 호출 원활

---

## Product Scope

### Phase 1: 최소 검증 — "사람 스켈레톤을 그려줘"

**목표**: 기초 도형 도구만으로 AI가 복잡한 형상을 만들 수 있는지 검증

- 기초 도형: `line`, `circle`, `rect`, `arc`
- 스타일: `stroke`, `fill` 적용
- 변환: `translate`, `rotate`, `scale`, `delete`
- 출력: scene.json + SVG export
- **Tool Use Foundation**: Claude가 도구를 직접 호출할 수 있는 에이전트 런타임
- **Canvas 2D 뷰어** (polling 방식) - 가장 단순하게 시작

**검증 시나리오**: "사람 스켈레톤을 그려줘"

### Phase 2: 도메인 확장

**목표**: AI가 더 복잡한 구조를 다룰 수 있는지 검증

- Phase 1 도구 + 그룹화, 레이어
- 더 복잡한 요청: "팔을 구부린 포즈로", "걷는 자세로"
- ActionHints 동작 확인
- 검증 UI 프로토타입
- **Three.js로 뷰어 마이그레이션** (3D 준비)

### Phase 3: Selection UI + 실사용 테스트

**목표**: "가리키기 + 말하기" 인터랙션 검증

- Selection UI (클릭으로 객체 선택)
- 실제 작업 시도 (캐릭터 리깅용 스켈레톤 등)
- DXF 출력
- 인간-AI 협업 플로우 검증

### Phase 4+: Vision

- Gateway + 채팅 UI
- MCP 래퍼
- 로컬 LLM 지원
- 3D 확장

---

## Deployment Strategy

> **리서치 기반 (2025-12-16)**: Cursor, Jan AI, LM Studio, Figma 등 실제 사례 분석

### 배포 방식

| Phase | 방식 | 상세 |
|-------|------|------|
| Phase 1-2 | **로컬 앱** | Electron 기반 데스크톱 앱 (~100MB) |
| Phase 3+ | 로컬 + 웹 | 수요에 따라 웹 버전 추가 가능 |

### 데스크톱 프레임워크: Electron

> **결정: Electron** - WebGL/Three.js 기반 CAD 앱에서 Tauri는 치명적 리스크

| 항목 | Electron | Tauri |
|------|----------|-------|
| **WebGL 성능** | Chromium (최고) | WebKit (4.5배 느림) |
| **검증 사례** | Figma, VS Code | Jan AI (LLM 앱, WebGL 없음) |
| **앱 크기** | ~100MB | ~10MB |

**Tauri 부적합 이유**: WebGL2 미작동, Safari 4.5배 느림, 60Hz 고정 등
**참고**: Tauri는 LLM 채팅앱 등 WebGL 없는 앱에만 적합

### LLM 연결 옵션

| 옵션 | 방식 | Phase |
|------|------|-------|
| A | 로컬 LLM (Ollama 등) | Phase 1+ |
| B | 사용자 API 키 입력 | Phase 1+ |
| C | 서비스 API 제공 | Phase 4+ (수요 시) |

### 핵심 원칙

1. **오프라인 우선**: Cursor와 달리 서버 의존 없이 완전 동작
2. **클라우드 선택적**: 사용자가 원할 때만 클라우드 API 연결
3. **Figma 모델 참조**: Electron + WebGL, 웹/데스크톱 동일 코드베이스

> 상세: [Architecture - Deployment Strategy](./architecture.md#deployment-strategy)

---

## User Journey

### Phase 1: 말하기만 (최소 검증)

```
사용자: "사람 스켈레톤을 그려줘"
    ↓
Claude Code: WASM 엔진 호출 → scene.json 생성
    ↓
브라우저: Canvas 2D 렌더링 (polling으로 갱신)
    ↓
사용자: 결과 확인 → "팔을 더 길게"
    ↓
Claude Code: translate/scale 적용 → scene.json 업데이트
```

### Phase 2: 도메인 확장 (Three.js 도입)

```
사용자: "팔을 구부린 포즈로 바꿔줘"
    ↓
Claude Code: 그룹화된 엔티티 인식 → 관절 기준 회전 계산
    ↓
WASM: rotate + translate 조합 적용 → scene.json 업데이트
    ↓
브라우저: Three.js 렌더링 갱신 (3D 준비 완료)
    ↓
Claude Code: ActionHints 반환 → "다리도 구부릴까요?"
```

### Phase 3: 가리키기 + 말하기

```
사용자: [왼팔 클릭] + "이거 더 길게"
    ↓
브라우저: selection event {id: "left_arm", bounds: {...}}
    ↓
Claude Code: 선택된 객체 scale 적용 → scene.json 업데이트
    ↓
브라우저: Three.js 렌더링 갱신
```

### Interaction Pattern (Phase 3+)

| 허용 | 불허 |
|------|------|
| 클릭/탭 (선택) | 드래그로 이동 |
| 드래그 (범위 선택) | 직접 회전/스케일 |
| 핀치/줌 (뷰 조작) | 파라미터 입력 |

**원칙**: 선택/포인팅만 허용, 조작은 AI가 수행

---

## Data Model

### Scene 구조

```
Scene
├── metadata: { name, created_at, modified_at }
├── settings: { unit, grid_size, origin }
└── entities: Entity[]
```

### Entity 구조

```
Entity
├── id: string (uuid)
├── type: "line" | "circle" | "rect" | "polygon" | "arc" | "group"
├── geometry: Geometry (type별 상이)
├── transform: { translate, rotate, scale }
├── style: { stroke, fill, stroke_width }
└── metadata: { name?, layer?, locked? }
```

### Geometry 예시

```rust
// Line
{ points: [[x1, y1], [x2, y2], ...] }

// Circle
{ center: [x, y], radius: f64 }

// Rect
{ origin: [x, y], width: f64, height: f64 }
```

### 상태 관리

- **History**: Command 패턴으로 Undo/Redo 지원
- **Persistence**: JSON 직렬화 → 파일 저장

---

## Risks & Mitigations

| 리스크 | 영향 | 완화 전략 |
|--------|------|-----------|
| AI가 의도를 잘못 해석 | 높음 | 반복 수정으로 보완, 명확한 피드백 루프 |
| WASM 성능 부족 | 중간 | Phase 1은 간단한 도형만, 복잡도 점진적 증가 |
| Three.js 2D 표현 한계 | 낮음 | SVG fallback 옵션 유지 |
| 3D 확장 시 API 재설계 | 중간 | Point 타입을 처음부터 확장 가능하게 설계 |
| **wasm-bindgen API 설계** | 높음 | 클래스 래퍼 방식 사용, struct 왕복 피함 |
| **UUID/getrandom 호환성** | 중간 | `js_sys::Math::random()` 또는 `uuid` js feature |
| **Phase 3 역방향 통신** | 중간 | WebSocket 또는 이벤트 파일 큐 필요 (Selection UI용) |
| **DXF/STEP 복잡도 과소평가** | 중간 | Phase 3 이후로 미룸, "쉽다" 전제 금지 |
| **Electron 앱 크기** | 낮음 | ~100MB 허용 (WebGL 성능 우선), Figma도 동일 전략 |
| **rustwasm 조직 sunset** | 중간 | wasm-bindgen 새 조직 이전 완료, wasm-pack은 직접 빌드 대안 준비 |
| **WASM 브라우저 호환성** | 낮음 | IE 미지원 (영향 없음), 92/100 호환성 점수, 83% 사용자 커버 |

### 기술 부채 방지

- `Serializer` trait로 출력 포맷 추상화
- `Point<const N: usize>` 제네릭으로 2D/3D 통합
- wasm-bindgen 클래스 래퍼 패턴으로 API 설계
- `Float64Array` 등 명확한 타입 사용

---

## Out of Scope (Phase 1)

| 항목 | 이유 | 예정 |
|------|------|------|
| 그룹화/레이어 | Phase 1은 기초 도형만 | Phase 2 |
| ActionHints | 도메인 확장 단계에서 | Phase 2 |
| Selection UI | "가리키기" 인터랙션 | Phase 3 |
| DXF/DWG 출력 | SVG로 검증 후 | Phase 3 |
| 3D 기능 | 2D 먼저 검증 | Phase 4+ |
| 채팅 UI | Claude Code로 충분 | Phase 4+ |
| MCP 래퍼 | Direct-First 검증 후 | Phase 4+ |
| 실시간 협업 | 단일 사용자 먼저 | Phase 4+ |
| Undo/Redo UI | 엔진만 구현 | Phase 2-3 |

---

## Definition of Done (Phase 1)

### 필수 완료 조건

- [x] Rust CAD 엔진 WASM 빌드 성공
- [x] 기초 도형 4종: `line`, `circle`, `rect`, `arc`
- [x] 스타일 시스템: `stroke`, `fill` 적용
- [ ] 변환 4종: `translate`, `rotate`, `scale`, `delete`
- [x] scene.json 출력 정상 동작
- [x] Canvas 2D 뷰어에서 scene.json 렌더링 (polling)
- [ ] **Tool Use Foundation**: Claude가 tool_use로 도구 직접 호출
  - [ ] 도구 스키마 정의 (name, description, input_schema)
  - [ ] WASM Executor 래퍼 (입력 변환 자동화)
  - [ ] 에이전트 런타임 (tool_use 루프)

### 검증 시나리오 통과

```
입력: "사람 스켈레톤을 그려줘"
기대 결과:
- 머리 (circle)
- 몸통 (line 또는 rect)
- 팔 2개 (line)
- 다리 2개 (line)
- 적절한 비율과 위치
```

### 수정 요청 테스트

```
입력: "왼쪽 팔을 더 길게 해줘"
기대 결과: 해당 entity의 scale 또는 points 수정
```

---

