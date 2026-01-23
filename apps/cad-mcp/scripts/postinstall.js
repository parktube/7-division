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

async function checkNativeModules() {
  const issues = [];

  // Check better-sqlite3
  try {
    await import('better-sqlite3');
  } catch (error) {
    issues.push({
      module: 'better-sqlite3',
      error: error.message,
    });
  }

  // Check sqlite-vec
  try {
    await import('sqlite-vec');
  } catch (error) {
    // sqlite-vec may fail to load extension, which is different from missing module
    if (error.message.includes('Cannot find module')) {
      issues.push({
        module: 'sqlite-vec',
        error: error.message,
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

  for (const issue of issues) {
    console.error(`  ❌ ${issue.module}: ${issue.error}`);
  }

  const instructions = PLATFORM_INSTRUCTIONS[os] || PLATFORM_INSTRUCTIONS.linux;
  console.error('\n📋 To fix:');
  console.error(instructions);

  // Don't fail the install - user can still try to run and see specific errors
  console.error('\n💡 You can try running the MCP server anyway - it may work if prebuilds were downloaded.');
}

main().catch(console.error);
