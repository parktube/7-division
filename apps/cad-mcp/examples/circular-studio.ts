/**
 * 원형 원룸 그리기
 *
 * 새로운 style 객체 인터페이스 사용
 */
import { CADExecutor } from '../src/executor.js';
import { SCENE_FILE } from '../src/run-cad-code/constants.js';
import fs from 'fs';

const executor = CADExecutor.create('circular-studio');

// === 외벽 (원형) ===
executor.exec('draw_circle', {
  name: 'outer_wall',
  x: 0,
  y: 0,
  radius: 200,
  style: { stroke: { color: [0.2, 0.2, 0.2, 1], width: 4 } },
});

// === 문 (입구 호) ===
// 아래쪽에 문 개구부 표시
executor.exec('draw_arc', {
  name: 'door_opening',
  cx: 0,
  cy: 0,
  radius: 200,
  start_angle: -Math.PI / 6,  // -30도
  end_angle: Math.PI / 6,      // +30도
  style: { stroke: { color: [0.6, 0.4, 0.2, 1], width: 6 } },
});

// 문 열림 표시
executor.exec('draw_arc', {
  name: 'door_swing',
  cx: 0,
  cy: -200,
  radius: 60,
  start_angle: Math.PI / 2,
  end_angle: Math.PI,
  style: { stroke: { color: [0.6, 0.4, 0.2, 1], width: 1 } },
});

// === 침대 (오른쪽 상단) ===
executor.exec('draw_rect', {
  name: 'bed',
  x: 50,
  y: 30,
  width: 100,
  height: 140,
  style: {
    stroke: { color: [0.4, 0.4, 0.4, 1], width: 1 },
    fill: { color: [0.85, 0.85, 0.9, 0.6] },
  },
});

// 베개
executor.exec('draw_rect', {
  name: 'pillow',
  x: 60,
  y: 140,
  width: 80,
  height: 20,
  style: {
    stroke: { color: [0.5, 0.5, 0.5, 1], width: 1 },
    fill: { color: [1, 1, 1, 0.8] },
  },
});

// === 책상 (왼쪽) ===
executor.exec('draw_rect', {
  name: 'desk',
  x: -150,
  y: 20,
  width: 80,
  height: 50,
  style: {
    stroke: { color: [0.4, 0.25, 0.1, 1], width: 1 },
    fill: { color: [0.8, 0.6, 0.4, 0.6] },
  },
});

// 의자 (원형)
executor.exec('draw_circle', {
  name: 'chair',
  x: -110,
  y: -20,
  radius: 20,
  style: {
    stroke: { color: [0.3, 0.3, 0.3, 1], width: 1 },
    fill: { color: [0.5, 0.5, 0.5, 0.5] },
  },
});

// === 미니 주방 (상단) ===
executor.exec('draw_rect', {
  name: 'kitchenette',
  x: -80,
  y: 130,
  width: 100,
  height: 40,
  style: {
    stroke: { color: [0.3, 0.3, 0.3, 1], width: 2 },
    fill: { color: [0.9, 0.9, 0.9, 0.7] },
  },
});

// 싱크대 (원형)
executor.exec('draw_circle', {
  name: 'sink',
  x: -50,
  y: 150,
  radius: 12,
  style: {
    stroke: { color: [0.5, 0.5, 0.5, 1], width: 1 },
    fill: { color: [0.7, 0.8, 0.9, 0.8] },
  },
});

// 가스레인지 (작은 원 2개)
executor.exec('draw_circle', {
  name: 'burner1',
  x: 0,
  y: 150,
  radius: 10,
  style: {
    stroke: { color: [0.2, 0.2, 0.2, 1], width: 1 },
    fill: { color: [0.3, 0.3, 0.3, 0.8] },
  },
});

executor.exec('draw_circle', {
  name: 'burner2',
  x: -20,
  y: 150,
  radius: 10,
  style: {
    stroke: { color: [0.2, 0.2, 0.2, 1], width: 1 },
    fill: { color: [0.3, 0.3, 0.3, 0.8] },
  },
});

// === 욕실 영역 (왼쪽 하단) ===
// 파티션 호
executor.exec('draw_arc', {
  name: 'bathroom_partition',
  cx: -100,
  cy: -100,
  radius: 70,
  start_angle: 0,
  end_angle: Math.PI / 2,
  style: { stroke: { color: [0.4, 0.6, 0.8, 1], width: 2 } },
});

// 샤워기 (원형)
executor.exec('draw_circle', {
  name: 'shower',
  x: -130,
  y: -130,
  radius: 25,
  style: {
    stroke: { color: [0.4, 0.6, 0.8, 1], width: 1 },
    fill: { color: [0.7, 0.85, 0.95, 0.5] },
  },
});

// 변기 (작은 원)
executor.exec('draw_circle', {
  name: 'toilet',
  x: -80,
  y: -90,
  radius: 15,
  style: {
    stroke: { color: [0.5, 0.5, 0.5, 1], width: 1 },
    fill: { color: [1, 1, 1, 0.8] },
  },
});

// === 러그 (중앙) ===
executor.exec('draw_circle', {
  name: 'rug',
  x: 0,
  y: -30,
  radius: 50,
  style: {
    stroke: { color: [0.6, 0.4, 0.3, 1], width: 1 },
    fill: { color: [0.8, 0.6, 0.5, 0.4] },
  },
});

// 결과 출력
console.log(`Circular studio created with ${executor.getEntityCount()} entities`);

// JSON 저장
const json = executor.exportScene();
try {
  fs.writeFileSync(SCENE_FILE, json);
  console.log(`Saved to ${SCENE_FILE}`);
} catch (err) {
  console.error('Failed to save scene:', err);
}

executor.free();
