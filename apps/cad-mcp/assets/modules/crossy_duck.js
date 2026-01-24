// Crossy Road Style Duck
// 길건너친구들 스타일 오리 캐릭터
// - 노란색 몸통, 주황색 부리
// - 물에 떠 있는 버전 (다리 없음)
//
// 클래스 기반 API와 레거시 함수 API 모두 제공
//
// @example 클래스 사용
// var duck = new DuckBuilder('duck1')
//   .setPosition(0, 0)
//   .setScale(1)
//   .build();
//
// @example 레거시 함수 사용 (하위 호환)
// makeDuck('duck1', 0, 0);
// makeDuck('duck2', 100, 50, 0.8);
//
// @builtin true
// @version 1.0.0

import 'crossy_lib'

// ============================================
// 오리 색상 팔레트
// ============================================

var DUCK_COLORS = {
  body: { t: [1, 0.9, 0.2, 1], l: [0.85, 0.75, 0.15, 1], r: [0.9, 0.8, 0.18, 1] },
  beak: { t: [1, 0.6, 0.1, 1], l: [0.85, 0.5, 0.08, 1], r: [0.9, 0.55, 0.09, 1] },
  eye: { t: [0.1, 0.1, 0.1, 1], l: [0.05, 0.05, 0.05, 1], r: [0.08, 0.08, 0.08, 1] }
};

// ============================================
// 오리 파츠 설정
// ============================================

var DUCK_PARTS = {
  body:        { x: 0, y: 0, z: 6, w: 18, d: 16, h: 16 },
  tail:        { x: 10, y: 0, z: 10, w: 8, d: 10, h: 8 },
  head:        { x: -8, y: 0, z: 18, w: 14, d: 14, h: 14 },
  eye:         { x: -12, y: -5, z: 22, w: 3, d: 2, h: 3 },
  beak_top:    { x: -18, y: 0, z: 20, w: 8, d: 8, h: 3 },
  beak_bottom: { x: -18, y: 0, z: 17, w: 8, d: 8, h: 3 },
  wing_back:   { x: 2, y: 11, z: 10, w: 10, d: 5, h: 4 },
  wing_front:  { x: 2, y: -11, z: 10, w: 10, d: 5, h: 4 }
};

// ============================================
// DuckBuilder Class
// ============================================

function DuckBuilder(name) {
  this.name = name;
  this.wx = 0;
  this.wy = 0;
  this.scale = 1;
}

DuckBuilder.prototype.setPosition = function(wx, wy) {
  this.wx = wx;
  this.wy = wy;
  return this;
};

DuckBuilder.prototype.setScale = function(scale) {
  this.scale = scale;
  return this;
};

DuckBuilder.prototype.build = function() {
  var name = this.name;
  var wx = this.wx;
  var wy = this.wy;
  var s = this.scale;
  var n = name + '_';
  var P = DUCK_PARTS;
  var DC = DUCK_COLORS;

  // 뒷 날개 (먼저 그려서 뒤에 배치)
  box3d(n + 'wing_back', P.wing_back.x * s, P.wing_back.y * s, P.wing_back.z * s,
        P.wing_back.w * s, P.wing_back.d * s, P.wing_back.h * s,
        DC.body.t, DC.body.l, DC.body.r);

  // 꼬리
  box3d(n + 'tail', P.tail.x * s, P.tail.y * s, P.tail.z * s,
        P.tail.w * s, P.tail.d * s, P.tail.h * s,
        DC.body.t, DC.body.l, DC.body.r);

  // 몸통
  box3d(n + 'body', P.body.x * s, P.body.y * s, P.body.z * s,
        P.body.w * s, P.body.d * s, P.body.h * s,
        DC.body.t, DC.body.l, DC.body.r);

  // 앞 날개
  box3d(n + 'wing_front', P.wing_front.x * s, P.wing_front.y * s, P.wing_front.z * s,
        P.wing_front.w * s, P.wing_front.d * s, P.wing_front.h * s,
        DC.body.t, DC.body.l, DC.body.r);

  // 머리
  box3d(n + 'head', P.head.x * s, P.head.y * s, P.head.z * s,
        P.head.w * s, P.head.d * s, P.head.h * s,
        DC.body.t, DC.body.l, DC.body.r);

  // 부리
  box3d(n + 'beak_bottom', P.beak_bottom.x * s, P.beak_bottom.y * s, P.beak_bottom.z * s,
        P.beak_bottom.w * s, P.beak_bottom.d * s, P.beak_bottom.h * s,
        DC.beak.t, DC.beak.l, DC.beak.r);
  box3d(n + 'beak_top', P.beak_top.x * s, P.beak_top.y * s, P.beak_top.z * s,
        P.beak_top.w * s, P.beak_top.d * s, P.beak_top.h * s,
        DC.beak.t, DC.beak.l, DC.beak.r);

  // 눈
  box3d(n + 'eye', P.eye.x * s, P.eye.y * s, P.eye.z * s,
        P.eye.w * s, P.eye.d * s, P.eye.h * s,
        DC.eye.t, DC.eye.l, DC.eye.r);

  // z-order (뒤→앞)
  var zOrder = [
    n + 'wing_back', n + 'tail', n + 'body', n + 'wing_front',
    n + 'head', n + 'beak_bottom', n + 'beak_top', n + 'eye'
  ];
  for (var i = 0; i < zOrder.length; i++) {
    drawOrder(zOrder[i], 'front');
  }

  // 그룹화 후 월드 좌표로 이동
  createGroup(name, zOrder);
  translate(name, wx, wy);
  registerIsoGroup(name, wx, wy);
  return this;
};

DuckBuilder.prototype.getName = function() {
  return this.name;
};

// ============================================
// Legacy API (하위 호환성)
// ============================================

// 오리 생성
// name: 이름, wx/wy: 월드 좌표, scale: 스케일(1)
function makeDuck(name, wx, wy, scale) {
  new DuckBuilder(name)
    .setPosition(wx ?? 0, wy ?? 0)
    .setScale(scale ?? 1)
    .build();
}
