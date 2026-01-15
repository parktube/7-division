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
import { resolve } from 'path';
import { MODULES_DIR, SCENE_CODE_FILE } from '../run-cad-code/constants.js';
import { DOMAINS, FUNCTION_SIGNATURES, type DomainName } from '../schema.js';

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
 * Get file path for given file name
 */
function getFilePath(file: string): string {
  if (file === 'main') {
    return SCENE_CODE_FILE;
  }
  return resolve(MODULES_DIR, `${file}.js`);
}

/**
 * Identifier pattern supporting Unicode (including Korean)
 */
const ID_PATTERN = '[a-zA-Z_$\\u3131-\\uD79D][a-zA-Z0-9_$\\u3131-\\uD79D]*';

/**
 * Extract symbols from JavaScript code using regex
 */
function extractSymbols(code: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];

  // Extract classes (with Unicode support)
  const classRegex = new RegExp(`class\\s+(${ID_PATTERN})(?:\\s+extends\\s+${ID_PATTERN})?\\s*\\{`, 'g');
  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(code)) !== null) {
    const className = match[1];
    const classStartIndex = match.index;

    // Find the class body
    let braceCount = 0;
    let classEndIndex = classStartIndex;
    let foundStart = false;

    for (let i = classStartIndex; i < code.length; i++) {
      if (code[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (code[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          classEndIndex = i;
          break;
        }
      }
    }

    const classBody = code.substring(classStartIndex, classEndIndex + 1);

    // Extract constructor signature
    const constructorMatch = classBody.match(/constructor\s*\(([^)]*)\)/);
    const constructorSignature = constructorMatch
      ? `constructor(${constructorMatch[1]})`
      : undefined;

    // Extract methods (skip constructor)
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

  // Extract standalone functions (not inside classes)
  const functionRegex = new RegExp(`(?:^|[^.])function\\s+(${ID_PATTERN})\\s*\\(([^)]*)\\)`, 'gm');
  while ((match = functionRegex.exec(code)) !== null) {
    const fnName = match[1];
    const params = match[2];
    symbols.push({
      name: fnName,
      kind: 'function',
      signature: `function ${fnName}(${params})`,
    });
  }

  // Extract const arrow functions (top-level)
  const arrowFnRegex = new RegExp(`const\\s+(${ID_PATTERN})\\s*=\\s*(?:\\(([^)]*)\\)|(${ID_PATTERN}))\\s*=>`, 'g');
  while ((match = arrowFnRegex.exec(code)) !== null) {
    const fnName = match[1];
    const params = match[2] || match[3] || '';
    symbols.push({
      name: fnName,
      kind: 'function',
      signature: `const ${fnName} = (${params}) =>`,
    });
  }

  // Extract const/let/var variables (simple pattern - look for = followed by non-arrow content)
  // Match lines like: const NAME = value; or const NAME = { ... }
  const varRegex = new RegExp(`(const|let|var)\\s+(${ID_PATTERN})\\s*=\\s*([^;]+)`, 'g');
  while ((match = varRegex.exec(code)) !== null) {
    const varKind = match[1] as 'const' | 'let' | 'var';
    const varName = match[2];
    const valueStart = match[3].trim();

    // Skip if this is an arrow function (already captured above)
    if (valueStart.includes('=>')) {
      continue;
    }

    // Skip if this is a function expression
    if (valueStart.startsWith('function')) {
      continue;
    }

    // Check if this is already captured
    const isAlreadyCaptured = symbols.some((s) => s.name === varName);

    if (!isAlreadyCaptured) {
      symbols.push({
        name: varName,
        kind: varKind,
      });
    }
  }

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
