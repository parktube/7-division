#!/usr/bin/env node
/**
 * MCP Server CLI Entry Point
 *
 * Usage:
 *   npx @ai-native-cad/mcp start
 *
 * Note: --help/--version 옵션 불필요 (MCP는 stdio 프로토콜 사용, CLI 도구 아님)
 */

import { runMCPServer } from './mcp-server.js'

const command = process.argv[2]

if (command === 'start') {
  runMCPServer().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('MCP server failed:', err)
    process.exit(1)
  })
} else {
  // eslint-disable-next-line no-console
  console.log('Usage: npx @ai-native-cad/mcp start')
  process.exit(command ? 1 : 0)
}
