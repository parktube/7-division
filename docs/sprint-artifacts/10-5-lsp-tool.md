# Story 10.5: lsp 도구 구현

Status: ready-for-dev

## Story

As a **LLM 에이전트**,
I want **lsp 도구로 built-in 함수와 사용자 모듈 심볼을 탐색할 수 있기를**,
so that **사용 가능한 모든 함수와 클래스를 확인할 수 있다** (FR63).

## Acceptance Criteria

### Built-in 함수 탐색

1. **AC1: 도메인 목록 조회**
   - Given: 도메인 목록을 요청할 때
   - When: `lsp({ operation: 'domains' })` 호출하면
   - Then: `['primitives', 'transforms', 'style', 'groups', 'query', 'boolean', 'geometry', 'utility']` 목록 반환

2. **AC2: 도메인별 함수 설명**
   - Given: 특정 도메인을 요청할 때
   - When: `lsp({ operation: 'describe', domain: 'primitives' })` 호출하면
   - Then: 해당 도메인의 함수 시그니처 목록 반환

3. **AC3: 함수 스키마 조회**
   - Given: 특정 함수 스키마를 요청할 때
   - When: `lsp({ operation: 'schema', name: 'drawCircle' })` 호출하면
   - Then: 상세 파라미터 스키마 반환 (타입, 설명, 예제)

### 사용자 모듈 심볼 탐색 (일반 LSP 패턴)

4. **AC4: 모듈 심볼 추출**
   - Given: 사용자 모듈이 존재할 때
   - When: `lsp({ operation: 'symbols', file: 'house_lib' })` 호출하면
   - Then: 해당 모듈의 심볼 목록 반환 (class, function, const)

5. **AC5: 심볼 종류 구분**
   - Given: 모듈에 다양한 심볼이 있을 때
   - When: symbols를 조회하면
   - Then: 각 심볼의 kind가 구분됨 ('class', 'function', 'const')

6. **AC6: main 파일 심볼 추출**
   - Given: main 파일을 조회할 때
   - When: `lsp({ operation: 'symbols', file: 'main' })` 호출하면
   - Then: main 파일의 심볼 목록 반환

### 에러 처리

7. **AC7: 존재하지 않는 도메인 처리**
   - Given: 잘못된 도메인명일 때
   - When: `lsp({ operation: 'describe', domain: 'nonexistent' })` 호출하면
   - Then: 에러 메시지 반환 ("Unknown domain: nonexistent")

8. **AC8: 존재하지 않는 함수 처리**
   - Given: 잘못된 함수명일 때
   - When: `lsp({ operation: 'schema', name: 'unknownFunc' })` 호출하면
   - Then: 에러 메시지 반환 ("Unknown function: unknownFunc")

9. **AC9: 존재하지 않는 파일 처리**
   - Given: 잘못된 파일명일 때
   - When: `lsp({ operation: 'symbols', file: 'nonexistent' })` 호출하면
   - Then: 에러 메시지 반환 ("File not found: nonexistent")

### MCP 통합

10. **AC10: MCP 도구 등록**
    - Given: MCP 서버가 시작될 때
    - When: 도구 목록을 조회하면
    - Then: `lsp` 도구가 등록되어 있음

11. **AC11: Description 전략**
    - Given: lsp 도구가 등록될 때
    - When: description을 조회하면
    - Then: "코드 탐색. built-in 함수(domains/describe/schema) + 모듈 심볼(symbols)." 메시지 포함

## Tasks / Subtasks

- [ ] **Task 1: lsp 도구 스키마 정의** (AC: #10, #11)
  - [ ] 1.1 `apps/cad-mcp/src/schema.ts`에 LSP_TOOL 스키마 추가
  - [ ] 1.2 inputSchema 정의 (operation: required, domain: optional, name: optional, file: optional)
  - [ ] 1.3 description 작성: "코드 탐색. built-in 함수(domains/describe/schema) + 모듈 심볼(symbols)."

- [ ] **Task 2: built-in 함수 탐색 구현** (AC: #1, #2, #3, #7, #8)
  - [ ] 2.1 `apps/cad-mcp/src/tools/lsp.ts` 파일 생성
  - [ ] 2.2 'domains' operation 구현 (기존 list_domains 로직 재활용)
  - [ ] 2.3 'describe' operation 구현 (기존 describe 로직 재활용)
  - [ ] 2.4 'schema' operation 구현 (기존 get_tool_schema 로직 재활용)
  - [ ] 2.5 에러 처리 (존재하지 않는 도메인/함수)

- [ ] **Task 3: 모듈 심볼 추출 구현** (AC: #4, #5, #6, #9)
  - [ ] 3.1 'symbols' operation 구현
  - [ ] 3.2 JS 코드에서 class 추출 (정규식 또는 간단한 파서)
  - [ ] 3.3 JS 코드에서 function 추출
  - [ ] 3.4 JS 코드에서 const/let/var 추출
  - [ ] 3.5 main 파일 심볼 추출 지원
  - [ ] 3.6 존재하지 않는 파일 에러 처리

- [ ] **Task 4: MCP 서버 통합** (AC: #10)
  - [ ] 4.1 `apps/cad-mcp/src/mcp-server.ts`에 lsp 핸들러 등록
  - [ ] 4.2 CAD_TOOLS에 lsp 추가

- [ ] **Task 5: 테스트 작성** (AC: #1~#9)
  - [ ] 5.1 `apps/cad-mcp/src/__tests__/lsp.test.ts` 생성
  - [ ] 5.2 도메인 목록 조회 테스트
  - [ ] 5.3 도메인 함수 설명 테스트
  - [ ] 5.4 함수 스키마 조회 테스트
  - [ ] 5.5 모듈 심볼 추출 테스트 (class, function, const)
  - [ ] 5.6 에러 처리 테스트

## Dev Notes

### Architecture Patterns

- **일반적인 LSP 패턴 준수**: built-in + 사용자 정의 심볼 모두 노출
- **기존 discovery 통합**: discovery의 list_domains, describe, get_schema를 하나로 통합
- **symbols operation 추가**: 사용자 모듈의 class/function/const 추출

### Source Tree Components

```
apps/cad-mcp/src/
├── tools/
│   ├── glob.ts          # 10-1
│   ├── read.ts          # 10-2
│   ├── edit.ts          # 10-3
│   ├── write.ts         # 10-4
│   └── lsp.ts           # 신규: lsp 핸들러 (built-in + symbols)
├── schema.ts            # 수정: LSP_TOOL 스키마 추가
├── discovery.ts         # 참고: 기존 discovery 로직
└── mcp-server.ts        # 수정: lsp 핸들러 등록
```

### API 설계

```typescript
// lsp 도구 입력 스키마
interface LspInput {
  operation: 'domains' | 'describe' | 'schema' | 'symbols';
  domain?: string;  // 'describe' operation용
  name?: string;    // 'schema' operation용
  file?: string;    // 'symbols' operation용 (main 또는 모듈명)
}

// lsp 도구 출력 (operation별)
interface LspOutput {
  success: boolean;
  data: {
    // domains: 도메인 목록
    domains?: string[];

    // describe: 함수 시그니처 목록
    functions?: {
      name: string;
      signature: string;
      description: string;
      example?: string;
    }[];

    // schema: 단일 함수 상세
    schema?: {
      name: string;
      signature: string;
      description: string;
      example?: string;
      parameters?: Record<string, ParameterInfo>;
    };

    // symbols: 모듈 심볼 목록
    symbols?: {
      name: string;
      kind: 'class' | 'function' | 'const' | 'let' | 'var';
      signature?: string;  // 클래스: constructor 시그니처, 함수: 전체 시그니처
      methods?: string[];  // 클래스인 경우 메서드 목록
    }[];
  };
  error?: string;
}
```

### symbols 사용 예시

```javascript
// house_lib 모듈 내용
class House {
  constructor(name, x, y) { ... }
  build() { ... }
  setColor(color) { ... }
}

function createHouse(name, x, y) { ... }

const DEFAULT_HEIGHT = 50;

// symbols 조회 결과
lsp({ operation: 'symbols', file: 'house_lib' })
// → {
//   success: true,
//   data: {
//     symbols: [
//       { name: 'House', kind: 'class', signature: 'constructor(name, x, y)', methods: ['build', 'setColor'] },
//       { name: 'createHouse', kind: 'function', signature: 'function createHouse(name, x, y)' },
//       { name: 'DEFAULT_HEIGHT', kind: 'const' }
//     ]
//   }
// }
```

### 심볼 추출 전략

**1. Class 추출:**
```javascript
// 정규식 패턴
/class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{/g

// constructor 추출
/constructor\s*\(([^)]*)\)/

// 메서드 추출
/(\w+)\s*\([^)]*\)\s*\{/g
```

**2. Function 추출:**
```javascript
// 함수 선언
/function\s+(\w+)\s*\(([^)]*)\)/g

// 화살표 함수 (const)
/const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=])\s*=>/g
```

**3. 변수 추출:**
```javascript
// const/let/var
/(const|let|var)\s+(\w+)\s*=/g
```

**구현 복잡도 낮추기:**
- 완벽한 JS 파서 대신 정규식 기반 추출
- CAD 모듈은 단순한 구조이므로 충분
- 필요시 acorn/esprima 도입 가능

### Description 전략

```typescript
const LSP_DESCRIPTION = '코드 탐색. built-in 함수(domains/describe/schema) + 모듈 심볼(symbols).';
```

**중요**:
- 일반적인 LSP처럼 **built-in + 사용자 정의 모두** 탐색 가능
- operation 4가지를 그룹화: built-in(3개) + symbols(1개)
- 기존 discovery보다 확장된 기능

### 기존 코드 재활용

**1. DOMAINS 상수 (schema.ts):**
```typescript
export const DOMAINS = {
  primitives: ['drawCircle', 'drawRect', ...],
  style: ['setFill', 'setStroke', 'drawOrder'],
  transforms: ['translate', 'rotate', ...],
  // ...
};
```

**2. FUNCTION_SIGNATURES 상수 (schema.ts):**
```typescript
export const FUNCTION_SIGNATURES = {
  drawCircle: {
    signature: "drawCircle(name: string, x: number, y: number, radius: number): boolean",
    description: "원을 그립니다. 중심 좌표와 반지름 지정",
    example: "drawCircle('head', 0, 50, 30)",
  },
  // ...
};
```

**3. discovery.ts 로직:**
```typescript
// list_domains → lsp domains
return Object.keys(DOMAINS);

// describe → lsp describe
return DOMAINS[domain].map(fn => FUNCTION_SIGNATURES[fn]);

// get_schema → lsp schema
return FUNCTION_SIGNATURES[name];
```

**4. 파일 읽기 (symbols용):**
```typescript
// main 파일 경로
const mainPath = `~/.ai-native-cad/scene.code.js`;

// 모듈 파일 경로
const modulePath = `~/.ai-native-cad/modules/${file}.js`;
```

### Testing Standards

- Vitest 사용
- DOMAINS, FUNCTION_SIGNATURES 상수 직접 참조
- 모든 도메인/함수 존재 테스트
- 심볼 추출 테스트 (mock 파일 사용)
- 에러 케이스 테스트

### References

- [Source: docs/architecture.md#Part 3: AX Improvement (Epic 10)]
- [Source: docs/epics.md#Story 10.5: lsp 도구 구현]
- [Source: apps/cad-mcp/src/schema.ts#DOMAINS] - 도메인 정의
- [Source: apps/cad-mcp/src/schema.ts#FUNCTION_SIGNATURES] - 함수 시그니처
- [Source: apps/cad-mcp/src/discovery.ts] - 기존 discovery 로직

### Previous Story Intelligence

- 10-1~10-4: tools/ 디렉토리 패턴 확립
- 10-1 glob: 파일 목록 조회 → lsp symbols와 연계
- 10-2 read: 파일 내용 읽기 → symbols가 내부적으로 활용

### 의존성

- **기존 schema.ts**: DOMAINS, FUNCTION_SIGNATURES 상수
- **기존 discovery.ts**: 로직 재활용 (제거 예정 - 10-7에서)
- **10-2 read 로직**: 파일 읽기 경로 결정 로직 재활용

### 리스크 및 주의사항

1. **discovery와의 충돌**: lsp 구현 후 discovery는 10-7에서 제거
2. **심볼 추출 정확도**: 정규식 기반이므로 복잡한 JS 구문에서 누락 가능
3. **성능**: 대용량 모듈에서 정규식 성능 고려 (현재 CAD 모듈은 소규모)
4. **향후 확장성**: acorn/esprima 파서 도입으로 정확도 향상 가능

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List

- `apps/cad-mcp/src/tools/lsp.ts` (신규)
- `apps/cad-mcp/src/schema.ts` (수정)
- `apps/cad-mcp/src/mcp-server.ts` (수정)
- `apps/cad-mcp/src/__tests__/lsp.test.ts` (신규)
