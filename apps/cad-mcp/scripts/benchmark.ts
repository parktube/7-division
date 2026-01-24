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

// Port discovery: try ports 3002, 3001, 3003 (matches CADWebSocketServer behavior)
// 3002 first: Windows often has svchost on 3001
const WS_PORTS = [3002, 3001, 3003]
const WS_HOST = process.env.WS_HOST ?? '127.0.0.1'
const ITERATIONS = 100
const CONNECT_TIMEOUT = 5000
const MESSAGE_TIMEOUT = 5000
const CONNECTION_MSG_TIMEOUT = 3000

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

// Try to connect to any available port
async function connectToServer(): Promise<WebSocket> {
  for (const port of WS_PORTS) {
    try {
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(`ws://${WS_HOST}:${port}`)
        const timeout = setTimeout(() => {
          socket.close()
          reject(new Error('timeout'))
        }, CONNECT_TIMEOUT)

        socket.on('error', () => {
          clearTimeout(timeout)
          reject(new Error('connection failed'))
        })
        socket.on('open', () => {
          clearTimeout(timeout)
          resolve(socket)
        })
      })
      return ws
    } catch {
      continue // Try next port
    }
  }
  throw new Error(`Could not connect to WebSocket server on ports ${WS_PORTS.join(', ')}`)
}

async function runBenchmark(): Promise<BenchmarkResult> {
  const ws = await connectToServer()
  const rtts: number[] = []
  let iteration = 0
  let startTime = 0

  return new Promise((resolve, reject) => {
    ws.on('error', (err) => {
      reject(new Error(`WebSocket error: ${err.message}`))
    })

    // Wait for initial connection message from server with timeout
    const connectionMsgTimeout = setTimeout(() => {
      ws.close()
      reject(new Error(`Connection message timeout (${CONNECTION_MSG_TIMEOUT}ms)`))
    }, CONNECTION_MSG_TIMEOUT)

    ws.once('message', (data) => {
      clearTimeout(connectionMsgTimeout)
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type !== 'connection') {
          reject(new Error(`Expected connection message, got: ${msg.type}`))
          return
        }
      } catch {
        reject(new Error('Failed to parse connection message'))
        return
      }

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
          } catch (e) {
            // Log parse errors for debugging protocol issues
            if (process.env.DEBUG) {
              // eslint-disable-next-line no-console
              console.error('[benchmark] Parse error:', e)
            }
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
    process.exit(0) // Always exit 0 (WARN, not FAIL)
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
