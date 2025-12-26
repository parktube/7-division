#!/usr/bin/env node
/**
 * 1인 가구 평면도 (8m x 4m)
 * - 거실/주방: 5m x 4m
 * - 침실: 3m x 3m
 * - 화장실: 3m x 1m
 */

import { Scene, init } from '../cad-engine/pkg/cad_engine.js';
import fs from 'fs';
import path from 'path';

// WASM 초기화 (에러 처리 포함)
try {
  init();
} catch (err) {
  console.error('Failed to initialize WASM module:', err.message);
  process.exit(1);
}

let scene;
try {
  scene = new Scene("one_room_floor_plan");
} catch (err) {
  console.error('Failed to create Scene:', err.message);
  process.exit(1);
}

try {
  // 스케일: 1m = 100 단위 (픽셀 가시성)
  const SCALE = 100;
  const WALL_STYLE = JSON.stringify({ stroke: { color: [0, 0, 0, 1], width: 3 } });
  const DOOR_STYLE = JSON.stringify({ stroke: { color: [0.4, 0.2, 0, 1], width: 2 } });
  const WINDOW_STYLE = JSON.stringify({ stroke: { color: [0.2, 0.6, 1, 1], width: 2 } });
  const DIM_STYLE = JSON.stringify({ stroke: { color: [0.5, 0.5, 0.5, 1], width: 1 } });
  const FURNITURE_STYLE = JSON.stringify({ stroke: { color: [0.3, 0.3, 0.3, 1], width: 1 }, fill: { color: [0.9, 0.9, 0.9, 0.5] } });

  // 좌표 원점을 중앙으로 (Y-up 좌표계)
  const originX = -400; // 8m/2 = 4m = 400
  const originY = -200; // 4m/2 = 2m = 200

  // ============ 외벽 ============
  // 외벽 사각형 (8m x 4m)
  scene.draw_rect("outer_wall", originX, originY, 800, 400, WALL_STYLE);

  // ============ 내벽 (방 분리) ============
  // 거실(5m) | 침실+화장실(3m) 분리벽
  scene.draw_line("wall_living_bedroom",
    new Float64Array([originX + 500, originY, originX + 500, originY + 400]), WALL_STYLE);

  // 침실(3m) 과 화장실(1m) 분리벽
  scene.draw_line("wall_bedroom_bathroom",
    new Float64Array([originX + 500, originY + 100, originX + 800, originY + 100]), WALL_STYLE);

  // ============ 문 ============
  // 현관문 (거실 하단 중앙)
  scene.draw_line("door_entrance",
    new Float64Array([originX + 200, originY, originX + 290, originY]), DOOR_STYLE);
  // 문 열림 표시 (호)
  scene.draw_arc("door_entrance_swing", originX + 200, originY, 90, 0, Math.PI/2, DOOR_STYLE);

  // 침실 문 (분리벽)
  scene.draw_line("door_bedroom",
    new Float64Array([originX + 500, originY + 200, originX + 500, originY + 280]), DOOR_STYLE);
  scene.draw_arc("door_bedroom_swing", originX + 500, originY + 200, 80, Math.PI, Math.PI * 1.5, DOOR_STYLE);

  // 화장실 문
  scene.draw_line("door_bathroom",
    new Float64Array([originX + 550, originY + 100, originX + 620, originY + 100]), DOOR_STYLE);
  scene.draw_arc("door_bathroom_swing", originX + 550, originY + 100, 70, -Math.PI/2, 0, DOOR_STYLE);

  // ============ 창문 ============
  // 거실 창문 (상단)
  scene.draw_line("window_living",
    new Float64Array([originX + 100, originY + 400, originX + 300, originY + 400]), WINDOW_STYLE);

  // 침실 창문 (우측)
  scene.draw_line("window_bedroom",
    new Float64Array([originX + 800, originY + 200, originX + 800, originY + 350]), WINDOW_STYLE);

  // ============ 가구 (거실) ============
  // 소파 (2m x 0.8m)
  scene.draw_rect("sofa", originX + 50, originY + 250, 200, 80, FURNITURE_STYLE);

  // TV 유닛 (1.5m x 0.4m)
  scene.draw_rect("tv_unit", originX + 50, originY + 50, 150, 40, FURNITURE_STYLE);

  // 식탁 (1.2m x 0.6m)
  scene.draw_rect("dining_table", originX + 300, originY + 150, 120, 60, FURNITURE_STYLE);

  // 주방 싱크대 (2m x 0.6m)
  scene.draw_rect("kitchen_sink", originX + 250, originY + 340, 200, 50, FURNITURE_STYLE);

  // ============ 가구 (침실) ============
  // 침대 (2m x 1.5m) - 싱글 침대
  scene.draw_rect("bed", originX + 580, originY + 180, 200, 150, FURNITURE_STYLE);

  // 옷장 (1m x 0.5m)
  scene.draw_rect("closet", originX + 520, originY + 350, 100, 40, FURNITURE_STYLE);

  // ============ 화장실 ============
  // 변기
  scene.draw_circle("toilet", originX + 750, originY + 50, 20, FURNITURE_STYLE);

  // 세면대
  scene.draw_rect("sink", originX + 520, originY + 20, 60, 40, FURNITURE_STYLE);

  // ============ 라벨/치수 ============
  // 거실 라벨 위치 표시 (작은 원)
  scene.draw_circle("label_living", originX + 250, originY + 200, 5,
    JSON.stringify({ fill: { color: [0.2, 0.5, 0.2, 1] } }));

  // 침실 라벨 위치
  scene.draw_circle("label_bedroom", originX + 650, originY + 280, 5,
    JSON.stringify({ fill: { color: [0.2, 0.2, 0.5, 1] } }));

  // 화장실 라벨 위치
  scene.draw_circle("label_bathroom", originX + 650, originY + 50, 5,
    JSON.stringify({ fill: { color: [0.5, 0.2, 0.2, 1] } }));

  // JSON 내보내기
  const json = scene.export_json();

  // 출력 디렉토리 확인 및 생성
  const outputPath = './viewer/scene.json';
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, json);

  console.log("Floor plan created!");
  console.log(`Entities: ${scene.entity_count()}`);
  console.log("Layout:");
  console.log("  ┌─────────────────────────────────────────────┐");
  console.log("  │  주방/싱크대              │   옷장          │");
  console.log("  │  ─────────────            ├─────────────────┤");
  console.log("  │                           │                 │");
  console.log("  │      거실                 │     침실        │");
  console.log("  │   소파        식탁        │     침대        │");
  console.log("  │                           │                 │");
  console.log("  │  TV유닛                   ├─────────────────┤");
  console.log("  │              [현관]       │ 화장실 (변기)   │");
  console.log("  └─────────────────────────────────────────────┘");
  console.log("         5m (거실)           3m (방+화장실)");
  console.log("                   8m x 4m");
} finally {
  // 리소스 해제 보장
  if (scene) {
    scene.free();
  }
}
