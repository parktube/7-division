/**
 * WebMCP Manual Test Script
 *
 * Viewer (localhost:5173)가 열린 Chrome Console에 붙여넣기
 */

console.log('=== WebMCP Test ===')

// 1. API 존재 확인
const hasWebMcp = !!window.ai?.modelContext
console.log('✓ WebMCP API available:', hasWebMcp)

if (!hasWebMcp) {
  console.error('❌ WebMCP not available. Check:')
  console.error('   - Chrome 146+')
  console.error('   - chrome://flags/#enable-webmcp-testing')
  throw new Error('WebMCP not available')
}

// 2. API 객체 확인
console.log('✓ ModelContext:', window.ai.modelContext)

// 3. Viewer 내부 Store 접근 (React DevTools 필요)
console.log('\n=== Viewer Internal State ===')
console.log('Note: 도구가 등록되었는지 Viewer 콘솔 로그 확인:')
console.log('  [WebMCP] Registered tool: viewer.get_status')
console.log('  [WebMCP] Registered tool: viewer.get_scene_summary')
console.log('  [WebMCP] Registered tool: viewer.get_selection')
console.log('  [WebMCP] Registered tool: viewer.select_entities')

console.log('\n=== How to Test ===')
console.log('1. StatusBar에서 "WebMCP 도구 노출" 토글 켜기')
console.log('2. Console에서 등록 로그 확인')
console.log('3. AI 에이전트로 도구 호출 (Chrome 실험적 기능)')
console.log('4. 또는 Viewer UI에서 직접 선택/조회 후 상태 변경 확인')

console.log('\n✅ Test script complete')
