// Crossy Road Style Pig
// 길건너친구들 스타일 돼지 캐릭터
// - 분홍색 몸통, 검은 발굽과 눈
// - 특징적인 코와 귀
//
// 클래스 기반 API와 레거시 함수 API 모두 제공
//
// @example 클래스 사용
// var pig = new PigBuilder('pig1')
//   .setPosition(0, 0)
//   .setScale(1)
//   .build();
//
// @example 레거시 함수 사용 (하위 호환)
// makePig('pig1', 0, 0);
// makePig('pig2', 100, 50, 0.8);
//
// @builtin true
// @version 1.0.0

import 'crossy_lib'

// ============================================
// 돼지 색상 팔레트
// ============================================

var PIG_COLORS = {
  body: C.pink,
  snout: { t: [1, 0.78, 0.82, 1], l: [0.92, 0.68, 0.72, 1], r: [0.85, 0.62, 0.66, 1] },
  eye: C.white,
  pupil: C.black,
  ear: C.pink,
  hoof: C.black
};

// ============================================
// 돼지 파츠 설정
// ============================================

var PIG_PARTS = {
  body:       { x: 0, y: 0, z: 0, w: 30, d: 26, h: 22 },
  snout:      { x: 0, y: -15, z: -2, w: 12, d: 6, h: 10 },
  nostril_l:  { x: -3, y: -19, z: 0, w: 2, d: 2, h: 3 },
  nostril_r:  { x: 3, y: -19, z: 0, w: 2, d: 2, h: 3 },
  eye_w_l:    { x: -7, y: -14, z: 10, w: 7, d: 3, h: 7 },
  eye_p_l:    { x: -7, y: -16, z: 10, w: 4, d: 2, h: 4 },
  eye_w_r:    { x: 7, y: -14, z: 10, w: 7, d: 3, h: 7 },
  eye_p_r:    { x: 7, y: -16, z: 10, w: 4, d: 2, h: 4 },
  ear_l:      { x: -10, y: -4, z: 22, w: 6, d: 5, h: 8 },
  ear_r:      { x: 10, y: -4, z: 22, w: 6, d: 5, h: 8 },
  leg_fl:     { x: -10, y: -9, z: -8, w: 6, d: 6, h: 8 },
  leg_fr:     { x: 10, y: -9, z: -8, w: 6, d: 6, h: 8 },
  leg_bl:     { x: -10, y: 9, z: -8, w: 6, d: 6, h: 8 },
  leg_br:     { x: 10, y: 9, z: -8, w: 6, d: 6, h: 8 }
};

// ============================================
// PigBuilder Class
// ============================================

function PigBuilder(name) {
  this.name = name;
  this.wx = 0;
  this.wy = 0;
  this.scale = 1;
}

PigBuilder.prototype.setPosition = function(wx, wy) {
  this.wx = wx;
  this.wy = wy;
  return this;
};

PigBuilder.prototype.setScale = function(scale) {
  this.scale = scale;
  return this;
};

PigBuilder.prototype.build = function() {
  var name = this.name;
  var wx = this.wx;
  var wy = this.wy;
  var S = this.scale * 8;
  var n = name + '_';
  var P = PIG_PARTS;
  var COL = PIG_COLORS;

  // 몸통
  box3d(n + 'body', wx + P.body.x * S / 8, wy + P.body.y * S / 8, P.body.z * S / 8,
        P.body.w * S / 8, P.body.d * S / 8, P.body.h * S / 8,
        COL.body.t, COL.body.l, COL.body.r);

  // 코
  box3d(n + 'snout', wx + P.snout.x * S / 8, wy + P.snout.y * S / 8, P.snout.z * S / 8,
        P.snout.w * S / 8, P.snout.d * S / 8, P.snout.h * S / 8,
        COL.snout.t, COL.snout.l, COL.snout.r);
  box3d(n + 'nostril_l', wx + P.nostril_l.x * S / 8, wy + P.nostril_l.y * S / 8, P.nostril_l.z * S / 8,
        P.nostril_l.w * S / 8, P.nostril_l.d * S / 8, P.nostril_l.h * S / 8,
        COL.pupil.t, COL.pupil.l, COL.pupil.r);
  box3d(n + 'nostril_r', wx + P.nostril_r.x * S / 8, wy + P.nostril_r.y * S / 8, P.nostril_r.z * S / 8,
        P.nostril_r.w * S / 8, P.nostril_r.d * S / 8, P.nostril_r.h * S / 8,
        COL.pupil.t, COL.pupil.l, COL.pupil.r);

  // 눈
  box3d(n + 'eye_w_l', wx + P.eye_w_l.x * S / 8, wy + P.eye_w_l.y * S / 8, P.eye_w_l.z * S / 8,
        P.eye_w_l.w * S / 8, P.eye_w_l.d * S / 8, P.eye_w_l.h * S / 8,
        COL.eye.t, COL.eye.l, COL.eye.r);
  box3d(n + 'eye_p_l', wx + P.eye_p_l.x * S / 8, wy + P.eye_p_l.y * S / 8, P.eye_p_l.z * S / 8,
        P.eye_p_l.w * S / 8, P.eye_p_l.d * S / 8, P.eye_p_l.h * S / 8,
        COL.pupil.t, COL.pupil.l, COL.pupil.r);
  box3d(n + 'eye_w_r', wx + P.eye_w_r.x * S / 8, wy + P.eye_w_r.y * S / 8, P.eye_w_r.z * S / 8,
        P.eye_w_r.w * S / 8, P.eye_w_r.d * S / 8, P.eye_w_r.h * S / 8,
        COL.eye.t, COL.eye.l, COL.eye.r);
  box3d(n + 'eye_p_r', wx + P.eye_p_r.x * S / 8, wy + P.eye_p_r.y * S / 8, P.eye_p_r.z * S / 8,
        P.eye_p_r.w * S / 8, P.eye_p_r.d * S / 8, P.eye_p_r.h * S / 8,
        COL.pupil.t, COL.pupil.l, COL.pupil.r);

  // 귀
  box3d(n + 'ear_l', wx + P.ear_l.x * S / 8, wy + P.ear_l.y * S / 8, P.ear_l.z * S / 8,
        P.ear_l.w * S / 8, P.ear_l.d * S / 8, P.ear_l.h * S / 8,
        COL.ear.t, COL.ear.l, COL.ear.r);
  box3d(n + 'ear_r', wx + P.ear_r.x * S / 8, wy + P.ear_r.y * S / 8, P.ear_r.z * S / 8,
        P.ear_r.w * S / 8, P.ear_r.d * S / 8, P.ear_r.h * S / 8,
        COL.ear.t, COL.ear.l, COL.ear.r);

  // 다리
  box3d(n + 'leg_fl', wx + P.leg_fl.x * S / 8, wy + P.leg_fl.y * S / 8, P.leg_fl.z * S / 8,
        P.leg_fl.w * S / 8, P.leg_fl.d * S / 8, P.leg_fl.h * S / 8,
        COL.hoof.t, COL.hoof.l, COL.hoof.r);
  box3d(n + 'leg_fr', wx + P.leg_fr.x * S / 8, wy + P.leg_fr.y * S / 8, P.leg_fr.z * S / 8,
        P.leg_fr.w * S / 8, P.leg_fr.d * S / 8, P.leg_fr.h * S / 8,
        COL.hoof.t, COL.hoof.l, COL.hoof.r);
  box3d(n + 'leg_bl', wx + P.leg_bl.x * S / 8, wy + P.leg_bl.y * S / 8, P.leg_bl.z * S / 8,
        P.leg_bl.w * S / 8, P.leg_bl.d * S / 8, P.leg_bl.h * S / 8,
        COL.hoof.t, COL.hoof.l, COL.hoof.r);
  box3d(n + 'leg_br', wx + P.leg_br.x * S / 8, wy + P.leg_br.y * S / 8, P.leg_br.z * S / 8,
        P.leg_br.w * S / 8, P.leg_br.d * S / 8, P.leg_br.h * S / 8,
        COL.hoof.t, COL.hoof.l, COL.hoof.r);

  // z-order
  sortByDepth(
    n + 'leg_bl', n + 'leg_br', n + 'ear_l', n + 'ear_r', n + 'body',
    n + 'leg_fl', n + 'leg_fr',
    n + 'snout', n + 'nostril_l', n + 'nostril_r',
    n + 'eye_w_l', n + 'eye_p_l', n + 'eye_w_r', n + 'eye_p_r'
  );

  // 그룹화
  createGroup(name, [
    n + 'body', n + 'snout', n + 'nostril_l', n + 'nostril_r',
    n + 'eye_w_l', n + 'eye_p_l', n + 'eye_w_r', n + 'eye_p_r',
    n + 'ear_l', n + 'ear_r',
    n + 'leg_fl', n + 'leg_fr', n + 'leg_bl', n + 'leg_br'
  ]);

  registerIsoGroup(name, wx, wy);
  return this;
};

PigBuilder.prototype.getName = function() {
  return this.name;
};

// ============================================
// Legacy API (하위 호환성)
// ============================================

// 돼지 생성
// name: 이름, wx/wy: 월드 좌표, scale: 스케일(1)
function makePig(name, wx, wy, scale) {
  new PigBuilder(name)
    .setPosition(wx || 0, wy || 0)
    .setScale(scale || 1)
    .build();
}
