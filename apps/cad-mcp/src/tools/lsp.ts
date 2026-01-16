/**
 * lsp 도구 - 코드 탐색
 *
 * Story 10.5: LSP 패턴 준수
 * - domains: built-in 함수 도메인 목록
 * - describe: 도메인별 함수 시그니처
 * - schema: 단일 함수 상세
 * - symbols: 모듈 심볼 추출 (class, function, const)
 */

import { existsSync, readFileSync } from 'fs';
import { DOMAINS, FUNCTION_SIGNATURES, type DomainName } from '../schema.js';
import { getFilePath, isValidFileName } from '../utils/paths.js';

export interface LspInput {
  operation: 'domains' | 'describe' | 'schema' | 'symbols';
  domain?: string;
  name?: string;
  file?: string;
}

export interface FunctionInfo {
  name: string;
  signature: string;
  description: string;
  example?: string;
}

export interface SymbolInfo {
  name: string;
  kind: 'class' | 'function' | 'const' | 'let' | 'var';
  signature?: string;
  methods?: string[];
}

export interface LspOutput {
  success: boolean;
  data: {
    domains?: string[];
    functions?: FunctionInfo[];
    schema?: FunctionInfo;
    symbols?: SymbolInfo[];
  };
  error?: string;
}

/**
 * ReDoS 방지: 코드 길이 제한 (100KB)
 * CAD 모듈은 소규모이므로 충분한 크기
 */
const MAX_CODE_LENGTH = 100 * 1024;

/**
 * Identifier pattern supporting Unicode (including Korean)
 * Note: 단순 패턴으로 ReDoS 위험 최소화
 */
const ID_PATTERN = '[a-zA-Z_$\\u3131-\\uD79D][a-zA-Z0-9_$\\u3131-\\uD79D]*';

/**
 * Find matching brace end index (brace counting)
 */
function findMatchingBrace(code: string, startIndex: number): number {
  let braceCount = 0;
  let foundStart = false;

  for (let i = startIndex; i < code.length; i++) {
    if (code[i] === '{') {
      braceCount++;
      foundStart = true;
    } else if (code[i] === '}') {
      braceCount--;
      if (foundStart && braceCount === 0) {
        return i;
      }
    }
  }
  return startIndex;
}

/**
 * Extract class symbols from code
 */
function extractClasses(code: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const classRegex = new RegExp(`class\\s+(${ID_PATTERN})(?:\\s+extends\\s+${ID_PATTERN})?\\s*\\{`, 'g');
  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(code)) !== null) {
    const className = match[1];
    const classEndIndex = findMatchingBrace(code, match.index);
    const classBody = code.substring(match.index, classEndIndex + 1);

    // Extract constructor signature (simple pattern)
    const constructorMatch = classBody.match(/constructor\s*\(([^)]*)\)/);
    const constructorSignature = constructorMatch
      ? `constructor(${constructorMatch[1]})`
      : undefined;

    // Extract methods (simple identifier before parentheses)
    const methods: string[] = [];
    const methodRegex = new RegExp(`(${ID_PATTERN})\\s*\\([^)]*\\)\\s*\\{`, 'g');
    let methodMatch: RegExpExecArray | null;

    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const methodName = methodMatch[1];
      if (methodName !== 'constructor' && methodName !== className) {
        methods.push(methodName);
      }
    }

    symbols.push({
      name: className,
      kind: 'class',
      signature: constructorSignature,
      methods: methods.length > 0 ? methods : undefined,
    });
  }

  return symbols;
}

/**
 * Extract function declarations from code
 */
function extractFunctions(code: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const functionRegex = new RegExp(`(?:^|[^.])function\\s+(${ID_PATTERN})\\s*\\(([^)]*)\\)`, 'gm');
  let match: RegExpExecArray | null;

  while ((match = functionRegex.exec(code)) !== null) {
    symbols.push({
      name: match[1],
      kind: 'function',
      signature: `function ${match[1]}(${match[2]})`,
    });
  }

  return symbols;
}

/**
 * Extract arrow functions from code
 */
function extractArrowFunctions(code: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const arrowFnRegex = new RegExp(`const\\s+(${ID_PATTERN})\\s*=\\s*(?:\\(([^)]*)\\)|(${ID_PATTERN}))\\s*=>`, 'g');
  let match: RegExpExecArray | null;

  while ((match = arrowFnRegex.exec(code)) !== null) {
    symbols.push({
      name: match[1],
      kind: 'function',
      signature: `const ${match[1]} = (${match[2] || match[3] || ''}) =>`,
    });
  }

  return symbols;
}

/**
 * Extract variable declarations from code
 */
function extractVariables(code: string, existingNames: Set<string>): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  // 단순화된 패턴: [^;]+ 대신 제한된 문자 클래스 사용 (ReDoS 방지)
  const varRegex = new RegExp(`(const|let|var)\\s+(${ID_PATTERN})\\s*=`, 'g');
  let match: RegExpExecArray | null;

  while ((match = varRegex.exec(code)) !== null) {
    const varKind = match[1] as 'const' | 'let' | 'var';
    const varName = match[2];

    // Skip if already captured (class, function, arrow function)
    if (existingNames.has(varName)) {
      continue;
    }

    // Check what follows the = sign
    const afterEquals = code.substring(match.index + match[0].length, match.index + match[0].length + 20);

    // Skip arrow functions and function expressions
    if (afterEquals.includes('=>') || afterEquals.trim().startsWith('function')) {
      continue;
    }

    existingNames.add(varName);
    symbols.push({
      name: varName,
      kind: varKind,
    });
  }

  return symbols;
}

/**
 * Extract symbols from JavaScript code
 *
 * Note: ReDoS 방지를 위해 코드 길이 제한 및 단순화된 정규식 사용
 */
function extractSymbols(code: string): SymbolInfo[] {
  // ReDoS 방지: 코드 길이 제한
  if (code.length > MAX_CODE_LENGTH) {
    code = code.substring(0, MAX_CODE_LENGTH);
  }

  const symbols: SymbolInfo[] = [];
  const existingNames = new Set<string>();

  // 1. Extract classes
  const classes = extractClasses(code);
  classes.forEach(s => {
    symbols.push(s);
    existingNames.add(s.name);
  });

  // 2. Extract standalone functions
  const functions = extractFunctions(code);
  functions.forEach(s => {
    symbols.push(s);
    existingNames.add(s.name);
  });

  // 3. Extract arrow functions
  const arrowFns = extractArrowFunctions(code);
  arrowFns.forEach(s => {
    symbols.push(s);
    existingNames.add(s.name);
  });

  // 4. Extract variables (excluding already captured)
  const variables = extractVariables(code, existingNames);
  symbols.push(...variables);

  return symbols;
}

/**
 * Handle lsp tool operations
 */
export function handleLsp(input: LspInput): LspOutput {
  try {
    const { operation, domain, name, file } = input;

    // Validate operation
    if (!operation) {
      return {
        success: false,
        data: {},
        error: 'operation parameter is required',
      };
    }

    switch (operation) {
      case 'domains': {
        const domainNames = Object.keys(DOMAINS) as DomainName[];
        return {
          success: true,
          data: {
            domains: domainNames,
          },
        };
      }

      case 'describe': {
        if (!domain) {
          return {
            success: false,
            data: {},
            error: 'domain parameter is required for describe operation',
          };
        }

        if (!(domain in DOMAINS)) {
          return {
            success: false,
            data: {},
            error: `Unknown domain: ${domain}`,
          };
        }

        const domainKey = domain as DomainName;
        const functionNames = DOMAINS[domainKey];
        const functions: FunctionInfo[] = functionNames.map((fnName) => {
          const sig = FUNCTION_SIGNATURES[fnName];
          return {
            name: fnName,
            signature: sig?.signature || fnName,
            description: sig?.description || '',
            example: sig?.example,
          };
        });

        return {
          success: true,
          data: {
            functions,
          },
        };
      }

      case 'schema': {
        if (!name) {
          return {
            success: false,
            data: {},
            error: 'name parameter is required for schema operation',
          };
        }

        const sig = FUNCTION_SIGNATURES[name];
        if (!sig) {
          return {
            success: false,
            data: {},
            error: `Unknown function: ${name}`,
          };
        }

        return {
          success: true,
          data: {
            schema: {
              name,
              signature: sig.signature,
              description: sig.description,
              example: sig.example,
            },
          },
        };
      }

      case 'symbols': {
        if (!file) {
          return {
            success: false,
            data: {},
            error: 'file parameter is required for symbols operation',
          };
        }

        // Path Traversal 방지: 파일명 검증
        if (!isValidFileName(file)) {
          return {
            success: false,
            data: {},
            error: `Invalid file name: ${file}. Only alphanumeric, underscore, and hyphen allowed.`,
          };
        }

        const filePath = getFilePath(file);

        if (!existsSync(filePath)) {
          return {
            success: false,
            data: {},
            error: `File not found: ${file}`,
          };
        }

        const code = readFileSync(filePath, 'utf-8');
        const symbols = extractSymbols(code);

        return {
          success: true,
          data: {
            symbols,
          },
        };
      }

      default:
        return {
          success: false,
          data: {},
          error: `Unknown operation: ${operation}`,
        };
    }
  } catch (e) {
    return {
      success: false,
      data: {},
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
