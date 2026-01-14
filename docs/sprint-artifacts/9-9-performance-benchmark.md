# Story 9.9: 성능 벤치마크

Status: drafted

## Story

As a **개발자**,
I want **WebSocket 성능을 측정할 수 있기를**,
so that **NFR21 (RTT p50 < 15ms, p95 < 50ms)을 검증할 수 있다** (NFR21).

## Acceptance Criteria

1. **Given** MCP 서버가 실행 중일 때
   **When** `pnpm run benchmark` (로컬)를 실행하면
   **Then** 100회 왕복 시간이 측정된다
   **And** p50, p95, max 지표가 출력된다

2. **Given** 벤치마크 결과가
   **When** p50 < 15ms, p95 < 50ms이면
   **Then** PASS로 표시된다
   **And** 그렇지 않으면 WARN으로 표시된다 (실패 아님)

## Important Notes

- **로컬 실행 전용** - CI 게이트로 사용하지 않음
- 네트워크 환경에 따라 결과 가변
- 결과는 참고용 (CI 블로킹 아님)

## Tasks / Subtasks

- [ ] Task 1: 벤치마크 스크립트 생성 (AC: #1)
  - [ ] 1.1 apps/cad-mcp/scripts/benchmark.ts 생성
  - [ ] 1.2 WebSocket 연결 로직
  - [ ] 1.3 ping/pong 왕복 시간 측정
  - [ ] 1.4 100회 반복 루프

- [ ] Task 2: 통계 계산 (AC: #1, #2)
  - [ ] 2.1 RTT 배열 수집
  - [ ] 2.2 p50 (중앙값) 계산
  - [ ] 2.3 p95 (95번째 백분위수) 계산
  - [ ] 2.4 max 값 계산
  - [ ] 2.5 min, avg 추가 지표

- [ ] Task 3: 결과 출력 (AC: #1, #2)
  - [ ] 3.1 테이블 형식 출력
  - [ ] 3.2 PASS/WARN 판정 로직
  - [ ] 3.3 색상 출력 (green/yellow)
  - [ ] 3.4 JSON 출력 옵션 (--json)

- [ ] Task 4: package.json 스크립트 추가 (AC: #1)
  - [ ] 4.1 apps/cad-mcp/package.json에 benchmark 스크립트 추가
  - [ ] 4.2 루트 package.json에서도 실행 가능하게

- [ ] Task 5: 문서화 (AC: #1, #2)
  - [ ] 5.1 벤치마크 실행 방법 README 추가
  - [ ] 5.2 결과 해석 가이드
  - [ ] 5.3 성능 최적화 팁

## Dev Notes

### Architecture Compliance

**Source:** [docs/architecture.md NFR21]

| 지표 | 목표 | 비고 |
|------|------|------|
| RTT p50 | < 15ms | 중앙값 |
| RTT p95 | < 50ms | 95번째 백분위수 |

**Note:** 파일 폴링(500ms) 대비 30배 이상 빠른 성능 목표.

### Technical Requirements

**벤치마크 스크립트:**

```typescript
// apps/cad-mcp/scripts/benchmark.ts
import WebSocket from 'ws';

const WS_URL = 'ws://127.0.0.1:3001';
const ITERATIONS = 100;

interface BenchmarkResult {
  p50: number;
  p95: number;
  max: number;
  min: number;
  avg: number;
  pass: boolean;
}

async function runBenchmark(): Promise<BenchmarkResult> {
  const ws = new WebSocket(WS_URL);
  const rtts: number[] = [];

  await new Promise<void>((resolve) => ws.on('open', resolve));

  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();

    ws.send(JSON.stringify({
      type: 'ping',
      data: {},
      timestamp: Date.now(),
    }));

    await new Promise<void>((resolve) => {
      ws.once('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'pong') {
          const rtt = performance.now() - start;
          rtts.push(rtt);
          resolve();
        }
      });
    });
  }

  ws.close();

  // 정렬
  rtts.sort((a, b) => a - b);

  const result: BenchmarkResult = {
    p50: rtts[Math.floor(ITERATIONS * 0.5)],
    p95: rtts[Math.floor(ITERATIONS * 0.95)],
    max: rtts[ITERATIONS - 1],
    min: rtts[0],
    avg: rtts.reduce((a, b) => a + b, 0) / ITERATIONS,
    pass: false,
  };

  result.pass = result.p50 < 15 && result.p95 < 50;

  return result;
}

async function main() {
  console.log('WebSocket Benchmark (100 iterations)');
  console.log('=====================================\n');

  const result = await runBenchmark();

  console.log('Results:');
  console.log(`  p50:  ${result.p50.toFixed(2)}ms ${result.p50 < 15 ? '✓' : '⚠'}`);
  console.log(`  p95:  ${result.p95.toFixed(2)}ms ${result.p95 < 50 ? '✓' : '⚠'}`);
  console.log(`  max:  ${result.max.toFixed(2)}ms`);
  console.log(`  min:  ${result.min.toFixed(2)}ms`);
  console.log(`  avg:  ${result.avg.toFixed(2)}ms\n`);

  const status = result.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[33mWARN\x1b[0m';
  console.log(`Status: ${status}`);

  if (!result.pass) {
    console.log('\nNote: 성능 목표 미달. 네트워크 환경 확인 필요.');
  }
}

main().catch(console.error);
```

**package.json 스크립트:**

```json
{
  "scripts": {
    "benchmark": "tsx scripts/benchmark.ts"
  }
}
```

### File Structure

```
apps/cad-mcp/
├── scripts/
│   └── benchmark.ts    # 벤치마크 스크립트 (이 스토리)
└── package.json        # benchmark 스크립트 추가
```

### Dependencies

- **선행 스토리**: Story 9.3 (WebSocket 서버 - ping/pong)
- **후행 스토리**: Story 9.10 (Electron 정리 - Epic 마무리)

### 실행 방법

```bash
# 1. MCP 서버 시작 (별도 터미널)
cd apps/cad-mcp && pnpm start

# 2. 벤치마크 실행
cd apps/cad-mcp && pnpm run benchmark

# 또는 루트에서
pnpm --filter @ai-native-cad/mcp benchmark
```

### 예상 출력

```
WebSocket Benchmark (100 iterations)
=====================================

Results:
  p50:  3.45ms ✓
  p95:  8.23ms ✓
  max:  15.67ms
  min:  1.23ms
  avg:  4.12ms

Status: PASS
```

### CI에서 사용하지 않는 이유

| 이유 | 설명 |
|------|------|
| 환경 의존성 | CI 서버 네트워크/부하에 따라 결과 가변 |
| 비결정적 | 동일 코드도 실행마다 다른 결과 |
| 개발 도구 | 로컬에서 성능 검증 용도로만 사용 |

### Potential Risks

| 위험 | 완화 전략 |
|------|----------|
| MCP 서버 미실행 | 연결 실패 시 명확한 에러 메시지 |
| 타임아웃 | 5초 타임아웃 후 종료 |
| 비정상 결과 | 이상치(outlier) 제외 옵션 |

### References

- [Source: docs/architecture.md NFR21] - 성능 요구사항
- [Source: docs/epics.md#Story-9.9] - Story 정의 및 AC

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List

