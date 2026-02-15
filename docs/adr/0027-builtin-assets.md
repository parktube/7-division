# ADR-0027: Built-in Assets Distribution

## Status

**Proposed**

## Date

2026-01-21

## Context

`@ai-native-cad/mcp` 패키지를 npm으로 배포할 때, 새 사용자는 빈 상태에서 시작한다.

**현재 문제:**
1. 예제 모듈이 없어 처음 시작이 어려움
2. 베스트 프랙티스 참고 자료가 없음
3. MAMA recommendations이 빈 DB에서 동작하지 않음

**목표:**
- 개발자가 제공하는 기본 모듈/knowledge를 패키지에 포함
- 사용자 데이터와 완전 분리 (덮어쓰기 방지)
- npm 업데이트 시 기본 데이터 자동 갱신

## Decision

**Dual-source 아키텍처 채택**

### 데이터 소스 분리

| 소스 | 위치 | 권한 | 업데이트 |
|------|------|------|---------|
| Builtin | `node_modules/@ai-native-cad/mcp/assets/` | 읽기 전용 | npm update |
| User | `~/.ai-native-cad/` | 읽기/쓰기 | 사용자 관리 |

### 패키지 구조

```
apps/cad-mcp/
├── assets/                      # npm 배포 포함 (package.json files)
│   ├── modules/                 # 기본 CAD 모듈
│   │   ├── animal_lib.js        # Crossy Road 동물 라이브러리
│   │   ├── chicken.js           # 닭 캐릭터
│   │   ├── pig.js               # 돼지 캐릭터
│   │   ├── crossy_lib.js        # Crossy Road 유틸리티
│   │   └── ...
│   └── knowledge/               # 기본 MAMA decisions
│       └── decisions.json       # 베스트 프랙티스
├── dist/
├── wasm/
└── package.json
    files: ["dist", "wasm", "assets"]
```

### Dual-source 병합 전략

```typescript
// 모듈 조회
async function listModules(): Promise<ModuleInfo[]> {
  const builtinModules = await scanDir(BUILTIN_MODULES_PATH);
  const userModules = await scanDir(USER_MODULES_PATH);

  return [
    ...builtinModules.map(m => ({ ...m, source: 'builtin' as const })),
    ...userModules.map(m => ({ ...m, source: 'user' as const }))
  ];
}

// 모듈 읽기 (user 우선)
async function readModule(name: string): Promise<string> {
  const userPath = path.join(USER_MODULES_PATH, `${name}.js`);
  if (await exists(userPath)) {
    return fs.readFile(userPath, 'utf-8');
  }

  const builtinPath = path.join(BUILTIN_MODULES_PATH, `${name}.js`);
  if (await exists(builtinPath)) {
    return fs.readFile(builtinPath, 'utf-8');
  }

  throw new Error(`Module "${name}" not found`);
}

// MAMA 검색 (양쪽 병합)
async function searchDecisions(query: string): Promise<Decision[]> {
  const builtinResults = await searchBuiltinKnowledge(query);
  const userResults = await searchUserDB(query);

  return [
    ...builtinResults.map(d => ({ ...d, source: 'builtin' })),
    ...userResults.map(d => ({ ...d, source: 'user' }))
  ].sort((a, b) => b.similarity - a.similarity);
}
```

### Builtin 보호

```typescript
// write/edit 시 검증
function validateWriteTarget(file: string): void {
  const builtinPath = path.join(BUILTIN_MODULES_PATH, `${file}.js`);

  if (fs.existsSync(builtinPath)) {
    throw new Error(
      `Cannot modify builtin module "${file}". ` +
      `Copy to user modules: write({ file: "${file}_custom", ... })`
    );
  }
}
```

### Knowledge JSON 포맷

```json
{
  "version": "1.0.0",
  "updated_at": "2026-01-21",
  "decisions": [
    {
      "id": "builtin_voxel_color_001",
      "topic": "voxel:best_practice:color",
      "decision": "Crossy Road 스타일은 60-30-10 컬러 비율 권장",
      "reasoning": "60% 주색, 30% 보조색, 10% 강조색으로 시각적 균형. Evidence: 원작 분석 결과.",
      "confidence": 0.9,
      "outcome": "success"
    },
    {
      "id": "builtin_voxel_scale_001",
      "topic": "voxel:best_practice:scale",
      "decision": "캐릭터 기본 크기는 8-12 유닛 권장",
      "reasoning": "화면 비율과 가독성 최적화. 너무 작으면 디테일 표현 어려움.",
      "confidence": 0.85,
      "outcome": "success"
    }
  ]
}
```

## Consequences

### Positive

- 새 사용자도 즉시 예제 실행 가능
- 베스트 프랙티스 자동 제공
- npm update로 새 모듈/knowledge 자동 획득
- 사용자 데이터 100% 보존

### Negative

- 패키지 크기 증가 (~100KB for modules + knowledge)
- Dual-source 로직 복잡도 증가
- builtin vs user 구분 UI 필요

### Risks

- 모듈 이름 충돌 가능 → user 우선 정책으로 해결
- knowledge 버전 호환성 → version 필드로 마이그레이션 지원

## Alternatives Considered

### Option 1: 첫 실행 시 복사

```typescript
// 첫 실행 시 assets/ → ~/.ai-native-cad/ 복사
if (!fs.existsSync(USER_MODULES_PATH)) {
  fs.cpSync(BUILTIN_MODULES_PATH, USER_MODULES_PATH);
}
```

- **장점:** 구현 단순
- **단점:** npm 업데이트 시 새 모듈 자동 추가 불가, 사용자 수정과 충돌
- **결론:** 기각

### Option 2: 원격 저장소에서 다운로드

- **장점:** 패키지 크기 작음
- **단점:** 네트워크 의존, 오프라인 불가
- **결론:** 기각 - 로컬 우선 원칙 위반

### Option 3: 별도 npm 패키지

```bash
npm install @ai-native-cad/mcp @ai-native-cad/modules
```

- **장점:** 모듈화
- **단점:** 설치 복잡, 버전 동기화 문제
- **결론:** 기각 - 단일 패키지 원칙 위반

## References

- [Story 11.20: Built-in Assets Distribution](../sprint-artifacts/11-20-module-distribution.md)
- [ADR-0024: Module Library Recommendation](0024-module-library-recommendation.md)
- [ADR-0016: 단일 DB + Topic Prefix](0016-project-specific-db.md)
