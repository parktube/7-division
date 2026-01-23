#!/usr/bin/env node

/**
 * Postinstall script for @ai-native-cad/mcp
 *
 * Checks native module dependencies and provides helpful error messages
 * if build tools are missing on Windows/Mac.
 */

import { platform } from 'os';

const PLATFORM_INSTRUCTIONS = {
  win32: `
    Windows users need Visual Studio Build Tools:
    1. Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
    2. Install "Desktop development with C++" workload
    3. Restart terminal and run: npm rebuild better-sqlite3
  `,
  darwin: `
    Mac users need Xcode Command Line Tools:
    1. Run: xcode-select --install
    2. After installation: npm rebuild better-sqlite3
  `,
  linux: `
    Linux users need build-essential:
    - Ubuntu/Debian: sudo apt-get install -y python3 build-essential
    - Fedora: sudo dnf install -y python3 gcc-c++ make
    - Then run: npm rebuild better-sqlite3
  `,
};

/**
 * Safely extract error message from unknown error type
 */
function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function checkNativeModules() {
  const issues = [];

  // Check better-sqlite3
  try {
    await import('better-sqlite3');
  } catch (error) {
    issues.push({
      module: 'better-sqlite3',
      error: getErrorMessage(error),
    });
  }

  // Check sqlite-vec
  try {
    await import('sqlite-vec');
  } catch (error) {
    // sqlite-vec may fail to load extension, which is different from missing module
    const errorMsg = getErrorMessage(error);
    if (errorMsg.includes('Cannot find module')) {
      issues.push({
        module: 'sqlite-vec',
        error: errorMsg,
      });
    }
  }

  return issues;
}

async function main() {
  const issues = await checkNativeModules();

  if (issues.length === 0) {
    console.log('✅ @ai-native-cad/mcp: All native modules installed successfully');
    return;
  }

  const os = platform();
  console.error('\n⚠️  @ai-native-cad/mcp: Native module installation issues detected\n');

  // Classify issues as critical or non-critical
  const criticalIssues = [];
  const nonCriticalIssues = [];

  for (const issue of issues) {
    // better-sqlite3 is critical - MAMA features won't work without it
    if (issue.module === 'better-sqlite3') {
      criticalIssues.push(issue);
    } else {
      nonCriticalIssues.push(issue);
    }
  }

  // Output critical issues first
  for (const issue of criticalIssues) {
    console.error(`  ❌ [CRITICAL] ${issue.module}: ${issue.error}`);
  }
  // Then non-critical issues
  for (const issue of nonCriticalIssues) {
    console.error(`  ⚠️  [WARNING] ${issue.module}: ${issue.error}`);
  }

  const instructions = PLATFORM_INSTRUCTIONS[os] || PLATFORM_INSTRUCTIONS.linux;
  console.error('\n📋 To fix:');
  console.error(instructions);

  // Fail on critical issues, warn on non-critical
  if (criticalIssues.length > 0) {
    console.error('\n❌ Installation failed due to critical native module build errors.');
    console.error('   Please install build tools and run: npm rebuild');
    process.exit(1);
  }

  // Non-critical issues - log and continue
  console.error('\n💡 Non-critical issues detected. MCP server may still work.');
}

main().catch((error) => {
  console.error('Postinstall script error:', error);
  process.exit(1);
});
