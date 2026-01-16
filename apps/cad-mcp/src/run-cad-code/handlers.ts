/**
 * run_cad_code 핸들러
 * 새로운 기능들을 위한 핸들러 모음
 */
import { existsSync, readFileSync } from 'node:fs';
import {
  getModuleList,
  getModulePath,
  readMainCode,
  extractClasses,
  extractFunctions,
  getCodeImports,
  countLines,
  extractLines,
} from './utils.js';

export interface RunCadCodeResult {
  handled: boolean;
  output?: string;
}

/**
 * Validate regex pattern to prevent ReDoS attacks.
 * Rejects patterns with nested quantifiers or excessive complexity.
 */
function isSafeRegexPattern(pattern: string): boolean {
  // Limit pattern length
  if (pattern.length > 100) {
    return false;
  }
  // Reject patterns with nested quantifiers (e.g., (a+)+, (a*)*b)
  // eslint-disable-next-line no-useless-escape
  const nestedQuantifiers = /(\+|\*|\?|\{[^}]+\}).*\1/;
  if (nestedQuantifiers.test(pattern)) {
    return false;
  }
  // Reject patterns with multiple adjacent quantifiers
  // eslint-disable-next-line no-useless-escape
  const adjacentQuantifiers = /(\+|\*|\?|\{[^}]+\}){2,}/;
  if (adjacentQuantifiers.test(pattern)) {
    return false;
  }
  return true;
}

/**
 * Escape special regex characters for literal string search
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * --search <pattern>: 모듈/코드 검색
 * 패턴과 일치하는 코드 라인 반환
 */
export function handleRunCadCodeSearch(pattern: string): RunCadCodeResult {
  if (!pattern) {
    return {
      handled: true,
      output: JSON.stringify({
        success: false,
        error: '검색 패턴을 지정하세요.',
        hint: 'run_cad_code --search <pattern>',
      }, null, 2),
    };
  }

  // Validate pattern to prevent ReDoS
  let regex: RegExp;
  try {
    if (!isSafeRegexPattern(pattern)) {
      // Treat as literal string search for unsafe patterns
      regex = new RegExp(escapeRegex(pattern), 'gi');
    } else {
      regex = new RegExp(pattern, 'gi');
    }
  } catch {
    // Invalid regex, fall back to literal search
    regex = new RegExp(escapeRegex(pattern), 'gi');
  }
  const results: Array<{
    file: string;
    line: number;
    content: string;
  }> = [];

  // main 검색
  const mainCode = readMainCode();
  if (mainCode) {
    const lines = mainCode.split('\n');
    lines.forEach((line, idx) => {
      if (regex.test(line)) {
        results.push({
          file: 'main',
          line: idx + 1,
          content: line.trim(),
        });
      }
      regex.lastIndex = 0; // reset for 'g' flag
    });
  }

  // 모듈 검색
  const modules = getModuleList();
  for (const mod of modules) {
    try {
      const modPath = getModulePath(mod);
      const modCode = readFileSync(modPath, 'utf-8');
      const lines = modCode.split('\n');
      lines.forEach((line, idx) => {
        if (regex.test(line)) {
          results.push({
            file: mod,
            line: idx + 1,
            content: line.trim(),
          });
        }
        regex.lastIndex = 0;
      });
    } catch {
      // Skip modules that can't be read (may have been deleted)
      continue;
    }
  }

  return {
    handled: true,
    output: JSON.stringify({
      success: true,
      pattern,
      matches: results.length,
      results: results.slice(0, 50), // 최대 50개
      hint: results.length > 50 ? `${results.length - 50}개 결과 생략됨` : undefined,
    }, null, 2),
  };
}

/**
 * --info <name>: 모듈 상세 정보
 * 클래스, 함수, import, 라인 수 등
 */
export function handleRunCadCodeInfo(target: string): RunCadCodeResult {
  if (!target) {
    return {
      handled: true,
      output: JSON.stringify({
        success: false,
        error: '파일명을 지정하세요.',
        hint: 'run_cad_code --info <name>',
      }, null, 2),
    };
  }

  let code: string;

  if (target === 'main') {
    code = readMainCode();
  } else {
    const modPath = getModulePath(target);
    if (!existsSync(modPath)) {
      return {
        handled: true,
        output: JSON.stringify({
          success: false,
          error: `'${target}' 파일을 찾을 수 없습니다.`,
          hint: `사용 가능: main, ${getModuleList().join(', ') || '(모듈 없음)'}`,
        }, null, 2),
      };
    }
    code = readFileSync(modPath, 'utf-8');
  }

  const classes = extractClasses(code);
  const functions = extractFunctions(code);
  const imports = getCodeImports(code);
  const lines = countLines(code);

  // 첫 번째 주석 블록 추출 (설명)
  let description = '';
  const docMatch = code.match(/^\/\*\*[\s\S]*?\*\//);
  if (docMatch) {
    description = docMatch[0]
      .replace(/^\/\*\*\s*/, '')
      .replace(/\s*\*\/$/, '')
      .replace(/^\s*\* ?/gm, '')
      .trim();
  }

  return {
    handled: true,
    output: JSON.stringify({
      success: true,
      file: target,
      lines,
      classes,
      functions,
      imports,
      description: description || undefined,
      hint: `run_cad_code ${target} 로 전체 코드 확인`,
    }, null, 2),
  };
}

/**
 * --lines <name> <start>-<end>: 부분 읽기
 * 특정 라인 범위만 읽기
 */
export function handleRunCadCodeLines(
  target: string,
  rangeStr: string
): RunCadCodeResult {
  if (!target || !rangeStr) {
    return {
      handled: true,
      output: JSON.stringify({
        success: false,
        error: '파일명과 라인 범위를 지정하세요.',
        hint: 'run_cad_code --lines <name> <start>-<end> 또는 --lines <name> <start>',
      }, null, 2),
    };
  }

  let code: string;
  if (target === 'main') {
    code = readMainCode();
  } else {
    const modPath = getModulePath(target);
    if (!existsSync(modPath)) {
      return {
        handled: true,
        output: JSON.stringify({
          success: false,
          error: `'${target}' 파일을 찾을 수 없습니다.`,
        }, null, 2),
      };
    }
    code = readFileSync(modPath, 'utf-8');
  }

  const totalLines = countLines(code);

  // 범위 파싱: "10-20" 또는 "10"
  let start: number;
  let end: number;

  if (rangeStr.includes('-')) {
    const [s, e] = rangeStr.split('-').map(Number);
    start = s;
    end = e;
  } else {
    start = parseInt(rangeStr, 10);
    end = Math.min(start + 20, totalLines); // 기본 20줄
  }

  if (isNaN(start) || isNaN(end)) {
    return {
      handled: true,
      output: JSON.stringify({
        success: false,
        error: '유효한 라인 범위를 지정하세요.',
        hint: 'run_cad_code --lines <name> 10-30',
      }, null, 2),
    };
  }

  const extracted = extractLines(code, start, end);

  return {
    handled: true,
    output: JSON.stringify({
      success: true,
      file: target,
      range: { start, end: Math.min(end, totalLines) },
      totalLines,
      code: extracted,
    }, null, 2),
  };
}

/**
 * --status: 현재 프로젝트 상태
 * 파일 목록, 라인 수, 마지막 수정 시간 등
 */
export function handleRunCadCodeStatus(): RunCadCodeResult {
  const modules = getModuleList();
  const mainCode = readMainCode();

  const fileStats: Array<{
    name: string;
    lines: number;
    classes: string[];
    functions: string[];
  }> = [];

  // main 통계
  if (mainCode) {
    fileStats.push({
      name: 'main',
      lines: countLines(mainCode),
      classes: extractClasses(mainCode),
      functions: extractFunctions(mainCode),
    });
  }

  // 모듈 통계
  for (const mod of modules) {
    try {
      const modPath = getModulePath(mod);
      const modCode = readFileSync(modPath, 'utf-8');
      fileStats.push({
        name: mod,
        lines: countLines(modCode),
        classes: extractClasses(modCode),
        functions: extractFunctions(modCode),
      });
    } catch {
      // Skip modules that can't be read (may have been deleted)
      continue;
    }
  }

  const totalLines = fileStats.reduce((sum, f) => sum + f.lines, 0);
  const totalClasses = fileStats.reduce((sum, f) => sum + f.classes.length, 0);
  const totalFunctions = fileStats.reduce((sum, f) => sum + f.functions.length, 0);

  return {
    handled: true,
    output: JSON.stringify({
      success: true,
      summary: {
        files: fileStats.length,
        totalLines,
        totalClasses,
        totalFunctions,
      },
      files: fileStats,
      hint: 'run_cad_code --info <name> 으로 상세 정보 확인',
    }, null, 2),
  };
}
