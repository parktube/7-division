# Story 7.3.3: 상태 저장 및 LLM 경고

Status: done

## Story

As a **LLM**,
I want **hidden/lock 상태가 selection.json에 저장되고, Lock된 엔티티 수정 시 경고를 받기를**,
so that **사용자 의도를 존중하고 보호된 엔티티를 건드리지 않을 수 있다** (FR37).

## Acceptance Criteria

1. **AC1**: hidden_entities, locked_entities가 selection.json에 저장
2. **AC2**: 새로고침/재시작 시 상태 복원
3. **AC3**: LLM이 잠긴 엔티티 수정 시도 시 경고 메시지 반환
4. **AC4**: 경고 포맷: "Warning: [entity] is locked by user"
5. **AC5**: 경고 옵션: 실행 거부 또는 경고와 함께 실행

## Tasks / Subtasks

- [x] Task 1: selection.json 완전 동기화 (AC: #1)
  - [x] hidden_entities 저장/로드
  - [x] locked_entities 저장/로드
  - [x] selected_entities 저장/로드

- [x] Task 2: 상태 복원 (AC: #2)
  - [x] 앱 시작 시 selection.json 로드
  - [x] 각 상태 훅에 초기값 설정
  - [x] 로드 실패 시 기본값 사용

- [x] Task 3: cad-tools Lock 검사 (AC: #3, #4)
  - [x] 수정 명령 전 lock 상태 확인
  - [x] 잠금 시 경고 메시지 생성
  - [x] CLI 출력에 경고 표시

- [x] Task 4: 경고 동작 옵션 (AC: #5)
  - [x] 설정: strict (거부) / warn (경고 후 실행)
  - [x] 기본값: warn
  - [x] 사용자 설정 가능

- [x] Task 5: 문서화 (AC: #4)
  - [x] LLM에게 경고 메시지 포맷 안내
  - [x] CLAUDE.md에 Lock 동작 설명

## Dev Notes

### 의존성: Story 7-3-2

- Story 7-3-2: Lock 토글

### selection.json 최종 포맷

```json
{
  "selected_entities": ["circle_1", "rect_2"],
  "locked_entities": ["important_group", "reference_line"],
  "hidden_entities": ["construction_lines", "debug_helpers"],
  "timestamp": 1704499200000
}
```

### 상태 복원 로직

```typescript
// src/hooks/useAppState.ts
import { useEffect, useState } from 'react';
import { loadSelection } from '@/utils/selectionIO';
import { useSelection } from './useSelection';
import { useVisibility } from './useVisibility';
import { useLock } from './useLock';

export function useAppState(scene: Scene | null) {
  const [isInitialized, setIsInitialized] = useState(false);

  const selection = useSelection();
  const visibility = useVisibility();
  const lock = useLock(scene);

  // 초기 로드
  useEffect(() => {
    loadSelection().then((data) => {
      // 선택 상태 복원
      if (data.selected_entities?.length > 0) {
        data.selected_entities.forEach(id => selection.addToSelection(id));
      }

      // 숨김 상태 복원
      if (data.hidden_entities?.length > 0) {
        data.hidden_entities.forEach(id => visibility.hide(id));
      }

      // 잠금 상태 복원
      if (data.locked_entities?.length > 0) {
        data.locked_entities.forEach(id => lock.lock(id));
      }

      setIsInitialized(true);
    });
  }, []);

  // 상태 변경 시 저장
  useEffect(() => {
    if (!isInitialized) return;

    saveSelection({
      selected_entities: selection.selectedArray,
      hidden_entities: Array.from(visibility.hiddenIds),
      locked_entities: Array.from(lock.lockedIds),
      timestamp: Date.now(),
    });
  }, [
    isInitialized,
    selection.selectedIds,
    visibility.hiddenIds,
    lock.lockedIds,
  ]);

  return { selection, visibility, lock, isInitialized };
}
```

### cad-tools Lock 검사

```typescript
// cad-tools/src/commands/base.ts
import fs from 'fs';
import path from 'path';

interface LockCheckResult {
  isLocked: boolean;
  warning?: string;
}

export function checkLockStatus(entityId: string): LockCheckResult {
  const selectionPath = path.join(process.cwd(), 'viewer/selection.json');

  try {
    const data = JSON.parse(fs.readFileSync(selectionPath, 'utf-8'));
    const lockedEntities: string[] = data.locked_entities || [];

    if (lockedEntities.includes(entityId)) {
      return {
        isLocked: true,
        warning: `Warning: "${entityId}" is locked by user`,
      };
    }

    // 그룹 내 엔티티 확인 (부모 잠금)
    // scene.json에서 그룹 구조 확인 필요
    // ...

    return { isLocked: false };
  } catch {
    return { isLocked: false };
  }
}
```

### 수정 명령에 Lock 검사 적용

```typescript
// cad-tools/src/commands/translate.ts
import { checkLockStatus } from './base';
import { logger } from '../logger';

export function translate(name: string, dx: number, dy: number) {
  const lockCheck = checkLockStatus(name);

  if (lockCheck.isLocked) {
    // 경고 출력
    logger.warn(lockCheck.warning);

    // 설정에 따라 동작 결정
    const lockMode = getLockMode();  // 'strict' | 'warn'

    if (lockMode === 'strict') {
      return {
        success: false,
        error: lockCheck.warning,
      };
    }
    // 'warn' 모드: 경고 후 계속 실행
  }

  // 실제 translate 실행
  return performTranslate(name, dx, dy);
}
```

### 경고 메시지 포맷

```
# 단일 엔티티
Warning: "important_circle" is locked by user

# 다중 엔티티
Warning: The following entities are locked by user:
  - important_circle
  - reference_line

# 그룹 내 엔티티
Warning: "child_rect" is locked (parent "main_group" is locked by user)
```

### Lock 모드 설정

```typescript
// cad-tools/src/config.ts
interface CadConfig {
  lockMode: 'strict' | 'warn';  // 기본: 'warn'
}

// .cad-state.json에 저장
{
  "config": {
    "lockMode": "warn"
  }
}
```

### CLAUDE.md 문서화

```markdown
## Lock 시스템

사용자가 뷰어에서 엔티티를 잠금 처리하면 `selection.json`의 `locked_entities`에 저장됩니다.

### 잠긴 엔티티 수정 시
- 경고 메시지 출력: `Warning: "[name]" is locked by user`
- 기본 동작: 경고 후 실행 (warn 모드)
- strict 모드: 실행 거부

### LLM 권장 동작
1. 경고가 뜨면 사용자에게 확인 요청
2. 중요한 엔티티는 의도적으로 잠겨 있을 수 있음
3. 잠금 해제가 필요하면 사용자에게 요청

### 경고 무시 (비권장)
```bash
# 명령어 뒤에 --force 추가
run_cad_code main "translate('locked_entity', 10, 0)" --force
```
```

### Anti-Patterns (금지)

```typescript
// ❌ 잠금 무조건 무시
const translate = (name, dx, dy) => {
  // lock 체크 없이 실행
  performTranslate(name, dx, dy);
};

// ❌ 경고만 출력하고 사용자 피드백 없음
if (lockCheck.isLocked) {
  console.log(lockCheck.warning);  // logger 사용, 반환값에 포함
}

// ❌ selection.json 직접 수정으로 잠금 해제
fs.writeFileSync('selection.json', { locked_entities: [] });  // 사용자 의도 무시
```

### References

- [docs/architecture.md#파일 통신 확장] - selection.json
- FR37: Lock 가드
- CLAUDE.md - 명령어 문서

## Dev Agent Record

### Context Reference

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

- viewer/src/hooks/useSelectionSync.ts (modify) - selection.json 완전 동기화
- cad-tools/src/sandbox/index.ts (modify) - Lock 검사 및 경고 로직
- CLAUDE.md (modify) - Lock 가드 문서화
