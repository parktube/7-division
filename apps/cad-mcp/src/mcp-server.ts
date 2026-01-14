/**
 * MCP stdio Server for Claude Code integration
 *
 * Exposes CAD tools via Model Context Protocol (JSON-RPC over stdio)
 * Broadcasts scene updates to WebSocket clients
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { CADExecutor } from './executor.js'
import { CAD_TOOLS, DOMAINS, type ToolSchema, type DomainName } from './schema.js'
import { getWSServer, startWSServer } from './ws-server.js'
import { logger } from './logger.js'
import type { Scene } from '@ai-native-cad/shared'

const MCP_SERVER_NAME = 'ai-native-cad'
const MCP_SERVER_VERSION = '0.1.0'

// Singleton executor for scene state
let executor: CADExecutor | null = null

function getExecutor(): CADExecutor {
  if (!executor) {
    executor = CADExecutor.create('mcp-scene')
  }
  return executor
}

/**
 * Convert internal tool schema to MCP format
 */
function toMCPToolSchema(tool: ToolSchema) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters.properties).map(([key, prop]) => [
          key,
          {
            type: prop.type,
            description: prop.description,
          },
        ])
      ),
      required: tool.parameters.required,
    },
  }
}

/**
 * Get all tools as MCP format
 */
function getAllMCPTools() {
  return Object.values(CAD_TOOLS).map(toMCPToolSchema)
}

/**
 * Execute a tool and broadcast results
 */
async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const exec = getExecutor()

  try {
    const result = exec.exec(name, args)

    if (result.success) {
      // Export scene and broadcast to WebSocket clients
      const sceneJson = exec.exportScene()
      const scene = JSON.parse(sceneJson) as Scene
      const wsServer = getWSServer()
      wsServer.broadcastScene(scene)

      return { success: true, result }
    } else {
      return { success: false, error: result.error || 'Unknown error' }
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { success: false, error }
  }
}

/**
 * Create and start the MCP server
 */
export async function createMCPServer(): Promise<Server> {
  // Start WebSocket server first
  const wsPort = await startWSServer()
  logger.info(`WebSocket server ready on port ${wsPort}`)

  const server = new Server(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: getAllMCPTools(),
    }
  })

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    // Special case: describe domain
    if (name === 'describe') {
      const domain = args?.domain as string
      if (domain && domain in DOMAINS) {
        const domainTools = DOMAINS[domain as DomainName]
        const toolSchemas = domainTools.map((toolName) => CAD_TOOLS[toolName])
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(toolSchemas, null, 2),
            },
          ],
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: `Unknown domain: ${domain}. Available: ${Object.keys(DOMAINS).join(', ')}`,
          },
        ],
        isError: true,
      }
    }

    // Execute CAD tool
    const result = await executeTool(name, args as Record<string, unknown>)

    if (result.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.result, null, 2),
          },
        ],
      }
    } else {
      return {
        content: [
          {
            type: 'text',
            text: result.error || 'Tool execution failed',
          },
        ],
        isError: true,
      }
    }
  })

  return server
}

/**
 * Start MCP server with stdio transport
 */
export async function startMCPServer(): Promise<void> {
  const server = await createMCPServer()
  const transport = new StdioServerTransport()

  logger.info('Starting MCP server on stdio...')

  await server.connect(transport)

  logger.info('MCP server connected')
}

/**
 * CLI entry point for MCP server
 */
export async function runMCPServer(): Promise<void> {
  try {
    await startMCPServer()
  } catch (e) {
    logger.error(`MCP server error: ${e}`)
    process.exit(1)
  }
}
