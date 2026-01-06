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
**Date:** 2025-01-06
**Status:** MVP 완료, Epic 7 진행 중

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

### 현재 구현 (MVP 완료)

```
Claude Code CLI → cad-tools (WASM) → scene.json → Canvas 2D Viewer
```

- **CAD 엔진**: Rust → WASM, circle/rect/line/polygon/arc/bezier + group + pivot
- **뷰어**: Canvas 2D (viewer/), Electron 앱 (cad-electron/)
- **출력**: scene.json, SVG export
- **CLI**: `run_cad_code` - JavaScript 코드로 도형 생성

### Epic 7에서 변경 예정

```
viewer/ (React + Vite) → 단일 소스
cad-electron/ → viewer/dist 직접 로드
```

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

- **MVP**: 기술 검증 + 도메인 확장 + 사용자 검증 (스켈레톤 → 포즈 변경 → Selection)
- **Post-MVP**: 시장 검증, 3D 확장

### Technical Success

- WASM 엔진 직접 실행 성공
- SVG 출력 정상 동작
- Claude Code에서 도구 호출 원활
- **Electron 앱 빌드 및 배포 성공**

---

## Functional Requirements

### 완료된 요구사항 (FR1~FR29) ✅

기초 도형, 스타일, 변환, 그룹화, 피봇, Selection UI, Electron 앱 - 모두 완료. 상세는 [epics.md](./epics.md) 참조.

### 인간-LLM 협업 UI (FR31~FR40) - 진행 중

| ID | 요구사항 | 설명 |
|----|---------|------|
| FR31 | 3패널 레이아웃 | Layer Panel / Canvas / Info Panel 구성 |
| FR32 | 패널 리사이즈 | 드래그로 패널 너비 조절 |
| FR33 | 계층 트리뷰 | JS 코드의 그룹/오브젝트를 트리로 표시 |
| FR34 | 그룹 탐색 | 그룹 선택, 확장, 중첩 그룹 탐색 |
| FR35 | 다중 선택 | Ctrl/Shift + 클릭으로 복수 선택 |
| FR36 | Visible 토글 | 끄면 Canvas에서 숨김 |
| FR37 | Lock 가드 | 잠긴 엔티티 수정 시 LLM에 경고 반환 |
| FR38 | 스케치 모드 | Canvas에 그리기/지우기 UI, 투명 오버레이 |
| FR39 | 스케치 캡쳐 | capture_viewport로 스케치 포함 캡쳐 → Vision 해석 |
| FR40 | 단일 소스 | viewer/가 유일한 소스, 웹/Electron 동일 코드 |

## Non-Functional Requirements

### 완료 (NFR1~NFR17) ✅

그룹 중첩, 선택 반응 100ms, 앱 시작 5초, 오프라인 동작 - 모두 충족.

### 진행 중 (NFR18~NFR20)

| ID | 요구사항 | 설명 |
|----|---------|------|
| NFR18 | 패널 리사이즈 성능 | 60fps 유지 |
| NFR19 | 렌더링 동등성 | React 전환 후 기존과 동일 품질 |
| NFR20 | 웹/Electron 동등성 | 동일 기능 동작 |

---

## Product Scope

### MVP ✅ 완료

기초 도형, 스타일, 변환, 그룹화, 피봇, Selection UI, Electron 앱 - 모두 완료.

### Epic 7: 인간-LLM 협업 UI - 진행 중

**목적**: LLM이 만든 코드와 유저 인터랙션의 양방향 연결

#### Layer Panel - LLM 코드 ↔ 유저 선택 연동

| 기능 | 설명 |
|------|------|
| 계층 표시 | JS 코드의 그룹/오브젝트가 트리로 표시 |
| 그룹 선택 | 그룹 클릭 → 전체 선택 |
| 그룹 확장 | 펼쳐서 내부 오브젝트 개별 선택 |
| 중첩 그룹 | 그룹 안의 그룹 탐색 |
| 다중 선택 | Ctrl/Shift + 클릭 |
| Visible | 끄면 Canvas에서 숨김 |
| Lock | **잠기면 LLM이 수정 불가** (경고 반환) |

#### Canvas - 유저 스케치 → 캡쳐 이미지 → LLM Vision

| 기능 | 설명 |
|------|------|
| 스케치 모드 | 그리기/지우기/전체삭제 툴바 |
| 스케치 레이어 | CAD 씬 위 투명 오버레이 (휘발성) |
| 캡쳐 전달 | capture_viewport로 스케치 포함 PNG → Vision 해석 |
| Grid Overlay | 캡쳐 시 눈금자 포함 → Vision이 좌표 파악 |

```
┌─────────────┬──────────────────────┬─────────────┐
│   Layer     │       Canvas         │    Info     │
│   Panel     │                      │   Panel     │
│             │  - 렌더링            │             │
│  - 트리뷰   │  - Pan/Zoom          │  - 선택정보 │
│  - Lock     │  - 스케치 모드       │  - Bounds   │
│  - Visible  │  - capture → LLM    │             │
└─────────────┴──────────────────────┴─────────────┘
```

**성공 지표**:
- [ ] 유저가 레이어에서 선택 → LLM이 해당 엔티티 인식
- [ ] Lock된 엔티티 수정 시도 → LLM에 경고 반환
- [ ] 유저 스케치 + 캡쳐 → LLM Vision이 의도 해석

### Post-MVP

| 항목 | 설명 |
|------|------|
| ActionHints 확장 | DesignHints 포함 협업 경험 |
| DXF 출력 | 2D 업계 표준 |
| 3D 확장 | STEP/STL, wgpu |
| Gateway + 채팅 UI | 별도 서비스 |

---

## Deployment Strategy

- **데스크톱**: Electron (~100MB), Windows/Mac/Linux
- **AI 연결**: Claude Code 사용 (API 키 관리 위임)
- **오프라인**: CAD 기능은 API 없이 동작

---

## User Journey

```
"스켈레톤 그려줘" → Claude Code → WASM → scene.json → Viewer
[Layer Panel에서 왼팔 선택] + "더 길게" → selection.json → Claude Code → 수정
[스케치 모드에서 삼각형 그리기] + "이 모양으로" → capture_viewport → Vision 해석 → 생성
```

**원칙**: Layer Panel에서 선택, Canvas에서 스케치, 조작은 AI가 수행

---

## Risks

| 리스크 | 완화 |
|--------|------|
| AI 의도 오해석 | 반복 수정, 피드백 루프 |
| React 전환 시 렌더링 버그 | 기존 로직 정확 포팅 + 비교 테스트 |
| Transform 로직 복잡도 | 단위 테스트 작성 |

---

## Definition of Done

### MVP ✅ 완료

WASM 엔진, 도형 6종, 그룹/피봇, Selection UI, Electron 앱 - 모두 완료.

### Epic 7: 인간-LLM 협업 UI (진행 중)

- [ ] Layer Panel 트리뷰 + 그룹 탐색 + 다중 선택
- [ ] Lock 가드 (잠긴 엔티티 수정 시 LLM 경고)
- [ ] 스케치 모드 (그리기/지우기 UI + 캡쳐 전달)
- [ ] Grid Overlay (Vision 좌표 감지용)
- [ ] 웹/Electron 동일 동작

---
