// Crossy Road Complete Module
// 길건너친구들 스타일 완전 모듈
// - 캐릭터: 치킨, 돼지, 오리
// - 배경 요소: 레인, 나무, 바위, 차, 기차
//
// 이 모듈 하나로 모든 Crossy Road 요소 사용 가능
//
// @example
// import 'crossy_all'
//
// // 배경 레인
// grassLane('g1', 0);
// roadLane('r1', 1);
// waterLane('w1', 2);
//
// // 캐릭터
// makeChicken('hero', -40, 0, 1);
// makePig('pig1', 0, 100, 1);
// makeDuck('duck1', -160, -50, 1);
//
// // 장애물
// tree('t1', -40, 150, 1);
// car('c1', -80, 50, 'red');
//
// // 이소메트릭 정렬 적용
// sortIsoGroups();
//
// @builtin true
// @version 1.0.0

import 'crossy_lib'
import 'crossy_scene'
import 'crossy_chicken'
import 'crossy_pig'
import 'crossy_duck'

// ============================================
// 씬 편의 함수
// ============================================

// 기본 3레인 씬 생성 (잔디-도로-잔디)
// prefix: 이름 프리픽스, startLane: 시작 레인(0)
function basicScene(prefix, startLane) {
  var start = startLane ?? 0;
  var p = prefix ?? 'lane';
  grassLane(p + '_g1', start);
  roadLane(p + '_r1', start + 1);
  grassLane(p + '_g2', start + 2);
}

// 물/통나무 씬 생성
// prefix: 이름 프리픽스, startLane: 시작 레인
function waterScene(prefix, startLane) {
  var start = startLane ?? 0;
  var p = prefix ?? 'water';
  grassLane(p + '_g1', start);
  waterLane(p + '_w1', start + 1);
  waterLane(p + '_w2', start + 2);
  grassLane(p + '_g2', start + 3);

  // 통나무 배치 (LANE_DEPTH from crossy_scene)
  var laneX1 = -(start + 1) * LANE_DEPTH;
  var laneX2 = -(start + 2) * LANE_DEPTH;
  log(p + '_log1', laneX1, -100, 120);
  log(p + '_log2', laneX1, 80, 100);
  log(p + '_log3', laneX2, -20, 140);
}

// 도로/자동차 씬 생성
// prefix: 이름 프리픽스, startLane: 시작 레인
function roadScene(prefix, startLane) {
  var start = startLane ?? 0;
  var p = prefix ?? 'road';
  grassLane(p + '_g1', start);
  roadLane(p + '_r1', start + 1);
  roadLane(p + '_r2', start + 2);
  grassLane(p + '_g2', start + 3);

  // 자동차 배치 (LANE_DEPTH from crossy_scene)
  var laneX1 = -(start + 1) * LANE_DEPTH;
  var laneX2 = -(start + 2) * LANE_DEPTH;
  car(p + '_c1', laneX1, -100, 'red');
  car(p + '_c2', laneX1, 120, 'blue');
  car(p + '_c3', laneX2, 0, 'yellow');
}

// 철로/기차 씬 생성
// prefix: 이름 프리픽스, startLane: 시작 레인
function railScene(prefix, startLane) {
  var start = startLane ?? 0;
  var p = prefix ?? 'rail';
  grassLane(p + '_g1', start);
  railLane(p + '_rail', start + 1);
  grassLane(p + '_g2', start + 2);

  // 기차 배치 (LANE_DEPTH from crossy_scene)
  var laneX = -(start + 1) * LANE_DEPTH;
  train(p + '_train', laneX, -150, 'red', 3);
}

// ============================================
// 데모 씬 생성
// ============================================

// 완전한 데모 씬 생성 (캐릭터 + 배경 + 장애물)
function crossyDemo() {
  // 배경 레인 (8개)
  grassLane('demo_g1', 0);
  roadLane('demo_r1', 1);
  roadLane('demo_r2', 2);
  grassLane('demo_g2', 3);
  waterLane('demo_w1', 4);
  waterLane('demo_w2', 5);
  grassLane('demo_g3', 6);
  railLane('demo_rail', 7);

  // 나무
  tree('demo_t1', -40, -200, 1);
  tree('demo_t2', -40, 200, 0.8);
  tree('demo_t3', -240, -150, 1.2);
  tree('demo_t4', -480, 180, 1);

  // 바위
  rock('demo_rock1', -240, 100, 1);

  // 자동차
  car('demo_c1', -80, -120, 'red');
  car('demo_c2', -80, 100, 'blue');
  car('demo_c3', -160, -50, 'yellow');
  car('demo_c4', -160, 150, 'green');

  // 통나무
  log('demo_log1', -320, -100, 120);
  log('demo_log2', -320, 80, 100);
  log('demo_log3', -400, -20, 140);

  // 기차
  train('demo_train', -560, -100, 'red', 3);

  // 캐릭터
  makeChicken('hero', -40, 0, 1);
  makePig('friend_pig', -240, -50, 0.9);
  makeDuck('water_duck', -360, 50, 1);

  // 이소메트릭 정렬
  sortIsoGroups();
}
