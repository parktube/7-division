// Crossy Road Style Chicken
// 길건너친구들 스타일 치킨 캐릭터
// - 흰색 몸통, 빨간 볏, 주황색 부리와 발
// - 기본 캐릭터로 사용
//
// 클래스 기반 API와 레거시 함수 API 모두 제공
//
// @example 클래스 사용
// var chicken = new ChickenBuilder('chicken1')
//   .setPosition(0, 0)
//   .setScale(1)
//   .build();
//
// @example 레거시 함수 사용 (하위 호환)
// makeChicken('chicken1', 0, 0);
// makeChicken('chicken2', 100, 50, 0.8);
//
// @builtin true
// @version 1.0.0

import 'crossy_lib'

// ============================================
// 치킨 파츠 설정
// ============================================

var CHICKEN_PARTS = {
  // 몸통
  body: { x: 0, y: 0, z: 20, w: 16, d: 14, h: 24 },
  butt: { x: 2, y: 0, z: 8, w: 20, d: 14, h: 14 },

  // 머리 파츠
  comb: { x: 0, y: 0, z: 44, w: 7, d: 5, h: 6 },
  eye: { x: -4, y: -8, z: 34, w: 4, d: 1, h: 4 },
  beak: { x: -11, y: 0, z: 30, w: 6, d: 5, h: 5 },
  wattle: { x: -11, y: 0, z: 24, w: 3, d: 3, h: 6 },

  // 다리
  leg_back: { x: 3, y: 7, z: 2, w: 2, d: 2, h: 14 },
  leg_front: { x: 3, y: -5, z: 2, w: 2, d: 2, h: 14 },

  // 발등
  instep_back: { x: 3, y: 6, z: 1, w: 4, d: 6, h: 2 },
  instep_front: { x: 3, y: -6, z: 1, w: 4, d: 6, h: 2 },

  // 발가락
  toe_back_outer: { x: -2, y: 8, z: 1, w: 6, d: 2, h: 2 },
  toe_back_inner: { x: -2, y: 4, z: 1, w: 6, d: 2, h: 2 },
  toe_front_inner: { x: -2, y: -4, z: 1, w: 6, d: 2, h: 2 },
  toe_front_outer: { x: -2, y: -8, z: 1, w: 6, d: 2, h: 2 },

  // 날개
  wing_back: { x: 2, y: 10, z: 18, w: 8, d: 6, h: 3 },
  wing_front: { x: 2, y: -10, z: 18, w: 8, d: 6, h: 3 }
};

// ============================================
// ChickenBuilder Class
// ============================================

function ChickenBuilder(name) {
  this.name = name;
  this.wx = 0;
  this.wy = 0;
  this.scale = 1;
}

ChickenBuilder.prototype.setPosition = function(wx, wy) {
  this.wx = wx;
  this.wy = wy;
  return this;
};

ChickenBuilder.prototype.setScale = function(scale) {
  this.scale = scale;
  return this;
};

ChickenBuilder.prototype.build = function() {
  var name = this.name;
  var wx = this.wx;
  var wy = this.wy;
  var s = this.scale;
  var n = name + '_';
  var P = CHICKEN_PARTS;

  // 몸통
  box3d(n + 'body', P.body.x * s, P.body.y * s, P.body.z * s,
        P.body.w * s, P.body.d * s, P.body.h * s,
        C.white.t, C.white.l, C.white.r);
  box3d(n + 'butt', P.butt.x * s, P.butt.y * s, P.butt.z * s,
        P.butt.w * s, P.butt.d * s, P.butt.h * s,
        C.white.t, C.white.l, C.white.r);

  // 머리 파츠
  box3d(n + 'comb', P.comb.x * s, P.comb.y * s, P.comb.z * s,
        P.comb.w * s, P.comb.d * s, P.comb.h * s,
        C.pink.t, C.pink.l, C.pink.r);
  box3d(n + 'eye', P.eye.x * s, P.eye.y * s, P.eye.z * s,
        P.eye.w * s, P.eye.d * s, P.eye.h * s,
        C.black.t, C.black.l, C.black.r);
  box3d(n + 'beak', P.beak.x * s, P.beak.y * s, P.beak.z * s,
        P.beak.w * s, P.beak.d * s, P.beak.h * s,
        C.orange.t, C.orange.l, C.orange.r);
  box3d(n + 'wattle', P.wattle.x * s, P.wattle.y * s, P.wattle.z * s,
        P.wattle.w * s, P.wattle.d * s, P.wattle.h * s,
        C.pink.t, C.pink.l, C.pink.r);

  // 뒷다리 + 발등 + 뒷발
  box3d(n + 'leg_back', P.leg_back.x * s, P.leg_back.y * s, P.leg_back.z * s,
        P.leg_back.w * s, P.leg_back.d * s, P.leg_back.h * s,
        C.orange.t, C.orange.l, C.orange.r);
  box3d(n + 'instep_back', P.instep_back.x * s, P.instep_back.y * s, P.instep_back.z * s,
        P.instep_back.w * s, P.instep_back.d * s, P.instep_back.h * s,
        C.orange.t, C.orange.l, C.orange.r);
  box3d(n + 'toe_back_outer', P.toe_back_outer.x * s, P.toe_back_outer.y * s, P.toe_back_outer.z * s,
        P.toe_back_outer.w * s, P.toe_back_outer.d * s, P.toe_back_outer.h * s,
        C.orange.t, C.orange.l, C.orange.r);
  box3d(n + 'toe_back_inner', P.toe_back_inner.x * s, P.toe_back_inner.y * s, P.toe_back_inner.z * s,
        P.toe_back_inner.w * s, P.toe_back_inner.d * s, P.toe_back_inner.h * s,
        C.orange.t, C.orange.l, C.orange.r);

  // 앞다리 + 발등 + 앞발
  box3d(n + 'leg_front', P.leg_front.x * s, P.leg_front.y * s, P.leg_front.z * s,
        P.leg_front.w * s, P.leg_front.d * s, P.leg_front.h * s,
        C.orange.t, C.orange.l, C.orange.r);
  box3d(n + 'instep_front', P.instep_front.x * s, P.instep_front.y * s, P.instep_front.z * s,
        P.instep_front.w * s, P.instep_front.d * s, P.instep_front.h * s,
        C.orange.t, C.orange.l, C.orange.r);
  box3d(n + 'toe_front_inner', P.toe_front_inner.x * s, P.toe_front_inner.y * s, P.toe_front_inner.z * s,
        P.toe_front_inner.w * s, P.toe_front_inner.d * s, P.toe_front_inner.h * s,
        C.orange.t, C.orange.l, C.orange.r);
  box3d(n + 'toe_front_outer', P.toe_front_outer.x * s, P.toe_front_outer.y * s, P.toe_front_outer.z * s,
        P.toe_front_outer.w * s, P.toe_front_outer.d * s, P.toe_front_outer.h * s,
        C.orange.t, C.orange.l, C.orange.r);

  // 날개
  box3d(n + 'wing_back', P.wing_back.x * s, P.wing_back.y * s, P.wing_back.z * s,
        P.wing_back.w * s, P.wing_back.d * s, P.wing_back.h * s,
        C.white.t, C.white.l, C.white.r);
  box3d(n + 'wing_front', P.wing_front.x * s, P.wing_front.y * s, P.wing_front.z * s,
        P.wing_front.w * s, P.wing_front.d * s, P.wing_front.h * s,
        C.white.t, C.white.l, C.white.r);

  // z-order (뒤→앞) - 발가락이 발등 위에 오도록
  var zOrder = [
    n + 'instep_back', n + 'toe_back_outer', n + 'toe_back_inner', n + 'leg_back',
    n + 'wing_back',
    n + 'instep_front', n + 'toe_front_inner', n + 'toe_front_outer', n + 'leg_front',
    n + 'butt',
    n + 'body',
    n + 'wing_front',
    n + 'wattle',
    n + 'beak',
    n + 'eye',
    n + 'comb'
  ];
  // NOTE: 먼저 그룹화하여 drawOrder가 그룹 내부에서만 적용되도록 (일시적인 root-level 순서 교란 방지)
  createGroup(name, zOrder);
  for (var i = 0; i < zOrder.length; i++) {
    drawOrder(zOrder[i], 'front');
  }

  // 월드 좌표로 이동
  translate(name, wx, wy);
  registerIsoGroup(name, wx, wy);
  return this;
};

ChickenBuilder.prototype.getName = function() {
  return this.name;
};

// ============================================
// Legacy API (하위 호환성)
// ============================================

// 치킨 생성
// name: 이름, wx/wy: 월드 좌표, scale: 스케일(1)
function makeChicken(name, wx, wy, scale) {
  new ChickenBuilder(name)
    .setPosition(wx ?? 0, wy ?? 0)
    .setScale(scale ?? 1)
    .build();
}
