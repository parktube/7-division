/**
 * cad-tools를 사용하여 방 그리기
 *
 * style은 객체로 직접 전달 (JSON.stringify 불필요!)
 */
import { CADExecutor } from '../src/executor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const executor = CADExecutor.create('my-room');

// 외벽 (400x300, 중심 0,0)
executor.exec('draw_rect', {
  name: 'outer_wall',
  x: -200,
  y: -150,
  width: 400,
  height: 300,
  style: { stroke: { color: [0, 0, 0, 1], width: 3 } },
});

// 내벽 (방 분리)
executor.exec('draw_line', {
  name: 'partition_wall',
  points: [50, -150, 50, 50],
  style: { stroke: { color: [0, 0, 0, 1], width: 2 } },
});

// 문 개구부
executor.exec('draw_line', {
  name: 'door_opening',
  points: [50, 50, 50, 130],
  style: { stroke: { color: [0.4, 0.2, 0, 1], width: 2 } },
});

// 문 열림 표시 (호)
executor.exec('draw_arc', {
  name: 'door_swing',
  cx: 50,
  cy: 50,
  radius: 80,
  start_angle: 0,
  end_angle: Math.PI / 2,
  style: { stroke: { color: [0.4, 0.2, 0, 1], width: 1 } },
});

// 창문 (상단)
executor.exec('draw_line', {
  name: 'window',
  points: [-150, 150, -50, 150],
  style: { stroke: { color: [0.2, 0.6, 1, 1], width: 3 } },
});

// 가구: 침대 (오른쪽 방)
executor.exec('draw_rect', {
  name: 'bed',
  x: 80,
  y: -130,
  width: 100,
  height: 150,
  style: {
    stroke: { color: [0.3, 0.3, 0.3, 1], width: 1 },
    fill: { color: [0.9, 0.9, 0.9, 0.5] },
  },
});

// 가구: 소파 (왼쪽 방)
executor.exec('draw_rect', {
  name: 'sofa',
  x: -180,
  y: 50,
  width: 120,
  height: 60,
  style: {
    stroke: { color: [0.3, 0.3, 0.3, 1], width: 1 },
    fill: { color: [0.8, 0.8, 0.9, 0.5] },
  },
});

// 가구: 테이블 (왼쪽 방)
executor.exec('draw_rect', {
  name: 'table',
  x: -120,
  y: -70,
  width: 80,
  height: 60,
  style: {
    stroke: { color: [0.4, 0.2, 0, 1], width: 1 },
    fill: { color: [0.9, 0.8, 0.7, 0.5] },
  },
});

// 결과 출력
console.log(`Room created with ${executor.getEntityCount()} entities`);
console.log('Entities: outer_wall, partition_wall, door_opening, door_swing, window, bed, sofa, table');

// JSON 저장
const json = executor.exportScene();
const outputPath = path.resolve(__dirname, '../../viewer/scene.json');
try {
  fs.writeFileSync(outputPath, json);
  console.log(`Saved to ${outputPath}`);
} catch (err) {
  console.error('Failed to save scene:', err);
}

executor.free();
