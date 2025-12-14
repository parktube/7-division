---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - docs/ax-design-guide.md
  - docs/ai-native-cad-proposal.md
workflowType: 'product-brief'
lastStep: 2
project_name: 'r2-7f-division'
user_name: 'Hoons'
date: '2025-12-14'
---

# Product Brief: r2-7f-division (AI-Native CAD)

**Date:** 2025-12-14
**Author:** Hoons

---

## Executive Summary

AI-Native CAD는 "말하고 가리키면, AI가 만든다" 패러다임의 CAD 도구이다.
인간은 의도를 전달하고 결과를 검증하며, AI가 도구를 직접 조작한다.
레거시 CAD의 40년 기술 부채 없이 백지에서 시작하여, AI-Native 설계를 구현한다.

---

## Core Vision

### Problem Statement

CAD는 일상과 가장 가까운 전문 도구이다.
- 집을 리모델링하고 싶다
- 가구를 직접 설계하고 싶다
- 3D 프린터로 뭔가 만들고 싶다
- 나만의 전자기기를 만들고 싶다

모두 CAD가 필요하지만, 복잡해서 포기한다.

### Problem Impact

- 6개월 학습 → 기본 사용
- 3년 경력 → 능숙한 사용
- "전문가"라는 희소성이 진입 장벽

**실제 사례**: 박범석님은 자신만의 기타 앰프를 만들고 싶어서 CAD에 도전했다.
너무 불편해서 직접 KiCad MCP를 만들었다.

### Why Existing Solutions Fall Short

| 레거시 | 문제점 |
|--------|--------|
| 40년 기술 부채 | 구조적 변화 불가 |
| AI 채팅 붙이기 | 본질은 여전히 "인간이 조작" |
| 복잡한 UI/메뉴 | 학습 곡선 가파름 |
| Tinkercad, Shapr3D | "쉬운 CAD"지만 여전히 도구 학습 필요 |

레거시는 못 바꾼다. 안 바꾼다.

### Proposed Solution

**AI-Native 접근:**
```
인간 → [의도 + 가리키기] → AI → [도구] → 결과
                                   ↓
                              인간이 검증
```

**Direct-First Architecture:**
```
브라우저 (뷰어 + Selection)
    ↓ selection event (id, type, bounds)
Claude Code CLI (Node.js)
    ↓ WASM 직접 로드 & 실행
Rust CAD 엔진
    ↓ SVG/JSON 파일 출력
브라우저 (렌더링)
```

- MCP 없이 직접 실행 (4계층 → 1계층)
- 브라우저는 검증 UI + Selection UI로 사용
- LLM 교체 가능 (로컬 LLM으로 보안 클라이언트 대응)
- 향후 MCP 추가 가능 (래퍼만 얹으면 됨)

### Key Differentiators

1. **AI-Native 설계**: AI가 도구를 조작, 인간은 검증
2. **Direct-First**: MCP 없이 WASM 직접 실행, 복잡성 제거
3. **학습 곡선 제거**: 0분 학습 → 의도 전달
4. **확장성**: LLM 교체 가능, MCP 추가 가능
5. **AX 원칙 적용**: LLM 추론을 막지 않는 설계
6. **Minimal Direct Manipulation**: 선택/포인팅만 허용, 조작은 AI가 수행

### Interaction Pattern: "가리키기 + 말하기"

```
AI-Native에서 허용되는 직접 조작:
─────────────────────────────────
✅ 선택 (클릭/탭)     → "이거"를 가리킴
✅ 포인팅 (hover)     → 대상 지정
✅ 드래그 (범위 선택)  → "이 영역" 지정
✅ 핀치/줌            → 뷰 조작

❌ 조작 (이동/회전/스케일) → AI가 함
❌ 생성 (그리기)          → AI가 함
❌ 파라미터 조정          → AI가 함
```

**사용 예시:**
```
사용자: [왼쪽 팔 클릭] + "이거 더 길게"
AI: 선택된 객체(left_arm) 길이 +20% 적용

사용자: [두 객체 드래그 선택] + "이거 정렬해줘"
AI: 선택된 2개 객체 수평 정렬
```

---

## Target Users

| 유형 | 니즈 | 현재 장벽 |
|------|------|----------|
| 메이커 | 전자기기/앰프 설계 | CAD 학습 6개월+ |
| 홈 리모델러 | 인테리어 도면 | 업체 의존 |
| 3D 프린터 사용자 | 커스텀 모델링 | Fusion360 학습 곡선 |

**공통점**: 아이디어는 있음. 도구 사용법이 장벽. "배우기 싫고, 만들고 싶다"

**User Journey**: 말하기 → AI 실행 → 가리키며 수정 → 완성

---

## Success Metrics

### Phase 1 검증 기준 (스켈레톤 테스트)

| 지표 | 목표 |
|------|------|
| AI가 기초 도형으로 스켈레톤 분해 | 가능/불가능 |
| 도구 호출 순서 합리성 | 인간 검토 통과 |
| 수정 요청 대응 | "팔 더 길게" → 정확히 반영 |
| 완료 시간 | 첫 결과물 < 5분 |

### Phase 2+ KPI

| 지표 | 측정 방법 |
|------|----------|
| 학습 시간 | 첫 결과물까지 소요 시간 (목표: < 1시간) |
| 반복 수정 횟수 | 원하는 결과까지 평균 iteration |
| 완성률 | 시작 → 만족스러운 결과 비율 |

---

## MVP Scope

### Phase 1: 최소 검증 (MVP)

**Core Features:**
- 기초 도형 도구: `line`, `circle`, `rect`, `move`, `rotate`, `delete`
- SVG 출력
- Claude Code에서 직접 실행
- 정적 뷰어 (file watch + 자동 새로고침)

**검증 시나리오:** "사람 스켈레톤을 그려줘"

### Out of Scope (Phase 1)

| 제외 항목 | 이유 |
|----------|------|
| Selection UI (가리키기) | Phase 2에서 추가 |
| 3D | 2D 먼저 검증 |
| DXF 출력 | SVG로 검증 후 |
| 채팅 UI | Claude Code로 충분 |
| MCP 래퍼 | Direct-First 검증 후 |

### Phase 2+: 확장

- Selection UI (Minimal Direct Manipulation)
- DXF 출력
- Gateway + 채팅 UI (선택)
- MCP 래퍼 (선택)
- 로컬 LLM 지원

---
