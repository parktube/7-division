# Story 9.8: 버전 호환성 체크

Status: in-progress

## Story

As a **사용자**,
I want **MCP와 Viewer 버전 불일치 시 경고를 받기를**,
so that **호환성 문제로 인한 버그를 예방할 수 있다** (FR58).

## Acceptance Criteria

1. **Given** Viewer와 MCP 서버가 연결될 때
   **When** 버전 핸드셰이크가 완료되면
   **Then** 호환성이 검증된다:
   - Major 버전 불일치: 에러 표시 + 연결 차단
   - Minor 버전 불일치: 경고 표시 + 연결 유지

2. **Given** Viewer 버전이 1.2.x이고 MCP가 1.3.x일 때
   **When** 연결되면
   **Then** "MCP 서버가 더 새로운 버전입니다. 업데이트를 권장합니다." 경고

3. **Given** Viewer 버전이 2.x이고 MCP가 1.x일 때
   **When** 연결을 시도하면
   **Then** "호환되지 않는 버전입니다. MCP를 업데이트하세요." 에러
   **And** 연결이 차단된다

4. **Given** 호환성 검증이 실패했을 때
   **When** Major 버전 불일치면
   **Then** 읽기 전용 오프라인 모드로 동작한다

## Tasks / Subtasks

- [x] Task 1: SemVer 파싱 유틸리티 (AC: #1)
  - [x] 1.1 apps/viewer/src/utils/version.ts 생성 (packages/shared 대신)
  - [x] 1.2 parseSemVer(version: string) 함수
  - [x] 1.3 pre-release 버전 핸들링 (1.0.0-beta.1 → 1.0.0)
  - [ ] 1.4 단위 테스트 **← 미완료**

- [x] Task 2: 호환성 검증 로직 (AC: #1, #2, #3)
  - [x] 2.1 apps/viewer/src/utils/version.ts에 구현
  - [x] 2.2 checkVersionCompatibility 함수
  - [x] 2.3 VersionCompatibilityResult 타입 정의
  - [x] 2.4 Major/Minor 버전 비교 로직
  - [ ] 2.5 단위 테스트 **← 미완료**

- [x] Task 3: MCP 서버 핸드셰이크 (AC: #1)
  - [x] 3.1 WebSocket 연결 시 connection 메시지 전송
  - [x] 3.2 mcpVersion, protocolVersion, minViewerVersion 포함
  - [x] 3.3 apps/cad-mcp/package.json 버전 읽기

- [x] Task 4: Viewer 호환성 체크 (AC: #1, #2, #3)
  - [x] 4.1 useWebSocket에서 connection 메시지 처리
  - [x] 4.2 checkVersionCompatibility 호출
  - [x] 4.3 호환성 상태 저장 (VersionCompatibilityResult)

- [x] Task 5: 호환성 경고/에러 UI (AC: #2, #3)
  - [x] 5.1 Onboarding.tsx에 버전 경고 배너 통합
  - [x] 5.2 Minor 불일치: 노란색 경고 배너
  - [x] 5.3 Major 불일치: 빨간색 에러 배너 + 차단 오버레이
  - [x] 5.4 업데이트 명령어 표시

- [x] Task 6: 오프라인/읽기 전용 모드 (AC: #4)
  - [x] 6.1 isReadOnly 상태 추가 [useWebSocket.ts:26,39]
  - [x] 6.2 Major 불일치 시 읽기 전용 활성화 [useWebSocket.ts:140,144]
  - [ ] 6.3 쓰기 작업 비활성화 UI **← UI 반영 미완료** (현재 MCP가 쓰기 작업 제어)

- [ ] Task 7: 테스트 (AC: #1~#4) **← 미완료**
  - [ ] 7.1 SemVer 파싱 테스트
  - [ ] 7.2 호환성 검증 테스트 (다양한 버전 조합)
  - [ ] 7.3 UI 렌더링 테스트
  - [ ] 7.4 E2E: 버전 불일치 시나리오

### Review Follow-ups (AI)

> 코드 리뷰 날짜: 2026-01-14 | 리뷰어: Claude Opus 4.5

**✅ AC 검증 결과**
- AC #1 ✓ parseSemVer, checkVersionCompatibility 함수 구현 [version.ts]
- AC #2 ✓ Minor 불일치 시 warning 반환 구현 [version.ts:75-86]
- AC #3 ✓ Major 불일치 시 error 반환 + 차단 메시지 [version.ts:60-72]
- AC #4 ✓ isReadOnly 상태 구현 [useWebSocket.ts:26,140,144,277]

**🟡 MEDIUM (권장 수정)**
- [ ] [AI-Review][MEDIUM] VIEWER_VERSION 하드코딩 - package.json과 동기화 필요 [version.ts:11]
- [ ] [AI-Review][MEDIUM] version.ts 단위 테스트 없음 - Task 7 완료 필요
- [ ] [AI-Review][MEDIUM] 스토리 구조 불일치 - 스토리는 packages/shared에 구현 요구, 실제는 apps/viewer/src/utils에 구현됨

**🟢 구현 완료 (코드)**
- ✓ SemVer 파싱 정규식 기반 구현 [version.ts:28-29]
- ✓ 파싱 실패 시 warning 반환 [version.ts:52-57]
- ✓ Onboarding 컴포넌트와 연동 완료 [Onboarding.tsx:8,53-87]

## Dev Notes

### Architecture Compliance

**Source:** [docs/architecture.md Part 2.5]

| 항목 | 정책 |
|------|------|
| 교환 시점 | WebSocket 연결 핸드셰이크 시 |
| 호환성 기준 | Major 버전 일치 필수 |
| 불일치 시 동작 | 경고 배너 + 제한 기능 모드 |
| 업데이트 방법 | `npx @ai-native-cad/mcp start` 재실행 |

### Technical Requirements

**SemVer 파싱:**

```typescript
// packages/shared/src/version.ts
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export function parseSemVer(version: string): SemVer {
  // 버전 비교를 위해 base 버전 추출 (예: "1.23.0-beta.0" → "1.23.0", prerelease는 별도 보존)
  const cleanVersion = version.split('-')[0];
  const [major, minor, patch] = cleanVersion.split('.').map(Number);

  return {
    major: major || 0,
    minor: minor || 0,
    patch: patch || 0,
    prerelease: version.includes('-') ? version.split('-')[1] : undefined,
  };
}
```

**호환성 체크:**

```typescript
// packages/shared/src/compatibility.ts
export interface CompatibilityResult {
  isCompatible: boolean;
  warnings: string[];
  disabledFeatures: string[];
  requiresUpgrade: 'mcp' | 'viewer' | null;
}

export function checkCompatibility(
  mcpVersion: string,
  viewerVersion: string,
  minViewerVersion: string
): CompatibilityResult {
  const mcp = parseSemVer(mcpVersion);
  const viewer = parseSemVer(viewerVersion);
  const minViewer = parseSemVer(minViewerVersion);

  const result: CompatibilityResult = {
    isCompatible: true,
    warnings: [],
    disabledFeatures: [],
    requiresUpgrade: null,
  };

  // Major 버전 불일치: 호환 불가
  if (mcp.major !== viewer.major) {
    result.isCompatible = false;
    result.requiresUpgrade = mcp.major > viewer.major ? 'viewer' : 'mcp';
    return result;
  }

  // Viewer가 minViewerVersion 미만
  if (viewer.major < minViewer.major ||
      (viewer.major === minViewer.major && viewer.minor < minViewer.minor)) {
    result.isCompatible = false;
    result.requiresUpgrade = 'viewer';
    return result;
  }

  // Minor 불일치 경고
  if (mcp.minor !== viewer.minor) {
    result.warnings.push(
      mcp.minor > viewer.minor
        ? 'MCP 서버가 더 새로운 버전입니다. 업데이트를 권장합니다.'
        : 'Viewer가 더 새로운 버전입니다.'
    );
  }

  return result;
}
```

**핸드셰이크 메시지:**

```typescript
// MCP 서버 → Viewer
interface ConnectionMessage {
  type: 'connection';
  data: {
    mcpVersion: string;       // "1.2.3"
    protocolVersion: number;  // 1
    minViewerVersion: string; // "1.0.0"
  };
  timestamp: number;
}
```

**불일치 시 UX:**

| 상태 | 동작 | 메시지 |
|------|------|--------|
| Major 불일치 | 연결 차단 | "MCP 업데이트 필요: `npx @ai-native-cad/mcp start`" |
| Minor 불일치 | 경고 배너 | "일부 기능 비활성화됨. 최신 버전 권장." |
| 호환 | 정상 연결 | - |

### File Structure

```
packages/shared/src/
├── version.ts           # SemVer 파싱
├── compatibility.ts     # 호환성 검증
└── index.ts             # re-export

apps/viewer/src/
├── components/
│   └── VersionWarningBanner.tsx  # 경고/에러 UI
└── hooks/
    └── useWebSocket.ts           # 호환성 체크 통합
```

### Dependencies

- **선행 스토리**: Story 9.2 (useWebSocket), Story 9.3 (핸드셰이크)
- **후행 스토리**: 없음 (Phase 3 마지막)

### Version Matrix

| MCP | Viewer | minViewer | 결과 |
|-----|--------|-----------|------|
| 1.2.0 | 1.2.0 | 1.0.0 | 호환 |
| 1.3.0 | 1.2.0 | 1.0.0 | 경고 (MCP 더 신규) |
| 1.2.0 | 1.3.0 | 1.0.0 | 경고 (Viewer 더 신규) |
| 2.0.0 | 1.2.0 | 1.0.0 | 에러 (Major 불일치) |
| 1.2.0 | 0.9.0 | 1.0.0 | 에러 (minViewer 미만) |

### Potential Risks

| 위험 | 완화 전략 |
|------|----------|
| SemVer 파싱 실패 | try-catch + 기본값 (0.0.0) |
| 버전 형식 불일치 | 정규식 검증 |
| 읽기 전용 모드 UX | 명확한 안내 메시지 |

### Testing Requirements

**단위 테스트:**
```bash
cd packages/shared && pnpm test
```

**버전 조합 테스트:**
```typescript
describe('checkCompatibility', () => {
  it('호환 버전', () => {
    const result = checkCompatibility('1.2.0', '1.2.0', '1.0.0');
    expect(result.isCompatible).toBe(true);
  });

  it('Major 불일치', () => {
    const result = checkCompatibility('2.0.0', '1.2.0', '1.0.0');
    expect(result.isCompatible).toBe(false);
    expect(result.requiresUpgrade).toBe('viewer');
  });
});
```

### References

- [Source: docs/architecture.md#2.5] - Version Sync Policy
- [Source: docs/epics.md#Story-9.8] - Story 정의 및 AC
- [SemVer Spec] - https://semver.org/

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

**구현된 파일:**
```
apps/viewer/src/utils/version.ts              # SemVer 파싱 및 호환성 체크
apps/viewer/src/components/Onboarding.tsx     # 버전 경고/에러 UI
apps/cad-mcp/src/ws-server.ts                 # connection 핸드셰이크 메시지
```

**남은 작업:**
- Task 6 읽기 전용 모드 구현 (AC #4)
- Task 7 테스트 추가

