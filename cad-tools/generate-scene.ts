// WASM 초기화 (Node.js target은 모듈 로드 시 자동 초기화)
import '../cad-engine/pkg/cad_engine.js';
import { CADExecutor } from './src/executor.js';
import { writeFileSync } from 'fs';

// CADExecutor.create() 사용 (constructor는 private)
const executor = CADExecutor.create('skeleton');

console.log('🤖 Claude Tool Use 테스트\n');

// 1. 도형 생성
console.log('📦 Step 1: 도형 생성');
console.log('draw_circle:', executor.exec('draw_circle', { name: 'head', x: 0, y: 100, radius: 15 }));
console.log('draw_line (body):', executor.exec('draw_line', { name: 'body', points: [0, 85, 0, 40] }));
console.log('draw_line (left_arm):', executor.exec('draw_line', { name: 'left_arm', points: [0, 70, -30, 50] }));
console.log('draw_line (right_arm):', executor.exec('draw_line', { name: 'right_arm', points: [0, 70, 30, 50] }));

// 2. Query (3.0-a)
console.log('\n🔍 Step 2: list_entities');
console.log(executor.exec('list_entities', {}));

// 3. Transform (3.1-3.4)
console.log('\n🔄 Step 3: translate(head, 10, 0)');
console.log(executor.exec('translate', { name: 'head', dx: 10, dy: 0 }));

console.log('\n🔄 Step 4: rotate(left_arm, 30, degree)');
console.log(executor.exec('rotate', { name: 'left_arm', angle: 30, angle_unit: 'degree' }));

// 4. scene.json 저장
const json = executor.exportScene();
writeFileSync('../viewer/scene.json', json);
console.log('\n✅ scene.json 저장 완료!');
console.log(json);

executor.free();
