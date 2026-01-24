# Story 11.20: Built-in Assets Distribution

Status: Done

## Story

As a **MCP 패키지 사용자**,
I want **npm install 시 기본 모듈과 knowledge가 포함되기를**,
So that **즉시 예제를 실행하고 베스트 프랙티스를 참고할 수 있다** (FR88-FR91).

## Background

현재 CAD 모듈과 MAMA decisions은 사용자 로컬 디렉토리(`~/.ai-native-cad/`)에만 저장된다.
새 사용자는 빈 상태에서 시작해야 하며, 예제 모듈이나 베스트 프랙티스가 없다.

**목표**: 개발자가 제공하는 기본 데이터와 사용자 데이터를 분리하여 관리

```
개발자 제공 (읽기 전용, npm 업데이트 시 갱신)
├── assets/modules/      ← 기본 CAD 모듈
└── assets/knowledge/    ← 기본 decisions (베스트 프랙티스)

사용자 데이터 (읽기/쓰기, 영구 보존)
└── ~/.ai-native-cad/
    ├── modules/         ← 사용자 모듈
    └── data/mama.db     ← 사용자 decisions
```

## Acceptance Criteria

### AC1: 패키지에 기본 모듈 포함
**Given** `@ai-native-cad/mcp` 패키지를 설치할 때
**When** npm install이 완료되면
**Then** `assets/modules/` 디렉토리에 기본 모듈들이 포함된다

### AC2: 패키지에 기본 knowledge 포함
**Given** 패키지를 설치할 때
**When** npm install이 완료되면
**Then** `assets/knowledge/decisions.json`에 베스트 프랙티스 decisions이 포함된다

### AC3: Dual-source 모듈 조회
**Given** glob/read 도구를 사용할 때
**When** 모듈 목록을 조회하면
**Then** 개발자 제공 모듈(builtin)과 사용자 모듈(user) 모두 반환된다

### AC4: Source 구분 표시
**Given** glob 결과를 확인할 때
**When** 파일 목록이 반환되면
**Then** 각 파일에 `source: "builtin" | "user"` 플래그가 표시된다

### AC5: 사용자 모듈만 쓰기 가능
**Given** write/edit 도구를 사용할 때
**When** builtin 모듈을 수정하려 하면
**Then** 에러가 반환되고 "Copy to user modules first" 안내가 표시된다

### AC6: Dual-source MAMA 검색
**Given** mama_search를 사용할 때
**When** 검색을 실행하면
**Then** builtin knowledge와 사용자 decisions 모두 검색된다

### AC7: npm 업데이트 시 builtin 갱신
**Given** 패키지를 업데이트할 때
**When** npm update가 완료되면
**Then** builtin 모듈/knowledge가 새 버전으로 갱신되고 사용자 데이터는 보존된다

## Tasks / Subtasks

- [x] Task 1: assets 디렉토리 구조 생성 (AC: #1, #2)
  - [x] 1.1 `assets/modules/` 디렉토리 생성
  - [x] 1.2 현재 모듈들 복사 (crossy_lib, animal_lib, chicken)
  - [x] 1.3 `assets/knowledge/decisions.json` 생성
  - [x] 1.4 베스트 프랙티스 decisions 큐레이션 (12개)

- [x] Task 2: package.json 업데이트 (AC: #1, #2, #7)
  - [x] 2.1 files 필드에 "assets" 추가

- [x] Task 3: Dual-source 로직 구현 (AC: #3, #4, #5)
  - [x] 3.1 모듈 경로 resolver 구현 (paths.ts)
  - [x] 3.2 glob 도구에 source 필드 추가 (FileInfo 타입)
  - [x] 3.3 read 도구 dual-source 지원
  - [x] 3.4 write/edit builtin 보호 로직 (isBuiltinModule)

- [x] Task 4: MAMA Dual-source 구현 (AC: #6)
  - [x] 4.1 builtin knowledge 로더 구현 (builtin-knowledge.ts)
  - [x] 4.2 mama_search에 builtin 결과 병합
  - [x] 4.3 결과에 source 필드 추가

- [x] Task 5: 테스트 작성
  - [x] 5.1 dual-source glob 테스트
  - [x] 5.2 builtin 보호 테스트
  - [x] 5.3 MAMA 병합 검색 테스트

## Dev Notes

### 패키지 구조

```
apps/cad-mcp/
├── assets/                      # npm 배포에 포함
│   ├── modules/                 # 기본 CAD 모듈
│   │   ├── animal_lib.js
│   │   ├── chicken.js
│   │   ├── pig.js
│   │   └── ...
│   └── knowledge/               # 기본 MAMA decisions
│       └── decisions.json
├── src/
├── dist/
├── wasm/
└── package.json
    files: ["dist", "wasm", "assets"]
```

### Dual-source 경로 해석

```typescript
const MODULE_SOURCES = {
  builtin: path.join(__dirname, '../assets/modules'),
  user: path.join(os.homedir(), '.ai-native-cad/modules')
};

// glob 결과
{
  files: [
    { name: "animal_lib", source: "builtin" },
    { name: "my_custom", source: "user" }
  ]
}
```

### Builtin 보호 로직

```typescript
function validateWriteTarget(file: string): void {
  const builtinPath = path.join(MODULE_SOURCES.builtin, `${file}.js`);
  if (fs.existsSync(builtinPath)) {
    throw new Error(
      `Cannot modify builtin module "${file}". ` +
      `Use write({ file: "${file}_custom", ... }) to create your own version.`
    );
  }
}
```

### Knowledge JSON 포맷

```json
{
  "version": "1.0.0",
  "decisions": [
    {
      "topic": "voxel:best_practice:color",
      "decision": "Crossy Road 스타일은 60-30-10 컬러 비율 권장",
      "reasoning": "60% 주색, 30% 보조색, 10% 강조색으로 시각적 균형",
      "source": "builtin"
    }
  ]
}
```

### References

- [Source: docs/architecture.md#package-structure]
- [Source: docs/adr/0027-builtin-assets.md]

### Dependencies

- **선행**: Story 11.19 (Module Library Recommendation)

### File List

- `apps/cad-mcp/assets/modules/*.js` (신규)
- `apps/cad-mcp/assets/knowledge/decisions.json` (신규)
- `apps/cad-mcp/package.json` (수정)
- `apps/cad-mcp/src/sandbox/module-resolver.ts` (수정)
- `apps/cad-mcp/src/tools/glob.ts` (수정)
- `apps/cad-mcp/src/tools/read.ts` (수정)
- `apps/cad-mcp/src/tools/write.ts` (수정)
- `apps/cad-mcp/src/mama/search.ts` (수정)
