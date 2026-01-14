/**
 * WebSocket Performance Benchmark
 *
 * Measures RTT (Round-Trip Time) for ping/pong messages.
 * Target: p50 < 15ms, p95 < 50ms (NFR21)
 *
 * Usage:
 *   pnpm --filter @ai-native-cad/mcp benchmark
 *   pnpm --filter @ai-native-cad/mcp benchmark --json
 */

import WebSocket from 'ws'

const WS_URL = 'ws://127.0.0.1:3001'
const ITERATIONS = 100
const CONNECT_TIMEOUT = 5000
const MESSAGE_TIMEOUT = 5000

// NFR21 Targets
const P50_TARGET = 15
const P95_TARGET = 50

interface BenchmarkResult {
  p50: number
  p95: number
  max: number
  min: number
  avg: number
  iterations: number
  pass: boolean
}

function percentile(arr: number[], p: number): number {
  const index = Math.ceil((p / 100) * arr.length) - 1
  return arr[Math.max(0, index)]
}

async function runBenchmark(): Promise<BenchmarkResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    const rtts: number[] = []
    let iteration = 0
    let startTime = 0

    const connectTimeout = setTimeout(() => {
      ws.close()
      reject(new Error(`Connection timeout (${CONNECT_TIMEOUT}ms)`))
    }, CONNECT_TIMEOUT)

    ws.on('error', (err) => {
      clearTimeout(connectTimeout)
      reject(new Error(`WebSocket error: ${err.message}`))
    })

    ws.on('open', async () => {
      clearTimeout(connectTimeout)

      // Wait for initial connection message from server
      await new Promise<void>((res) => {
        ws.once('message', (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'connection') {
            res()
          }
        })
      })

      const runIteration = () => {
        if (iteration >= ITERATIONS) {
          ws.close()

          // Sort for percentile calculation
          rtts.sort((a, b) => a - b)

          const result: BenchmarkResult = {
            p50: percentile(rtts, 50),
            p95: percentile(rtts, 95),
            max: rtts[rtts.length - 1],
            min: rtts[0],
            avg: rtts.reduce((a, b) => a + b, 0) / rtts.length,
            iterations: ITERATIONS,
            pass: false,
          }

          result.pass = result.p50 < P50_TARGET && result.p95 < P95_TARGET
          resolve(result)
          return
        }

        startTime = performance.now()

        const messageTimeout = setTimeout(() => {
          ws.close()
          reject(new Error(`Message timeout at iteration ${iteration}`))
        }, MESSAGE_TIMEOUT)

        ws.once('message', (data) => {
          clearTimeout(messageTimeout)
          try {
            const msg = JSON.parse(data.toString())
            if (msg.type === 'pong') {
              const rtt = performance.now() - startTime
              rtts.push(rtt)
              iteration++
              runIteration()
            }
          } catch {
            // Ignore parse errors, wait for next message
          }
        })

        ws.send(
          JSON.stringify({
            type: 'ping',
            data: {},
            timestamp: Date.now(),
          })
        )
      }

      runIteration()
    })
  })
}

function formatMs(ms: number): string {
  return ms.toFixed(2).padStart(8) + 'ms'
}

function printResult(result: BenchmarkResult, jsonOutput: boolean) {
  if (jsonOutput) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2))
    return
  }

  // eslint-disable-next-line no-console
  console.log(`
WebSocket Benchmark (${result.iterations} iterations)
=====================================

Results:
  p50: ${formatMs(result.p50)} ${result.p50 < P50_TARGET ? '\x1b[32m✓\x1b[0m' : '\x1b[33m⚠\x1b[0m'} (target: <${P50_TARGET}ms)
  p95: ${formatMs(result.p95)} ${result.p95 < P95_TARGET ? '\x1b[32m✓\x1b[0m' : '\x1b[33m⚠\x1b[0m'} (target: <${P95_TARGET}ms)
  max: ${formatMs(result.max)}
  min: ${formatMs(result.min)}
  avg: ${formatMs(result.avg)}

Status: ${result.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[33mWARN\x1b[0m'}`)

  if (!result.pass) {
    // eslint-disable-next-line no-console
    console.log('\nNote: 성능 목표 미달. 네트워크 환경 확인 필요.')
  }
}

async function main() {
  const jsonOutput = process.argv.includes('--json')

  try {
    const result = await runBenchmark()
    printResult(result, jsonOutput)
    process.exit(result.pass ? 0 : 0) // Always exit 0 (WARN, not FAIL)
  } catch (err) {
    if (!jsonOutput) {
      // eslint-disable-next-line no-console
      console.error('\x1b[31mError:\x1b[0m', (err as Error).message)
      // eslint-disable-next-line no-console
      console.error('\nMake sure the MCP server is running:')
      // eslint-disable-next-line no-console
      console.error('  pnpm --filter @ai-native-cad/mcp start')
    } else {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ error: (err as Error).message }))
    }
    process.exit(1)
  }
}

main()
