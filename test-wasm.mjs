// test-wasm.mjs
// WASM 모듈 통합 테스트 - AC1, AC2, AC3 검증

const NFR2_LATENCY_LIMIT_MS = 1.0;
const WARMUP_RUNS = 3;
const BENCHMARK_RUNS = 10;

let greet;

// AC1: WASM 모듈 로드 테스트
try {
    const module = await import('./cad-engine/pkg/cad_engine.js');
    greet = module.greet;
    console.log("✅ AC1: WASM 모듈 로드 성공");
} catch (error) {
    console.error("❌ AC1 FAILED: WASM 모듈 로드 실패");
    console.error("해결방법: npm run build 먼저 실행하세요");
    console.error(`상세: ${error.message}`);
    process.exit(1);
}

// AC2: 함수 호출 및 NFR2 지연 시간 검증
function runLatencyBenchmark() {
    // Warmup runs (JIT 최적화)
    for (let i = 0; i < WARMUP_RUNS; i++) {
        greet("warmup");
    }

    // Benchmark runs
    const latencies = [];
    for (let i = 0; i < BENCHMARK_RUNS; i++) {
        const start = performance.now();
        greet("CAD");
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);

    return { avgLatency, maxLatency, minLatency, latencies };
}

const benchmark = runLatencyBenchmark();
console.log(`   Average: ${benchmark.avgLatency.toFixed(3)}ms`);
console.log(`   Min: ${benchmark.minLatency.toFixed(3)}ms, Max: ${benchmark.maxLatency.toFixed(3)}ms`);

// NFR2 검증: 평균 AND 최대값 모두 1ms 미만이어야 함
if (benchmark.avgLatency > NFR2_LATENCY_LIMIT_MS) {
    console.error(`❌ AC2 FAILED: 평균 지연 시간 ${benchmark.avgLatency.toFixed(3)}ms > ${NFR2_LATENCY_LIMIT_MS}ms 목표 초과`);
    process.exit(1);
}
if (benchmark.maxLatency > NFR2_LATENCY_LIMIT_MS) {
    console.error(`❌ AC2 FAILED: 최대 지연 시간 ${benchmark.maxLatency.toFixed(3)}ms > ${NFR2_LATENCY_LIMIT_MS}ms 목표 초과`);
    process.exit(1);
}
console.log(`✅ AC2: 호출 지연 시간 avg=${benchmark.avgLatency.toFixed(3)}ms, max=${benchmark.maxLatency.toFixed(3)}ms < ${NFR2_LATENCY_LIMIT_MS}ms 목표 달성`);

// AC3: 함수 반환값 검증 (assert)
function assertEqual(actual, expected, testName) {
    if (actual !== expected) {
        console.error(`❌ ${testName} FAILED: expected "${expected}", got "${actual}"`);
        process.exit(1);
    }
    console.log(`✅ ${testName}: passed`);
}

assertEqual(greet("World"), "Hello, World!", "AC3-1: greet('World')");
assertEqual(greet("CAD"), "Hello, CAD!", "AC3-2: greet('CAD')");
assertEqual(greet(""), "Hello, !", "AC3-3: greet('') 빈 문자열");

// 엣지 케이스 테스트
assertEqual(greet("한글"), "Hello, 한글!", "AC3-4: greet('한글') 유니코드");
assertEqual(greet("A".repeat(100)), `Hello, ${"A".repeat(100)}!`, "AC3-5: greet(긴 문자열)");

console.log("\n🎉 All tests passed!");
