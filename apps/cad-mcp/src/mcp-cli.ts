#!/usr/bin/env node
/**
 * MCP Server CLI Entry Point
 *
 * Usage:
 *   npx @ai-native-cad/mcp start
 */

import { runMCPServer } from './mcp-server.js'

const command = process.argv[2]

if (command === 'start') {
  runMCPServer()
} else {
  // eslint-disable-next-line no-console
  console.log(`AI-Native CAD MCP Server

Usage:
  npx @ai-native-cad/mcp start   Start MCP server (stdio + WebSocket)

WebSocket server runs on ws://127.0.0.1:3001`)
  process.exit(0)
}
