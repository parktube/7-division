# ADR-008: MCP Tool Pattern Alignment with Claude Code

## Status

Accepted

## Date

2026-01-15 (Proposed) → 2026-01-17 (Accepted)

## Context

LLM이 MCP CAD 도구를 올바르게 사용하지 못하는 문제가 발생했습니다:

1. **Read-first 패턴 무시**: `cad_code` 도구를 사용할 때 기존 파일을 먼저 확인하지 않고 바로 새 코드 작성
2. **기존 모듈 무시**: `module` 목록을 확인하지 않고 새 모듈 생성
3. **통합 도구의 한계**: 하나의 도구(`cad_code`)에 읽기/쓰기/실행이 모두 통합되어 "기본 모드"만 사용

### 근본 원인 분석

| 항목 | Claude Code | MCP CAD (현재) |
|------|-------------|----------------|
| 도구 구조 | Read/Edit/Write **분리** | cad_code 하나에 **통합** |
| 행동 명확성 | 이름 = 행동 | 이름 ≠ 행동 |
| Read-first 강제 | Description에 명시 + 에러 반환 | 없음 |
| 결과 | 올바른 패턴 | **잘못된 패턴** |

LLM은 이미 Claude Code 도구 패턴을 학습했습니다. 같은 이름 = 같은 행동을 기대합니다.

## Decision

MCP CAD 도구를 **Claude Code 패턴과 완전히 일치**하도록 재설계합니다.

### 도구 매핑

| Claude Code | MCP CAD (신규) | 역할 |
|-------------|----------------|------|
| Glob | `glob` | 파일 목록 (main + 모듈) |
| Read | `read` | 파일 읽기 |
| Edit | `edit` | 파일 부분 수정 → 자동 실행 |
| Write | `write` | 파일 전체 작성 → 자동 실행 |
| LSP | `lsp` | 코드 인텔리전스 (함수 탐색) |
| Bash | `bash` | 명령 실행 (씬 조회, 내보내기 등) |

### 제거되는 도구

- `cad_code` → `read`, `edit`, `write`로 분리
- `module` → `glob`, `read`, `edit`, `write`로 통합
- `discovery` → `lsp`로 이름 변경
- `scene` → `bash`로 통합
- `export` → `bash`로 통합

### 상세 설계

#### 1. 파일 관리 (glob, read, edit, write)

**파일명 규칙:** 확장자 없이 논리적 이름 사용 (내부에서 `.js` 확장자 처리)
- `'main'` → `~/.ai-native-cad/scene.code.js`
- `'iso_lib'` → `~/.ai-native-cad/modules/iso_lib.js`

```javascript
// 파일 목록
glob({})                              // ['main', 'iso_lib', 'city_lib']
glob({ pattern: '*_lib' })            // ['iso_lib', 'city_lib']

// 파일 읽기
read({ file: 'main' })                // main 코드 반환
read({ file: 'iso_lib' })             // 모듈 코드 반환

// 파일 수정 (부분) → 자동 실행 → 실패 시 자동 롤백
edit({
  file: 'main',
  old_code: 'drawCircle(...)',
  new_code: 'drawRect(...)'
})

// 파일 작성 (전체) → 자동 실행 → 실패 시 자동 롤백
write({ file: 'main', code: '...' })
write({ file: 'new_lib', code: '...' })  // 새 모듈 생성
```

**롤백 동작:** edit/write 실행 실패 시 파일이 원본으로 복원되고, 씬도 main.js 재실행으로 복원됨.

#### 2. 코드 인텔리전스 (lsp)

```javascript
// 도메인 목록
lsp({ operation: 'domains' })

// 함수 설명
lsp({ operation: 'describe', domain: 'primitives' })

// 함수 스키마
lsp({ operation: 'schema', name: 'drawCircle' })
```

#### 3. 명령 실행 (bash)

```javascript
// 씬 조회
bash({ command: 'info' })             // 씬 정보
bash({ command: 'tree' })             // 씬 트리 구조
bash({ command: 'groups' })           // 그룹 목록
bash({ command: 'draw_order' })       // z-order

// 씬 조작
bash({ command: 'reset' })            // 씬 초기화

// 내보내기
bash({ command: 'capture' })          // 스크린샷 (PNG)
bash({ command: 'svg' })              // SVG 출력
bash({ command: 'json' })             // JSON 출력
```

### Description 전략

각 도구의 description에 Claude Code와 동일한 패턴 강조:

```javascript
read: '파일 읽기. edit/write 전에 반드시 먼저 확인.'
edit: '파일 부분 수정. ⚠️ read로 먼저 확인 필수.'
write: '파일 전체 작성. ⚠️ 기존 파일은 read로 먼저 확인.'
```

## Consequences

### 장점

1. **학습 비용 제로**: LLM이 이미 아는 Claude Code 패턴 그대로
2. **Read-first 패턴 유도**: 분리된 도구로 자연스럽게 "먼저 읽기" 유도
3. **일관성**: Claude Code ↔ MCP CAD 간 동일한 사용 패턴
4. **단순화**: 7개 → 6개 도구로 감소

### 단점

1. **Breaking Change**: 기존 도구 이름/구조 변경
2. **마이그레이션 필요**: CLAUDE.md, 문서, 테스트 업데이트

### 마이그레이션 완료 (2026-01-15)

1. ✅ 새 도구 구현 완료 (glob, read, edit, write, lsp, bash)
2. ✅ 기존 도구 deprecated 경고 추가
3. ✅ 병행 운영 기간 완료
4. ✅ 기존 도구 제거 (cad_code, discovery, scene, export, module)

## Alternatives Considered

### 1. 이름만 변경 (js_editor)

- 근본 해결 안 됨
- 통합 도구의 "기본 모드만 사용" 문제 지속

### 2. Description만 개선

- LLM이 description보다 이름 먼저 인식
- 효과 불확실

### 3. 도구 분리 (다른 이름)

- js_read, js_edit, js_run 등
- 새로운 학습 필요
- Claude Code 패턴 활용 못함

## Related Documents

- [CLAUDE.md](../../CLAUDE.md) - 도구 사용 가이드 (업데이트 필요)
- [ADR-003](./003-claude-code-integration.md) - Claude Code 통합
- [Architecture](../architecture.md) - 아키텍처 (업데이트 필요)

---

_ADR-008 - MCP Tool Pattern Alignment with Claude Code_
