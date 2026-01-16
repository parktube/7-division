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
**Last Updated:** 2026-01-14
**Status:** Epic 1~8 완료, Epic 9 (웹 아키텍처) 계획 중

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
5. **Web-First Architecture**: 웹 브라우저 + Local MCP, 설치 없이 즉시 시작

## Project Classification

**Technical Type:** Web App (브라우저 + Local MCP)
**Domain:** Design Tools / Creative
**Complexity:** High (새로운 패러다임)
**Project Context:** Epic 1~8 완료, 웹 전환 진행 중

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

### 목표 아키텍처

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

### 핵심 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 통신 | WebSocket | 파일 폴링 대비 30배 빠름 (~15ms) |
| 배포 | GitHub Pages + npm | 설치 없이 즉시 시작, 업데이트 간편 |
| 보안 | localhost-only | 로컬 개발 도구, 원격 접근 불필요 |

### 완료된 기반 (Epic 1~9)

- WASM 엔진, 도형 6종, Boolean 연산, 텍스트 렌더링
- React 뷰어 (3패널, 스케치 모드)
- MCP 도메인 도구 (cad_code, discovery, scene, export, module)

상세: architecture.md 참조

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

- ✅ WASM 엔진 직접 실행 성공
- ✅ SVG 출력 정상 동작
- ✅ Claude Code에서 도구 호출 원활
- MCP + WebSocket 실시간 동기화 (진행 중)
- GitHub Pages 배포 성공 (진행 중)

---

## Functional Requirements

### 완료 (FR1~FR50) ✅

| Epic | FR | 요약 |
|------|-----|------|
| 1~3 | FR1~FR20 | 도형, 스타일, 변환, Canvas 뷰어 |
| 4~5 | FR21~FR29 | 그룹화, 피봇, Selection UI |
| 7 | FR31~FR42 | 3패널, 트리뷰, 스케치 모드, 이중 좌표 |
| 8 | FR43~FR50 | Boolean 연산, 기하 분석, 텍스트 렌더링 |

상세: [epics.md](./epics.md) 참조

### 진행 중: 웹 아키텍처 (FR51~FR58)

| ID | 요구사항 | 설명 |
|----|---------|------|
| FR51 | 모노레포 전환 | pnpm workspace (apps/viewer, apps/cad-mcp, packages/shared) |
| FR52 | WebSocket 통신 | MCP ↔ Viewer 실시간 동기화 |
| FR53 | MCP stdio 서버 | Claude Code 연동 |
| FR54 | MCP WebSocket 서버 | Viewer 연동 |
| FR55 | GitHub Pages 배포 | 정적 호스팅 |
| FR56 | npm 패키지 배포 | @ai-native-cad/mcp |
| FR57 | 온보딩 UI | MCP 미연결 시 가이드 |
| FR58 | 버전 호환성 체크 | MCP ↔ Viewer 버전 검증 |

## Non-Functional Requirements

### 완료 (NFR1~NFR20) ✅

성능, 오프라인 동작, 패널 리사이즈 60fps - 모두 충족.

### 진행 중: 웹 아키텍처

| ID | 요구사항 | 목표 |
|----|---------|------|
| NFR21 | WebSocket RTT | p50 < 15ms, p95 < 50ms |
| NFR22 | 첫 온보딩 | < 1분 (npx 한 줄) |
| NFR23 | 브라우저 호환 | Chrome, Firefox, Safari |

---

## Product Scope

### 완료 (Epic 1~8) ✅

| Epic | 산출물 |
|------|--------|
| 1~3 | WASM 엔진, 도형 6종, Canvas 뷰어 |
| 4~5 | 그룹/피봇, Selection UI |
| 7 | React 뷰어, 3패널, 스케치 모드 |
| 8 | Manifold Boolean, 텍스트 렌더링 |

### 현재 진행: Epic 9 - 웹 아키텍처 전환

**목표**: 웹 브라우저에서 즉시 사용, 1분 이내 온보딩

| Phase | 범위 | 산출물 |
|-------|------|--------|
| 1 | 모노레포 + WebSocket | pnpm workspace, useWebSocket |
| 2 | MCP 서버 | @ai-native-cad/mcp (npm) |
| 3 | 배포 | GitHub Pages, 온보딩 UI |
| 4 | 안정화 | 버전 호환성, 에러 복구 |

### Post-MVP

| 항목 | 설명 |
|------|------|
| MAMA 통합 | 세션 연속성, 결정 저장 |
| DXF 출력 | 2D 업계 표준 |
| 3D 확장 | STEP/STL, wgpu |

---

## Deployment Strategy

### 웹 배포

| 컴포넌트 | 위치 | 방법 |
|---------|------|------|
| Viewer | GitHub Pages | 자동 배포 (gh-pages) |
| MCP | npm registry | `npx @ai-native-cad/mcp start` |

### 사용자 시작 흐름

```
1. 웹 브라우저에서 Viewer 접속
2. "MCP 연결 필요" 가이드 확인
3. npx @ai-native-cad/mcp start (터미널)
4. 자동 연결 → 사용 시작
```

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

### 완료 (Epic 1~8) ✅

- ✅ WASM 엔진, 도형 6종, 그룹/피봇
- ✅ React 뷰어, 3패널, 스케치 모드
- ✅ Boolean 연산, 텍스트 렌더링

### 현재 목표: Epic 9 - 웹 아키텍처

- [ ] 모노레포 전환 (pnpm workspace)
- [ ] WebSocket 실시간 동기화
- [ ] MCP 서버 (stdio + WebSocket)
- [ ] GitHub Pages 배포
- [ ] 온보딩 UI (MCP 연결 가이드)
- [ ] npm 패키지 배포

---
