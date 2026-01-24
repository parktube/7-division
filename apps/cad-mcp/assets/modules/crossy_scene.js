// Crossy Road Style Scene Elements
// 길건너친구들 스타일 배경/씬 요소
// - 잔디/도로/물/철로 레인
// - 나무, 바위, 통나무
// - 자동차, 기차
//
// 클래스 기반 API와 레거시 함수 API 모두 제공
//
// @example 레거시 함수 사용
// grassLane('g1', 0);         // 잔디 레인
// roadLane('r1', 1);          // 도로 레인
// waterLane('w1', 2);         // 물 레인
// tree('t1', -40, 100, 1);    // 나무
// car('c1', -80, 50, 'red');  // 자동차
//
// @builtin true
// @version 1.0.0

import 'crossy_lib'

// ============================================
// 배경 색상 팔레트
// ============================================

var BG = {
  // 지형
  grass:     { t: [0.45, 0.75, 0.35, 1], l: [0.38, 0.65, 0.28, 1], r: [0.32, 0.55, 0.22, 1] },
  grassDark: { t: [0.35, 0.60, 0.28, 1], l: [0.28, 0.50, 0.22, 1], r: [0.22, 0.42, 0.18, 1] },
  road:      { t: [0.35, 0.35, 0.38, 1], l: [0.28, 0.28, 0.32, 1], r: [0.22, 0.22, 0.26, 1] },
  roadLine:  { t: [0.95, 0.95, 0.90, 1], l: [0.88, 0.88, 0.82, 1], r: [0.80, 0.80, 0.75, 1] },
  water:     { t: [0.30, 0.60, 0.85, 1], l: [0.25, 0.52, 0.75, 1], r: [0.20, 0.45, 0.68, 1] },

  // 자연물
  tree:      { t: [0.28, 0.55, 0.25, 1], l: [0.22, 0.45, 0.20, 1], r: [0.18, 0.38, 0.16, 1] },
  trunk:     { t: [0.50, 0.35, 0.20, 1], l: [0.42, 0.28, 0.16, 1], r: [0.35, 0.22, 0.12, 1] },
  log:       { t: [0.55, 0.38, 0.22, 1], l: [0.48, 0.32, 0.18, 1], r: [0.40, 0.26, 0.14, 1] },
  rock:      { t: [0.55, 0.52, 0.50, 1], l: [0.45, 0.42, 0.40, 1], r: [0.38, 0.35, 0.33, 1] },
  rockDark:  { t: [0.42, 0.40, 0.38, 1], l: [0.35, 0.33, 0.30, 1], r: [0.28, 0.26, 0.24, 1] },

  // 자동차
  carRed:    { t: [0.85, 0.25, 0.20, 1], l: [0.75, 0.20, 0.15, 1], r: [0.65, 0.15, 0.12, 1] },
  carBlue:   { t: [0.25, 0.45, 0.85, 1], l: [0.20, 0.38, 0.75, 1], r: [0.15, 0.32, 0.65, 1] },
  carYellow: { t: [0.95, 0.85, 0.25, 1], l: [0.85, 0.75, 0.20, 1], r: [0.75, 0.65, 0.15, 1] },
  carGreen:  { t: [0.30, 0.70, 0.35, 1], l: [0.25, 0.60, 0.28, 1], r: [0.20, 0.50, 0.22, 1] },
  window:    { t: [0.70, 0.85, 0.95, 1], l: [0.60, 0.75, 0.88, 1], r: [0.52, 0.68, 0.82, 1] },
  wheel:     { t: [0.15, 0.15, 0.15, 1], l: [0.10, 0.10, 0.10, 1], r: [0.08, 0.08, 0.08, 1] },

  // 기차
  rail:      { t: [0.45, 0.40, 0.35, 1], l: [0.38, 0.33, 0.28, 1], r: [0.30, 0.26, 0.22, 1] },
  railTie:   { t: [0.40, 0.28, 0.18, 1], l: [0.32, 0.22, 0.14, 1], r: [0.26, 0.18, 0.10, 1] },
  trainRed:  { t: [0.80, 0.20, 0.15, 1], l: [0.70, 0.15, 0.12, 1], r: [0.60, 0.12, 0.08, 1] },
  trainBlue: { t: [0.20, 0.35, 0.75, 1], l: [0.15, 0.28, 0.65, 1], r: [0.12, 0.22, 0.55, 1] }
};

// ============================================
// 레인 설정
// ============================================

var LANE_DEPTH = 80;
var LANE_WIDTH = 600;
var LANE_HEIGHT = 6;

// ============================================
// 레인 함수
// ============================================

// 잔디 레인
// id: 이름, laneIndex: 레인 인덱스 (0부터)
function grassLane(id, laneIndex) {
  var x = -laneIndex * LANE_DEPTH;
  var name = 'grass_' + id;

  box3d(name, x, 0, 0, LANE_DEPTH, LANE_WIDTH, LANE_HEIGHT,
        BG.grass.t, BG.grass.l, BG.grass.r);

  return { name: name, x: x, laneIndex: laneIndex };
}

// 도로 레인 (중앙선 포함)
// id: 이름, laneIndex: 레인 인덱스
function roadLane(id, laneIndex) {
  var x = -laneIndex * LANE_DEPTH;
  var name = 'road_' + id;
  var parts = [];

  box3d(name, x, 0, 0, LANE_DEPTH, LANE_WIDTH, LANE_HEIGHT,
        BG.road.t, BG.road.l, BG.road.r);
  parts.push(name);

  // 중앙선
  var lineSpacing = 80;
  var lineLength = 40;
  for (var i = -3; i <= 3; i++) {
    var lineName = name + '_line' + i;
    box3d(lineName, x, i * lineSpacing, LANE_HEIGHT, 2, lineLength, 1,
          BG.roadLine.t, BG.roadLine.l, BG.roadLine.r);
    parts.push(lineName);
  }

  createGroup(name + '_group', parts);
  return { name: name + '_group', x: x, laneIndex: laneIndex };
}

// 물 레인
// id: 이름, laneIndex: 레인 인덱스
function waterLane(id, laneIndex) {
  var x = -laneIndex * LANE_DEPTH;
  var name = 'water_' + id;

  box3d(name, x, 0, 0, LANE_DEPTH, LANE_WIDTH, LANE_HEIGHT - 2,
        BG.water.t, BG.water.l, BG.water.r);

  return { name: name, x: x, laneIndex: laneIndex };
}

// 철로 레인
// id: 이름, laneIndex: 레인 인덱스
function railLane(id, laneIndex) {
  var x = -laneIndex * LANE_DEPTH;
  var name = 'rail_' + id;
  var parts = [];

  // 자갈 바닥
  box3d(name + '_base', x, 0, 0, LANE_DEPTH, LANE_WIDTH, LANE_HEIGHT - 2,
        BG.rockDark.t, BG.rockDark.l, BG.rockDark.r);
  parts.push(name + '_base');

  // 레일
  box3d(name + '_rail1', x, -15, LANE_HEIGHT - 2, LANE_DEPTH - 10, 4, 4,
        BG.rail.t, BG.rail.l, BG.rail.r);
  parts.push(name + '_rail1');
  box3d(name + '_rail2', x, 15, LANE_HEIGHT - 2, LANE_DEPTH - 10, 4, 4,
        BG.rail.t, BG.rail.l, BG.rail.r);
  parts.push(name + '_rail2');

  // 침목
  var tieSpacing = 60;
  for (var i = -4; i <= 4; i++) {
    var tieName = name + '_tie' + i;
    box3d(tieName, x, i * tieSpacing, LANE_HEIGHT - 3, 12, 50, 3,
          BG.railTie.t, BG.railTie.l, BG.railTie.r);
    parts.push(tieName);
  }

  createGroup(name + '_group', parts);
  return { name: name + '_group', x: x, laneIndex: laneIndex };
}

// ============================================
// 자연물 함수
// ============================================

// 나무
// id: 이름, x/y: 위치, scale: 스케일(1)
function tree(id, x, y, scale) {
  var s = scale ?? 1;
  var n = 'tree_' + id;
  var parts = [];

  // 기둥
  box3d(n + '_trunk', x, y, LANE_HEIGHT, 8 * s, 8 * s, 30 * s,
        BG.trunk.t, BG.trunk.l, BG.trunk.r);
  parts.push(n + '_trunk');

  // 잎 (3단계)
  box3d(n + '_leaf1', x, y, LANE_HEIGHT + 25 * s, 32 * s, 32 * s, 20 * s,
        BG.tree.t, BG.tree.l, BG.tree.r);
  parts.push(n + '_leaf1');

  box3d(n + '_leaf2', x, y, LANE_HEIGHT + 40 * s, 26 * s, 26 * s, 18 * s,
        BG.tree.t, BG.tree.l, BG.tree.r);
  parts.push(n + '_leaf2');

  box3d(n + '_leaf3', x, y, LANE_HEIGHT + 55 * s, 18 * s, 18 * s, 14 * s,
        BG.tree.t, BG.tree.l, BG.tree.r);
  parts.push(n + '_leaf3');

  createGroup(n, parts);
  registerIsoGroup(n, x, y);
  return n;
}

// 바위
// id: 이름, x/y: 위치, scale: 스케일(1)
function rock(id, x, y, scale) {
  var s = scale ?? 1;
  var n = 'rock_' + id;
  var parts = [];

  // 메인
  box3d(n + '_base', x, y, LANE_HEIGHT, 24 * s, 20 * s, 16 * s,
        BG.rock.t, BG.rock.l, BG.rock.r);
  parts.push(n + '_base');

  // 상단
  box3d(n + '_top', x - 4 * s, y + 2 * s, LANE_HEIGHT + 14 * s, 16 * s, 14 * s, 10 * s,
        BG.rockDark.t, BG.rockDark.l, BG.rockDark.r);
  parts.push(n + '_top');

  createGroup(n, parts);
  registerIsoGroup(n, x, y);
  return n;
}

// 통나무 (물 위)
// id: 이름, x/y: 위치, length: 길이(100)
function log(id, x, y, length) {
  var n = 'log_' + id;
  var len = length ?? 100;

  box3d(n, x, y, LANE_HEIGHT - 2, 20, len, 12,
        BG.log.t, BG.log.l, BG.log.r);

  registerIsoGroup(n, x, y);
  return n;
}

// ============================================
// 차량 함수
// ============================================

// 자동차 (도로 방향으로 주행)
// id: 이름, x/y: 위치, color: 'red'/'blue'/'yellow'/'green'
// 차량은 Y축 방향(도로 방향)으로 달림. -Y가 전진 방향.
function car(id, x, y, color) {
  var n = 'car_' + id;
  var c = color ?? 'red';
  var colorKey = 'car' + c.charAt(0).toUpperCase() + c.slice(1);
  var col = BG[colorKey] ?? BG.carRed;

  // 뒷바퀴 (뒤쪽 = +Y, 먼저 그려서 뒤에)
  box3d(n + '_wheel2', x - 12, y + 14, LANE_HEIGHT - 2, 6, 10, 10,
        BG.wheel.t, BG.wheel.l, BG.wheel.r);
  box3d(n + '_wheel4', x + 12, y + 14, LANE_HEIGHT - 2, 6, 10, 10,
        BG.wheel.t, BG.wheel.l, BG.wheel.r);

  // 차체 (길이 50 = Y방향, 폭 28 = X방향)
  box3d(n + '_body', x, y, LANE_HEIGHT, 28, 50, 18,
        col.t, col.l, col.r);

  // 캐빈 (앞쪽으로 오프셋 = -Y)
  box3d(n + '_cabin', x, y - 5, LANE_HEIGHT + 18, 24, 30, 14,
        col.t, col.l, col.r);

  // 창문 (측면 = -X)
  box3d(n + '_window', x - 13, y - 5, LANE_HEIGHT + 20, 2, 26, 10,
        BG.window.t, BG.window.l, BG.window.r);

  // 앞바퀴 (앞쪽 = -Y, 나중에 그려서 앞에)
  box3d(n + '_wheel1', x - 12, y - 14, LANE_HEIGHT - 2, 6, 10, 10,
        BG.wheel.t, BG.wheel.l, BG.wheel.r);
  box3d(n + '_wheel3', x + 12, y - 14, LANE_HEIGHT - 2, 6, 10, 10,
        BG.wheel.t, BG.wheel.l, BG.wheel.r);

  // z-order (wheel3,4 뒤/아래, wheel1,2 앞/위)
  var zOrder = [
    n + '_wheel3', n + '_wheel4',
    n + '_body', n + '_cabin', n + '_window',
    n + '_wheel1', n + '_wheel2'
  ];
  for (var i = 0; i < zOrder.length; i++) {
    drawOrder(zOrder[i], 'front');
  }

  createGroup(n, zOrder);
  registerIsoGroup(n, x, y);
  return n;
}

// 기차 (철로 방향으로 주행)
// id: 이름, x/y: 위치, color: 'red'/'blue', cars: 객차 수(3)
// 기차는 Y축 방향(철로 방향)으로 달림. -Y가 전진 방향.
function train(id, x, y, color, cars) {
  var n = 'train_' + id;
  var col = (color === 'blue') ? BG.trainBlue : BG.trainRed;
  var numCars = cars ?? 3;
  var zOrder = [];

  // 객차 (뒤쪽 = +Y, 뒤에서 앞으로)
  for (var i = numCars - 1; i >= 0; i--) {
    var carY = y + 70 + i * 65;
    var carName = n + '_car' + i;
    box3d(carName, x, carY, LANE_HEIGHT, 36, 55, 32,
          BG.rail.t, BG.rail.l, BG.rail.r);
    zOrder.push(carName);
  }

  // 기관차 (앞쪽 = -Y)
  box3d(n + '_loco', x, y, LANE_HEIGHT, 36, 60, 40,
        col.t, col.l, col.r);
  zOrder.push(n + '_loco');

  // 굴뚝
  box3d(n + '_chimney', x, y - 15, LANE_HEIGHT + 40, 12, 12, 16,
        BG.wheel.t, BG.wheel.l, BG.wheel.r);
  zOrder.push(n + '_chimney');

  // 앞부분 (카우캐처)
  box3d(n + '_front', x, y - 35, LANE_HEIGHT, 30, 16, 24,
        col.t, col.l, col.r);
  zOrder.push(n + '_front');

  // z-order
  for (var j = 0; j < zOrder.length; j++) {
    drawOrder(zOrder[j], 'front');
  }

  createGroup(n, zOrder);
  registerIsoGroup(n, x, y);
  return n;
}
