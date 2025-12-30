import '../cad-engine/pkg/cad_engine.js';
import { CADExecutor } from './src/executor.js';
import { writeFileSync } from 'fs';

const executor = CADExecutor.create('house-floorplan');

console.log('🏠 집 평면도 그리기 (8m x 4m, 중심 0,0)\n');

// 스케일: 50 units = 1m (절반으로 축소)
const S = 50;

// 오프셋: 집 중심을 (0, 0)으로 - 집 크기 8m x 4m이므로 (-4m, -2m)에서 시작
const OX = -4 * S;  // -200
const OY = -2 * S;  // -100

// ===== 1. 외벽 (8m x 4m) =====
console.log('📦 1. 외벽 그리기');
executor.exec('draw_rect', { name: 'outer_wall', x: OX, y: OY, width: 8 * S, height: 4 * S });

// ===== 2. 내벽 (방 구분) =====
console.log('📦 2. 내벽 그리기');

// 거실/주방 구분 (가로벽) - y = -1m
executor.exec('draw_line', { name: 'wall_kitchen', points: [OX, OY + 1 * S, OX + 4 * S, OY + 1 * S] });

// 거실/방 구분 (세로벽) - x = 1m
executor.exec('draw_line', { name: 'wall_bedroom', points: [OX + 5 * S, OY + 1 * S, OX + 5 * S, OY + 4 * S] });

// 주방/화장실 구분 (세로벽) - x = -1m
executor.exec('draw_line', { name: 'wall_bathroom', points: [OX + 3 * S, OY, OX + 3 * S, OY + 1 * S] });

// ===== 3. 문 표시 =====
console.log('🚪 3. 문 표시');
// 현관문 (하단 중앙)
executor.exec('draw_line', { name: 'door_entrance', points: [OX + 3.5 * S, OY, OX + 4.5 * S, OY] });
executor.exec('draw_arc', { name: 'door_entrance_arc', cx: OX + 4.5 * S, cy: OY, radius: 25, start_angle: 90, end_angle: 180, angle_unit: 'degree' });

// 방 문
executor.exec('draw_arc', { name: 'door_bedroom_arc', cx: OX + 5 * S, cy: OY + 1.5 * S, radius: 20, start_angle: 0, end_angle: 90, angle_unit: 'degree' });

// 화장실 문
executor.exec('draw_arc', { name: 'door_bathroom_arc', cx: OX + 3 * S, cy: OY + 0.5 * S, radius: 15, start_angle: 0, end_angle: 90, angle_unit: 'degree' });

// ===== 4. 거실 가구 =====
console.log('🛋️ 4. 거실 가구');
// 소파 (2m x 0.8m)
executor.exec('draw_rect', { name: 'sofa', x: OX + 0.3 * S, y: OY + 2.5 * S, width: 2 * S, height: 0.8 * S });
// TV (1.5m x 0.1m)
executor.exec('draw_rect', { name: 'tv_stand', x: OX + 0.5 * S, y: OY + 1.2 * S, width: 1.5 * S, height: 0.1 * S });
// 테이블 (1m x 0.4m)
executor.exec('draw_rect', { name: 'coffee_table', x: OX + 1 * S, y: OY + 2 * S, width: 1 * S, height: 0.4 * S });

// ===== 5. 침실 가구 =====
console.log('🛏️ 5. 침실 가구');
// 침대 (2m x 1.5m)
executor.exec('draw_rect', { name: 'bed', x: OX + 5.5 * S, y: OY + 2 * S, width: 2 * S, height: 1.5 * S });
// 옷장 (0.8m x 0.5m)
executor.exec('draw_rect', { name: 'closet', x: OX + 7 * S, y: OY + 1.2 * S, width: 0.8 * S, height: 0.5 * S });
// 책상 (1.2m x 0.5m)
executor.exec('draw_rect', { name: 'desk', x: OX + 5.3 * S, y: OY + 1.2 * S, width: 1.2 * S, height: 0.5 * S });
// 의자 (원형)
executor.exec('draw_circle', { name: 'chair', x: OX + 5.9 * S, y: OY + 1.9 * S, radius: 10 });

// ===== 6. 주방 가구 =====
console.log('🍳 6. 주방 가구');
// 싱크대 (1.5m x 0.5m)
executor.exec('draw_rect', { name: 'sink', x: OX + 0.2 * S, y: OY + 0.3 * S, width: 1.5 * S, height: 0.5 * S });
// 가스레인지 (0.6m x 0.5m)
executor.exec('draw_rect', { name: 'stove', x: OX + 1.8 * S, y: OY + 0.3 * S, width: 0.6 * S, height: 0.5 * S });
// 냉장고 (0.4m x 0.6m)
executor.exec('draw_rect', { name: 'fridge', x: OX + 2.5 * S, y: OY + 0.2 * S, width: 0.4 * S, height: 0.6 * S });

// ===== 7. 화장실 =====
console.log('🚽 7. 화장실');
// 변기 (0.4m x 0.5m)
executor.exec('draw_rect', { name: 'toilet', x: OX + 3.3 * S, y: OY + 0.4 * S, width: 0.4 * S, height: 0.5 * S });
// 세면대 (원형)
executor.exec('draw_circle', { name: 'washbasin', x: OX + 4.3 * S, y: OY + 0.5 * S, radius: 10 });
// 샤워부스 (0.6m x 0.4m)
executor.exec('draw_rect', { name: 'shower', x: OX + 3.2 * S, y: OY, width: 0.6 * S, height: 0.4 * S });

// ===== 8. 라벨 (방 이름) - 작은 원으로 표시 =====
console.log('🏷️ 8. 방 위치 표시');
executor.exec('draw_circle', { name: 'label_living', x: OX + 2 * S, y: OY + 2.5 * S, radius: 3 });
executor.exec('draw_circle', { name: 'label_bedroom', x: OX + 6.5 * S, y: OY + 2.5 * S, radius: 3 });
executor.exec('draw_circle', { name: 'label_kitchen', x: OX + 1.5 * S, y: OY + 0.5 * S, radius: 3 });
executor.exec('draw_circle', { name: 'label_bathroom', x: OX + 4 * S, y: OY + 0.5 * S, radius: 3 });

// ===== Scene Info =====
console.log('\n📊 Scene Info:');
const info = executor.exec('get_scene_info', {});
console.log(info.data);

// ===== Export =====
console.log('\n💾 저장 중...');
const jsonResult = executor.exec('export_json', {});
writeFileSync('../viewer/scene.json', jsonResult.data!);
console.log('✅ scene.json 저장 완료!');

const svgResult = executor.exec('export_svg', {});
writeFileSync('../viewer/scene.svg', svgResult.data!);
console.log('✅ scene.svg 저장 완료!');

executor.free();
console.log('\n🎉 집 평면도 완성!');
console.log('👉 http://localhost:8000/viewer/ 에서 확인하세요');
