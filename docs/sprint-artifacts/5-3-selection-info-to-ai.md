# Story 5.3: 선택 정보 AI 전달

Status: done

## Story

As a **AI 에이전트 (Claude Code)**,
I want **사용자가 선택한 도형 정보를 받을 수 있도록**,
so that **"이거" 같은 지시어를 이해할 수 있다**.

## Acceptance Criteria

1. **AC1: selection.json 폴링**
   - Given: Claude Code 세션이 활성화된 상태
   - When: 사용자가 도형을 선택
   - Then: Claude가 viewer/selection.json을 읽어 선택 정보를 얻을 수 있다

2. **AC2: 선택 정보 구조**
   - Given: selection.json 파일
   - When: Claude가 파일을 읽음
   - Then: 선택된 도형의 id, type, geometry 정보를 얻을 수 있다

3. **AC3: "이거" 지시어 처리**
   - Given: 사용자가 도형을 선택한 상태
   - When: "이거 더 길게" 같은 요청
   - Then: Claude가 selection.json을 확인하여 대상 도형을 식별한다
   - And: 해당 도형에 scale 또는 수정을 적용한다

4. **AC4: 다중 선택 처리**
   - Given: 여러 도형이 선택된 상태
   - When: "이것들 빨간색으로" 같은 요청
   - Then: Claude가 모든 선택된 도형에 스타일을 적용한다

5. **AC5: 선택 없는 상태 처리**
   - Given: 아무것도 선택되지 않은 상태
   - When: "이거 삭제해" 같은 요청
   - Then: Claude가 선택된 도형이 없음을 인식한다
   - And: 사용자에게 도형을 선택하라고 안내한다

6. **AC6: get_selection CLI 명령어**
   - Given: cad-cli.ts에 get_selection 명령어 존재
   - When: `npx tsx cad-cli.ts get_selection` 실행
   - Then: 현재 선택 정보를 JSON으로 출력한다

7. **AC7: 선택 정보와 Entity 정보 결합**
   - Given: selection.json에 entity_id가 있는 상태
   - When: Claude가 선택 정보 조회
   - Then: get_entity로 상세 정보를 함께 조회할 수 있다

8. **AC8: 선택 시점 추적**
   - Given: selection.json에 timestamp 필드 존재
   - When: Claude가 폴링
   - Then: 마지막으로 선택이 변경된 시점을 알 수 있다
   - And: 이전 폴링 이후 변경 여부를 판단할 수 있다

## Tasks / Subtasks

- [x] **Task 1: get_selection CLI 명령어** (AC: 1, 6)
  - [x] 1.1: cad-cli.ts에 `get_selection` 명령어 추가
  - [x] 1.2: viewer/selection.json 파일 읽기
  - [x] 1.3: 파일이 없으면 `{ selected_ids: [], last_selected: null }` 반환
  - [x] 1.4: JSON 형식으로 출력

- [x] **Task 2: 선택 정보 + Entity 정보 결합** (AC: 2, 7)
  - [ ] 2.1: `get_selection --detailed` 옵션 추가 (optional) - 미구현, Claude가 get_entity 호출로 대체
  - [x] 2.2: 각 selected_id에 대해 get_entity 정보 포함 - Claude가 별도 호출
  - [x] 2.3: 또는 별도 조회로 처리 (Claude가 필요 시 get_entity 호출)

- [x] **Task 3: selection.json 위치 표준화** (AC: 1)
  - [x] 3.1: viewer/selection.json 경로 확정
  - [x] 3.2: cad-cli.ts에서 동일 경로 참조
  - [ ] 3.3: 경로를 환경변수 또는 설정으로 관리 (optional) - 미구현

- [x] **Task 4: Claude 프롬프트 가이드 작성** (AC: 3, 4, 5)
  - [x] 4.1: CLAUDE.md에 selection 사용법 추가 (get_selection 명령어)
  - [x] 4.2: "이거", "이것들" 같은 지시어 처리 가이드 - 기본 안내 포함
  - [x] 4.3: 선택이 없을 때 사용자 안내 예시 - hint 메시지 포함

- [x] **Task 5: 타임스탬프 활용 가이드** (AC: 8)
  - [x] 5.1: selection.json에 timestamp 필드 포함
  - [ ] 5.2: "이전 timestamp를 저장하고, 새 조회 시 비교하여 변경 여부 판단" 패턴 설명 - optional
  - [ ] 5.3: 예시 코드 또는 의사코드 제공 - optional

- [x] **Task 6: 테스트** (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] 6.1: get_selection 명령어 테스트
  - [x] 6.2: 선택 없는 상태 테스트
  - [x] 6.3: 단일 선택 테스트
  - [x] 6.4: 다중 선택 테스트 (그룹 선택 포함)
  - [x] 6.5: E2E 테스트 - 브라우저에서 선택 → CLI로 조회

## Dev Notes

### Architecture Compliance

**Dual-Architecture Strategy 준수:**

| 모드 | 선택 정보 획득 | AI 통신 방식 |
|------|---------------|--------------|
| **Mode A** (CLI) | selection.json 파일 | Claude가 get_selection CLI 호출 |
| **Mode B** (App) | executor.getSelection() | Claude API 요청에 포함 |

**Mode A (현재 구현 대상):**

- 브라우저: 클릭 시 selection.json 저장
- Claude: get_selection 또는 직접 파일 읽기로 선택 정보 획득
- 폴링 간격: 필요 시에만 조회 (scene.json처럼 주기적 폴링 필요 없음)

**Mode B 최적화 (Epic 6 구현 시):**

- Chat UI에서 Claude API 호출 시 executor.getSelection() 포함
- selection.json 불필요 → 파일 I/O 제거
- "이거" 같은 지시어를 API 메시지에 직접 포함

**기존 도구와의 통합:**

- Mode A: get_selection으로 선택 정보 획득
- Mode B: executor.getSelection()으로 선택 정보 획득
- 공통: get_entity로 상세 정보 조회, translate/scale/set_fill 등으로 수정

### Technical Requirements

1. **selection.json 전체 구조**:

   ```json
   {
     "selected_ids": ["head", "body"],
     "last_selected": "body",
     "timestamp": 1703912345678,
     "selection_type": "click"
   }
   ```

2. **get_selection 출력 예시**:

   ```json
   {
     "selected_ids": ["head"],
     "last_selected": "head",
     "timestamp": 1703912345678
   }
   ```

3. **get_selection --detailed 출력 예시** (optional):

   ```json
   {
     "selected_ids": ["head"],
     "last_selected": "head",
     "timestamp": 1703912345678,
     "entities": [
       {
         "id": "head",
         "entity_type": "Circle",
         "geometry": { "Circle": { "center": [0, 100], "radius": 30 } }
       }
     ]
   }
   ```

4. **CLAUDE.md 추가 내용**:

   ```markdown
   ### Selection (선택)

   ```bash
   # 현재 선택된 도형 조회
   npx tsx cad-cli.ts get_selection

   # 선택된 도형에 명령 적용
   # 1. 선택 정보 확인
   # 2. selected_ids로 대상 식별
   # 3. 해당 도형에 명령 실행
   ```

   "이거", "이것", "선택한 것" 같은 지시어가 있으면:
   1. get_selection으로 선택 정보 확인
   2. 선택된 도형에 요청된 작업 수행
   3. 선택이 없으면 사용자에게 도형 선택 안내

   ```

5. **Claude 동작 흐름**:

   ```
   사용자: "이거 더 길게"

   Claude:
   1. get_selection → selected_ids: ["arm"]
   2. get_entity '{"name":"arm"}' → Line 정보
   3. scale '{"name":"arm","sx":1.5,"sy":1}'
   4. "arm 도형을 1.5배로 늘렸습니다"
   ```

### File Structure Notes

수정 대상 파일:

- `cad-tools/cad-cli.ts` - get_selection 명령어 추가
- `CLAUDE.md` - selection 사용법 가이드 추가

의존 파일:

- `viewer/selection.json` - Story 5-1에서 생성

### References

- [Source: docs/architecture.md#파일 폴링 아키텍처]
- [Source: docs/epics.md#Story 5.3: 선택 정보 AI 전달]
- [Source: docs/sprint-artifacts/5-1-click-selection.md - selection.json 구조]

## Dev Agent Record

### Context Reference

- docs/architecture.md (파일 폴링 아키텍처)
- docs/epics.md (Epic 5, Story 5.3)
- docs/sprint-artifacts/5-1-click-selection.md
- cad-tools/cad-cli.ts

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록)

### Completion Notes List

(구현 시 기록)

### File List

(구현 시 기록)
