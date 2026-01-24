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
  var s = this.scale;
  var n = name + '_';
  var P = PIG_PARTS;
  var COL = PIG_COLORS;

  // 몸통
  box3d(n + 'body', P.body.x * s, P.body.y * s, P.body.z * s,
        P.body.w * s, P.body.d * s, P.body.h * s,
        COL.body.t, COL.body.l, COL.body.r);

  // 코
  box3d(n + 'snout', P.snout.x * s, P.snout.y * s, P.snout.z * s,
        P.snout.w * s, P.snout.d * s, P.snout.h * s,
        COL.snout.t, COL.snout.l, COL.snout.r);
  box3d(n + 'nostril_l', P.nostril_l.x * s, P.nostril_l.y * s, P.nostril_l.z * s,
        P.nostril_l.w * s, P.nostril_l.d * s, P.nostril_l.h * s,
        COL.pupil.t, COL.pupil.l, COL.pupil.r);
  box3d(n + 'nostril_r', P.nostril_r.x * s, P.nostril_r.y * s, P.nostril_r.z * s,
        P.nostril_r.w * s, P.nostril_r.d * s, P.nostril_r.h * s,
        COL.pupil.t, COL.pupil.l, COL.pupil.r);

  // 눈
  box3d(n + 'eye_w_l', P.eye_w_l.x * s, P.eye_w_l.y * s, P.eye_w_l.z * s,
        P.eye_w_l.w * s, P.eye_w_l.d * s, P.eye_w_l.h * s,
        COL.eye.t, COL.eye.l, COL.eye.r);
  box3d(n + 'eye_p_l', P.eye_p_l.x * s, P.eye_p_l.y * s, P.eye_p_l.z * s,
        P.eye_p_l.w * s, P.eye_p_l.d * s, P.eye_p_l.h * s,
        COL.pupil.t, COL.pupil.l, COL.pupil.r);
  box3d(n + 'eye_w_r', P.eye_w_r.x * s, P.eye_w_r.y * s, P.eye_w_r.z * s,
        P.eye_w_r.w * s, P.eye_w_r.d * s, P.eye_w_r.h * s,
        COL.eye.t, COL.eye.l, COL.eye.r);
  box3d(n + 'eye_p_r', P.eye_p_r.x * s, P.eye_p_r.y * s, P.eye_p_r.z * s,
        P.eye_p_r.w * s, P.eye_p_r.d * s, P.eye_p_r.h * s,
        COL.pupil.t, COL.pupil.l, COL.pupil.r);

  // 귀
  box3d(n + 'ear_l', P.ear_l.x * s, P.ear_l.y * s, P.ear_l.z * s,
        P.ear_l.w * s, P.ear_l.d * s, P.ear_l.h * s,
        COL.ear.t, COL.ear.l, COL.ear.r);
  box3d(n + 'ear_r', P.ear_r.x * s, P.ear_r.y * s, P.ear_r.z * s,
        P.ear_r.w * s, P.ear_r.d * s, P.ear_r.h * s,
        COL.ear.t, COL.ear.l, COL.ear.r);

  // 다리
  box3d(n + 'leg_fl', P.leg_fl.x * s, P.leg_fl.y * s, P.leg_fl.z * s,
        P.leg_fl.w * s, P.leg_fl.d * s, P.leg_fl.h * s,
        COL.hoof.t, COL.hoof.l, COL.hoof.r);
  box3d(n + 'leg_fr', P.leg_fr.x * s, P.leg_fr.y * s, P.leg_fr.z * s,
        P.leg_fr.w * s, P.leg_fr.d * s, P.leg_fr.h * s,
        COL.hoof.t, COL.hoof.l, COL.hoof.r);
  box3d(n + 'leg_bl', P.leg_bl.x * s, P.leg_bl.y * s, P.leg_bl.z * s,
        P.leg_bl.w * s, P.leg_bl.d * s, P.leg_bl.h * s,
        COL.hoof.t, COL.hoof.l, COL.hoof.r);
  box3d(n + 'leg_br', P.leg_br.x * s, P.leg_br.y * s, P.leg_br.z * s,
        P.leg_br.w * s, P.leg_br.d * s, P.leg_br.h * s,
        COL.hoof.t, COL.hoof.l, COL.hoof.r);

  // z-order
  sortByDepth(
    n + 'leg_bl', n + 'leg_br', n + 'ear_l', n + 'ear_r', n + 'body',
    n + 'leg_fl', n + 'leg_fr',
    n + 'snout', n + 'nostril_l', n + 'nostril_r',
    n + 'eye_w_l', n + 'eye_p_l', n + 'eye_w_r', n + 'eye_p_r'
  );

  // 그룹화 후 월드 좌표로 이동
  createGroup(name, [
    n + 'body', n + 'snout', n + 'nostril_l', n + 'nostril_r',
    n + 'eye_w_l', n + 'eye_p_l', n + 'eye_w_r', n + 'eye_p_r',
    n + 'ear_l', n + 'ear_r',
    n + 'leg_fl', n + 'leg_fr', n + 'leg_bl', n + 'leg_br'
  ]);
  translate(name, wx, wy);

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
    .setPosition(wx ?? 0, wy ?? 0)
    .setScale(scale ?? 1)
    .build();
}
