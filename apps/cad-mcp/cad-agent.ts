#!/usr/bin/env npx tsx
/**
 * CAD Agent CLI
 *
 * Claude Code나 다른 LLM이 Bash를 통해 호출할 수 있는 CLI
 *
 * Usage:
 *   npx tsx cad-agent.ts "원을 그려줘"
 *   npx tsx cad-agent.ts --scene my-scene "사각형 추가해줘"
 */

import '../../../cad-engine/pkg/cad_engine.js';
import { CADExecutor } from './src/executor.js';
import { AnthropicProvider } from './src/providers/anthropic.js';
import { runAgentLoop } from './src/runtime.js';
import { SCENE_FILE } from './src/run-cad-code/constants.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';

function parseArgs(args: string[]): { sceneName: string; prompt: string; domains: string[] } {
  let sceneName = 'cad-scene';
  let domains: string[] = [];
  const promptParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scene' && args[i + 1]) {
      sceneName = args[i + 1];
      i++;
    } else if (args[i] === '--domains' && args[i + 1]) {
      domains = args[i + 1].split(',');
      i++;
    } else if (!args[i].startsWith('--')) {
      promptParts.push(args[i]);
    }
  }

  return {
    sceneName,
    prompt: promptParts.join(' '),
    domains: domains.length > 0 ? domains : ['primitives', 'style', 'transforms', 'query', 'export'],
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
CAD Agent CLI - LLM이 직접 CAD 도구를 사용

Usage:
  npx tsx cad-agent.ts "<prompt>"
  npx tsx cad-agent.ts --scene <name> "<prompt>"
  npx tsx cad-agent.ts --domains primitives,style "<prompt>"

Options:
  --scene <name>    Scene 이름 (기본: cad-scene)
  --domains <list>  사용할 도메인 (기본: primitives,style,transforms,query,export)
  --help            도움말

Examples:
  npx tsx cad-agent.ts "빨간 원을 그려줘"
  npx tsx cad-agent.ts --scene house "8x4미터 집을 그려줘"
  npx tsx cad-agent.ts "list_entities로 현재 엔티티 목록 보여줘"

Environment:
  ANTHROPIC_API_KEY  Anthropic API 키 (필수)
`);
    process.exit(0);
  }

  const { sceneName, prompt, domains } = parseArgs(args);

  if (!prompt) {
    console.error('Error: prompt가 필요합니다.');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  // Provider와 Executor 생성
  const provider = new AnthropicProvider();
  const executor = CADExecutor.create(sceneName);

  // 기존 scene 로드 (있으면)
  if (existsSync(SCENE_FILE)) {
    try {
      const existingScene = readFileSync(SCENE_FILE, 'utf-8');
      const parsed = JSON.parse(existingScene);
      if (parsed.entities && Array.isArray(parsed.entities)) {
        console.log(`📂 기존 scene 로드: ${parsed.entities.length}개 엔티티`);
        // TODO: 기존 엔티티 복원 (현재는 새로 시작)
      }
    } catch {
      // 무시 - 새로 시작
    }
  }

  console.log(`🎨 Scene: ${sceneName}`);
  console.log(`📋 Domains: ${domains.join(', ')}`);
  console.log(`💬 Prompt: ${prompt}\n`);

  try {
    // Agent Loop 실행
    const result = await runAgentLoop(provider, executor, prompt, {
      domains: domains as any,
      maxIterations: 20,
    });

    console.log('\n✅ Result:');
    console.log(result);

    // Scene 저장
    const jsonResult = executor.exec('export_json', {});
    if (jsonResult.success && jsonResult.data) {
      writeFileSync(SCENE_FILE, jsonResult.data);
      console.log(`\n💾 Saved: ${SCENE_FILE}`);
    }

    // Scene 정보 출력
    const info = executor.exec('get_scene_info', {});
    if (info.success) {
      console.log(`📊 Scene Info: ${JSON.stringify(info.data)}`);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    executor.free();
  }
}

main();
