/**
 * Agent Runtime 검증 스크립트
 *
 * LLM이 코드 작성 없이 직접 tool_use로 CAD 도구를 사용하는지 검증
 */

import '../../../cad-engine/pkg/cad_engine.js';
import { CADExecutor } from './src/executor.js';
import { AnthropicProvider } from './src/providers/anthropic.js';
import { runAgentLoop } from './src/runtime.js';
import { SCENE_FILE } from './src/run-cad-code/constants.js';
import { writeFileSync } from 'fs';

async function main() {
  console.log('🚀 Agent Runtime 검증 시작\n');
  console.log('목표: LLM이 스크립트 작성 없이 tool_use로 직접 도구 호출\n');

  // 1. Provider와 Executor 생성
  const provider = new AnthropicProvider({
    // API 키는 환경변수에서 자동으로 읽음
  });
  const executor = CADExecutor.create('agent-test');

  console.log('📋 Provider:', provider.name);
  console.log('📋 Scene: agent-test\n');

  // 2. 사용자 요청
  const userPrompt = `
간단한 집을 그려줘:
1. 바닥: 0,0에서 시작하는 200x100 사각형
2. 지붕: 삼각형 모양으로 선 3개 (100,100에서 시작해서 0,100 → 100,150 → 200,100)
3. 문: 80,0에서 시작하는 40x60 사각형
4. 창문1: 20,40에서 시작하는 30x30 사각형
5. 창문2: 150,40에서 시작하는 30x30 사각형

모든 엔티티에 적절한 이름을 붙여줘.
완료 후 export_json으로 결과를 반환해줘.
`;

  console.log('💬 User Prompt:');
  console.log(userPrompt);
  console.log('\n⏳ LLM이 tool_use로 도구 직접 호출 중...\n');

  try {
    // 3. Agent Loop 실행
    const result = await runAgentLoop(provider, executor, userPrompt, {
      domains: ['primitives', 'export'],
      maxIterations: 15,
    });

    console.log('✅ LLM 응답:');
    console.log(result);

    // 4. Scene 내보내기
    const sceneInfo = executor.exec('get_scene_info', {});
    console.log('\n📊 Scene Info:', sceneInfo);

    const jsonResult = executor.exec('export_json', {});
    if (jsonResult.success && jsonResult.data) {
      writeFileSync(SCENE_FILE, jsonResult.data);
      console.log(`\n💾 ${SCENE_FILE} 저장 완료!`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    executor.free();
  }
}

main();
