/**
 * 곡선 가구 실험 - arc + line 조합
 */
import { CADExecutor } from '../src/executor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const executor = CADExecutor.create('curved-furniture');

// 방법 1: 폐곡선 폴리곤 (직선만)
executor.exec('draw_line', {
  name: 'hexagon',
  points: [
    0, 50,     // 상단
    43, 25,    // 우상
    43, -25,   // 우하
    0, -50,    // 하단
    -43, -25,  // 좌하
    -43, 25,   // 좌상
    0, 50,     // 닫기
  ],
  style: {
    stroke: { color: [0.4, 0.2, 0, 1], width: 2 },
  },
});

// 방법 2: Arc + Line으로 "D" 모양 시뮬레이션
// 곡선 부분 (오른쪽)
executor.exec('draw_arc', {
  name: 'curved_sofa_back',
  cx: 150,
  cy: 0,
  radius: 50,
  start_angle: -Math.PI / 2,  // -90도 (위)
  end_angle: Math.PI / 2,      // +90도 (아래)
  style: {
    stroke: { color: [0.5, 0.3, 0.2, 1], width: 3 },
  },
});

// 직선 부분 (왼쪽, 위/아래 연결)
executor.exec('draw_line', {
  name: 'curved_sofa_front',
  points: [150, -50, 100, -50, 100, 50, 150, 50],
  style: {
    stroke: { color: [0.5, 0.3, 0.2, 1], width: 3 },
  },
});

// 방법 3: 원형 벽을 따라가는 곡선 책상
// 벽 호 (반경 200)
executor.exec('draw_arc', {
  name: 'wall_segment',
  cx: 0,
  cy: -200,
  radius: 200,
  start_angle: Math.PI / 6,
  end_angle: Math.PI / 3,
  style: { stroke: { color: [0.3, 0.3, 0.3, 1], width: 4 } },
});

// 벽을 따라가는 책상 (내부 호)
executor.exec('draw_arc', {
  name: 'curved_desk_outer',
  cx: 0,
  cy: -200,
  radius: 180,  // 벽보다 20 작음
  start_angle: Math.PI / 6,
  end_angle: Math.PI / 3,
  style: {
    stroke: { color: [0.6, 0.4, 0.2, 1], width: 2 },
  },
});

executor.exec('draw_arc', {
  name: 'curved_desk_inner',
  cx: 0,
  cy: -200,
  radius: 140,  // 책상 깊이 40
  start_angle: Math.PI / 6,
  end_angle: Math.PI / 3,
  style: {
    stroke: { color: [0.6, 0.4, 0.2, 1], width: 2 },
  },
});

// 결과 출력
console.log(`Created ${executor.getEntityCount()} entities`);

const json = executor.exportScene();
const outputPath = path.resolve(__dirname, '../../viewer/scene.json');
try {
  fs.writeFileSync(outputPath, json);
  console.log(`Saved to ${outputPath}`);
} catch (err) {
  console.error('Failed to save scene:', err);
}

executor.free();
