/**
 * CAD Tools - LLM-agnostic CAD tool definitions and executor
 */

// Schema
export { CAD_TOOLS, DOMAINS, type ToolSchema, type ParameterSchema, type DomainName, type ToolName } from './schema.js';

// Discovery
export { listDomains, listTools, getTool, getToolsForDomains, getAllTools } from './discovery.js';

// Executor
export { CADExecutor, type ToolResult } from './executor.js';

// Runtime
export { runAgentLoop, DEFAULT_DOMAINS, DEFAULT_MAX_ITERATIONS, type AgentOptions } from './runtime.js';

// Provider types
export type { LLMProvider, ToolCall } from './providers/types.js';

// Providers
export { AnthropicProvider, type AnthropicProviderOptions } from './providers/anthropic.js';
