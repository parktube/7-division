/**
 * WebMCP Types
 *
 * Chrome WebMCP Early Preview 도구 인터페이스 타입 정의
 */

import { z } from 'zod'

/**
 * Tool input payload (from AI agent)
 */
export interface ToolPayload<T = unknown> {
  input: T
}

/**
 * Tool execution result - success
 */
export interface WebMcpResultOk<T> {
  ok: true
  data: T
}

/**
 * Tool execution result - error
 */
export interface WebMcpResultErr {
  ok: false
  error: string
}

/**
 * Tool execution result union type
 */
export type WebMcpResult<T> = WebMcpResultOk<T> | WebMcpResultErr

/**
 * Helper: Create success result
 */
export function ok<T>(data: T): WebMcpResultOk<T> {
  return { ok: true, data }
}

/**
 * Helper: Create error result
 */
export function err(error: string): WebMcpResultErr {
  return { ok: false, error }
}

/**
 * Validate input with Zod schema and return result
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  payload: ToolPayload
): WebMcpResult<T> {
  const result = schema.safeParse(payload.input)
  if (!result.success) {
    return err(`Invalid input: ${result.error.message}`)
  }
  return ok(result.data)
}

/**
 * Tool definition for registration
 */
export interface WebMcpToolDefinition {
  name: string
  description: string
  inputSchema?: Record<string, unknown>
  execute: (payload: ToolPayload) => Promise<WebMcpResult<unknown>>
}
