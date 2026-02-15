/**
 * Crossy Road 스타일 동물 라이브러리
 * 돼지 구조를 기반으로 모든 동물 생성
 */

import 'crossy_lib'

// scaleLocal 헬퍼
function scaleLocal(name, sx, sy) {
  const entity = getEntity(name);
  if (!entity || !entity.world) return;
  const before = entity.world.center;
  scale(name, sx, sy, { space: 'local' });
  const afterEntity = getEntity(name);
  if (!afterEntity || !afterEntity.world) return;
  const after = afterEntity.world.center;
  translate(name, before[0] - after[0], before[1] - after[1]);
}

// world center 안전 조회 헬퍼
function getWorldCenter(name) {
  const entity = getEntity(name);
  if (!entity || !entity.world || !Array.isArray(entity.world.center)) return null;
  return entity.world.center;
}

function deleteBox3d(name) {
  deleteEntity(name + '_t');
  deleteEntity(name + '_l');
  deleteEntity(name + '_r');
  deleteEntity(name);
}

// 동물 클래스 (돼지 기반)
class Animal {
  constructor(name, x, y, config) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.U = 6;
    this.c = config.bodyColor;
    this.snoutColor = config.snoutColor || config.bodyColor;
    this.noseColor = config.noseColor || C.black;
    this.scale = config.scale || 6.5;
    
    // 비율 조정 (돼지 기준 = 1.0)
    this.bodyRatio = config.bodyRatio || 1.0;
    this.headRatio = config.headRatio || 1.0;
    this.legRatio = config.legRatio || 1.0;
    this.snoutRatio = config.snoutRatio || 1.0;
    this.earRatio = config.earRatio || 1.0;
    this.tailRatio = config.tailRatio || 1.0;
    
    // 얼굴 요소 스케일
    this.eyeScale = config.eyeScale || 0.12;
    this.snoutScale = config.snoutScale || 0.68;
    this.nostrilScale = config.nostrilScale || 0.34;
    this.snoutDepthRatio = config.snoutDepthRatio || 1.0;  // 1.0=기본, 0.5=홀쭉
  }
  
  build() {
    const n = this.name;
    const U = this.U;
    const c = this.c;
    const b = C.black;
    
    // 1. 다리 (돼지와 동일 구조)
    const legZ = 0;
    const legH = U * this.legRatio;
    box3d(n+'_leg_fl', -U*0.6, -U*0.7, legZ, U*0.4, U*0.4, legH, c.t, c.l, c.r);
    box3d(n+'_leg_fr', U*0.6, -U*0.7, legZ, U*0.4, U*0.4, legH, c.t, c.l, c.r);
    box3d(n+'_leg_bl', -U*0.6, U*0.7, legZ, U*0.4, U*0.4, legH, c.t, c.l, c.r);
    box3d(n+'_leg_br', U*0.6, U*0.7, legZ, U*0.4, U*0.4, legH, c.t, c.l, c.r);
    createGroup(n+'_legs', [n+'_leg_fl', n+'_leg_fr', n+'_leg_bl', n+'_leg_br']);
    
    // 2. 몸통
    const bodyZ = stackZ(n+'_leg_fl', -U*0.2);
    const bw = U * 2.2 * this.bodyRatio;
    const bd = U * 1.8 * this.bodyRatio;
    const bh = U * 1.4 * this.bodyRatio;
    box3d(n+'_body', 0, 0, bodyZ, bw, bd, bh, c.t, c.l, c.r);
    
    // 3. 머리
    const headZ = bodyZ + U*0.2;
    const hw = U * 1.6 * this.headRatio;
    box3d(n+'_head', -U*1.8, 0, headZ, hw, hw, hw, c.t, c.l, c.r);
    
    // 4. 코 (snout) - snoutDepthRatio로 홀쭉하게 조절 가능
    const sc = this.snoutColor;
    const snoutD = this.snoutDepthRatio;  // 1.0=기본, 0.5=홀쭉
    box3d(n+'_snout', -U*2.6, 0, headZ + U*0.3, U*0.6*this.snoutRatio, U*0.8*this.snoutRatio*snoutD, U*0.6*this.snoutRatio, sc.t, sc.l, sc.r);
    
    // 5. 콧구멍 (2개)
    const nc = this.noseColor;
    box3d(n+'_nostril_l', -U*2.9, -U*0.2, headZ + U*0.5, U*0.15, U*0.15, U*0.15, nc.t, nc.l, nc.r);
    box3d(n+'_nostril_r', -U*2.9, U*0.2, headZ + U*0.5, U*0.15, U*0.15, U*0.15, nc.t, nc.l, nc.r);
    
    // 6. 귀
    const earW = U * 0.3 * this.earRatio;
    const earD = U * 0.4 * this.earRatio;
    const earH = U * 0.5 * this.earRatio;
    box3d(n+'_ear_l', -U*2.3, -U*0.7, headZ + U*1.6, earW, earD, earH, c.t, c.l, c.r);
    box3d(n+'_ear_r', -U*2.3, U*0.7, headZ + U*1.6, earW, earD, earH, c.t, c.l, c.r);
    
    // 7. 눈
    box3d(n+'_eye_l', -U*2.0, -U*0.5, headZ + U*1.0, U*0.5, U*0.5, U*0.5, b.t, b.l, b.r);
    box3d(n+'_eye_r', -U*2.0, U*0.5, headZ + U*1.0, U*0.5, U*0.5, U*0.5, b.t, b.l, b.r);
    
    // 8. 꼬리
    const tw = U * 0.3 * this.tailRatio;
    const th = U * 0.5 * this.tailRatio;
    box3d(n+'_tail', U*1.3, 0, bodyZ + U*1, tw, tw, th, c.t, c.l, c.r);
    
    // 그룹화
    createGroup(n+'_headGroup', [n+'_head', n+'_snout', n+'_nostril_l', n+'_nostril_r', n+'_ear_l', n+'_ear_r', n+'_eye_l', n+'_eye_r']);
    createGroup(n, [n+'_legs', n+'_body', n+'_headGroup', n+'_tail']);
    
    // 스케일
    scale(n, this.scale, this.scale);
    
    // z-order
    sortByDepth(n+'_leg_fl', n+'_leg_fr', n+'_leg_bl', n+'_leg_br', n+'_body', n+'_head', n+'_tail');
    drawOrder(n+'_headGroup', 'front');
    drawOrder(n+'_tail', 'back');
    drawOrder(n+'_eye_l', 'above:'+n+'_head');
    drawOrder(n+'_eye_r', 'above:'+n+'_head');
    drawOrder(n+'_snout', 'above:'+n+'_head');
    drawOrder(n+'_nostril_l', 'above:'+n+'_snout');
    drawOrder(n+'_nostril_r', 'above:'+n+'_snout');
    drawOrder(n+'_ear_l', 'above:'+n+'_head');
    drawOrder(n+'_ear_r', 'above:'+n+'_head');
    
    // 얼굴 요소 축소 (config에서 가져오기)
    const eyeS = this.eyeScale;
    const snoutS = this.snoutScale;
    const nostrilS = this.nostrilScale;
    scaleLocal(n+'_eye_l', eyeS, eyeS);
    scaleLocal(n+'_eye_r', eyeS, eyeS);
    scaleLocal(n+'_snout', snoutS, snoutS);
    scaleLocal(n+'_nostril_l', nostrilS, nostrilS);
    scaleLocal(n+'_nostril_r', nostrilS, nostrilS);
    
    // 얼굴 요소 위치 조정 (머리 기준 상대 좌표)
    this.adjustFace();
    
    // 최종 위치 이동
    translate(n, this.x, this.y);
  }
  
  adjustFace() {
    const n = this.name;
    // 돼지 스케치 기준 좌표 (scale 6.5 기준)
    // 다른 동물은 스케일 비율로 조정
    const ratio = this.scale / 6.5;
    
    // 돼지 원본 스케치 좌표
    const pigEyeL = [-69.8, 28.98];
    const pigEyeR = [-105.13, 46.31];
    const pigSnout = [-92.685, 14.99];
    const pigNostrilL = [-96, 8.5];
    const pigNostrilR = [-104, 12];
    
    // 스케일 비율 적용
    const targetEyeL = [pigEyeL[0] * ratio, pigEyeL[1] * ratio];
    const targetEyeR = [pigEyeR[0] * ratio, pigEyeR[1] * ratio];
    const targetSnout = [pigSnout[0] * ratio, pigSnout[1] * ratio];
    const targetNostrilL = [pigNostrilL[0] * ratio, pigNostrilL[1] * ratio];
    const targetNostrilR = [pigNostrilR[0] * ratio, pigNostrilR[1] * ratio];
    
    // 눈 이동
    const eyeL = getWorldCenter(n+'_eye_l');
    const eyeR = getWorldCenter(n+'_eye_r');
    if (eyeL && eyeR) {
      translate(n+'_eye_l', targetEyeL[0] - eyeL[0], targetEyeL[1] - eyeL[1]);
      translate(n+'_eye_r', targetEyeR[0] - eyeR[0], targetEyeR[1] - eyeR[1]);
    }
    
    // 코 이동
    const snout = getWorldCenter(n+'_snout');
    if (snout) {
      translate(n+'_snout', targetSnout[0] - snout[0], targetSnout[1] - snout[1]);
    }
    
    // 콧구멍 이동
    const nostrilL = getWorldCenter(n+'_nostril_l');
    const nostrilR = getWorldCenter(n+'_nostril_r');
    if (nostrilL && nostrilR) {
      translate(n+'_nostril_l', targetNostrilL[0] - nostrilL[0], targetNostrilL[1] - nostrilL[1]);
      translate(n+'_nostril_r', targetNostrilR[0] - nostrilR[0], targetNostrilR[1] - nostrilR[1]);
    }
  }
}

// 프리셋 함수들
function createPig(name, x, y) {
  new Animal(name, x, y, {
    bodyColor: C.pink,
    snoutColor: C.pink,
    noseColor: C.black,
    scale: 6.5,
    // 돼지: 기본값 사용
    snoutScale: 0.68,
    nostrilScale: 0.34,
    eyeScale: 0.12
  }).build();
}

function createDog(name, x, y) {
  const a = new Animal(name, x, y, {
    bodyColor: C.brown,
    snoutColor: C.cream,
    noseColor: C.black,
    scale: 5.5,
    bodyRatio: 1.1,
    headRatio: 0.9,
    earRatio: 1.0,      // 적당한 귀 크기
    tailRatio: 1.8,
    snoutRatio: 1.5,    // 긴 주둥이 (3D)
    snoutDepthRatio: 0.6, // 홀쭉하게 (깊이 줄임)
    snoutScale: 0.62,   // 살짝 키움
    nostrilScale: 0.01, // 거의 안보이게
    eyeScale: 0.15
  });
  a.build();
  // 콧구멍 삭제 (box3d가 만드는 _t, _l, _r 폴리곤까지 완전 삭제)
  deleteBox3d(name+'_nostril_l');
  deleteBox3d(name+'_nostril_r');
  // 주둥이 위치 조정 (스케치 기준)
  const snoutNow = getWorldCenter(name+'_snout');
  let snoutDx = 0;
  let snoutDy = 0;
  if (snoutNow) {
    const ratio = a.scale / 6.5;  // 강아지 스케일 / 기본 Animal 스케일
    const snoutLocalTarget = [-82 * ratio, 5 * ratio];  // 스케일 비율 적용된 로컬 좌표
    const snoutWorldTarget = [x + snoutLocalTarget[0], y + snoutLocalTarget[1]];  // 월드 좌표 = 엔티티 위치 + 로컬 오프셋
    snoutDx = snoutWorldTarget[0] - snoutNow[0];
    snoutDy = snoutWorldTarget[1] - snoutNow[1];
    translate(name+'_snout', snoutDx, snoutDy);
  }
  // 귀 위치 아래로 (축 늘어진 귀)
  translate(name+'_ear_l', 0, -5);
  translate(name+'_ear_r', 0, -5);
  // 코 하나로 (주둥이 끝에 검은 코)
  const snoutPart = getPartInfo(name+'_snout');
  if (snoutPart) {
    const noseW = Math.max(1, snoutPart.w * 0.35);
    const noseD = Math.max(1, snoutPart.d * 0.55);
    const noseH = Math.max(1, snoutPart.h * 0.35);
    const noseWx = snoutPart.wx - snoutPart.w / 2 - noseW / 2;
    const noseWy = snoutPart.wy;
    const noseWz = snoutPart.wz + snoutPart.h * 0.35;

    box3d(name+'_nose', noseWx, noseWy, noseWz, noseW, noseD, noseH, C.black.t, C.black.l, C.black.r);
    // Animal.build()에서 그룹에 적용한 변환(스케일/이동)을 동일하게 반영
    scale(name+'_nose', a.scale, a.scale);
    translate(name+'_nose', x, y);
    // snout를 개별 이동한 경우, nose도 동일 오프셋 적용 (시각적으로 주둥이에 고정)
    if (snoutDx !== 0 || snoutDy !== 0) {
      translate(name+'_nose', snoutDx, snoutDy);
    }
    addToGroup(name+'_headGroup', name+'_nose');
    drawOrder(name+'_nose', 'front');
  }
}

function createCat(name, x, y) {
  const a = new Animal(name, x, y, {
    bodyColor: C.orange,
    snoutColor: C.cream,
    noseColor: C.pink,
    scale: 5.0,
    bodyRatio: 0.85,    // 날씬한 몸
    headRatio: 0.9,
    earRatio: 1.8,      // 더 뾰족한 귀
    tailRatio: 1.5,     // 적당한 길이의 꼬리
    snoutScale: 0.01,   // 주둥이 거의 안보이게
    nostrilScale: 0.01, // 콧구멍 거의 안보이게
    eyeScale: 0.18      // 큰 눈
  });
  a.build();
  
  // 기존 주둥이/콧구멍 삭제 (폴리곤까지 완전 삭제)
  deleteBox3d(name+'_snout');
  deleteBox3d(name+'_nostril_l');
  deleteBox3d(name+'_nostril_r');
  
  // 귀 위치 조정 (뾰족하게 솟은 귀)
  translate(name+'_ear_l', 0, 8);
  translate(name+'_ear_r', 0, 8);
  
  // 고양이 코 (작은 분홍색 박스)
  const headPart = getPartInfo(name+'_head');
  if (headPart) {
    const noseW = Math.max(1, headPart.w * 0.18);
    const noseD = Math.max(1, headPart.d * 0.22);
    const noseH = Math.max(1, headPart.h * 0.18);
    const noseWx = headPart.wx - headPart.w / 2 - noseW / 3;
    const noseWy = headPart.wy;
    const noseWz = headPart.wz + headPart.h * 0.55;

    box3d(name+'_nose', noseWx, noseWy, noseWz, noseW, noseD, noseH, C.pink.t, C.pink.l, C.pink.r);
    scale(name+'_nose', a.scale, a.scale);
    translate(name+'_nose', x, y);
    addToGroup(name+'_headGroup', name+'_nose');
    drawOrder(name+'_nose', 'front');
  }
  
  // 꼬리 drawOrder - 몸통 뒤에 배치
  drawOrder(name+'_tail', 'back');
}

// 치킨 (Crossy Road 오리지널)
// NOTE: Chicken is intentionally standalone because Animal is tuned for quadruped body plans.
function createChicken(name, x, y) {
  const U = 8;  // 기본 단위
  const w = C.white;
  const p = C.pink;
  const o = C.orange;
  const b = C.black;
  const n = name;
  
  // 1. 왼발 발가락 3개 (앞으로 뻗음)
  box3d(n+'_toe_l1', -U*0.5, -U*0.5, 0, U*0.35, U*0.1, U*0.06, o.t, o.l, o.r);
  box3d(n+'_toe_l2', -U*0.5, -U*0.35, 0, U*0.35, U*0.1, U*0.06, o.t, o.l, o.r);
  box3d(n+'_toe_l3', -U*0.5, -U*0.2, 0, U*0.35, U*0.1, U*0.06, o.t, o.l, o.r);
  // 2. 오른발 발가락 3개
  box3d(n+'_toe_r1', -U*0.5, U*0.2, 0, U*0.35, U*0.1, U*0.06, o.t, o.l, o.r);
  box3d(n+'_toe_r2', -U*0.5, U*0.35, 0, U*0.35, U*0.1, U*0.06, o.t, o.l, o.r);
  box3d(n+'_toe_r3', -U*0.5, U*0.5, 0, U*0.35, U*0.1, U*0.06, o.t, o.l, o.r);
  
  // 3. 다리 (몸통 바로 아래, 앞쪽으로)
  box3d(n+'_leg_l', -U*0.2, -U*0.35, U*0.06, U*0.15, U*0.15, U*0.5, o.t, o.l, o.r);
  box3d(n+'_leg_r', -U*0.2, U*0.35, U*0.06, U*0.15, U*0.15, U*0.5, o.t, o.l, o.r);
  
  // 4. 몸통 (정육면체에 가까움)
  const bodyZ = U*0.56;
  box3d(n+'_body', 0, 0, bodyZ, U*1.8, U*1.6, U*2.2, w.t, w.l, w.r);
  
  // 5. 벼슬 (comb) - 핑크색
  box3d(n+'_comb', -U*0.3, 0, bodyZ + U*2.2, U*0.6, U*0.5, U*0.5, p.t, p.l, p.r);
  
  // 6. 부리 상단 - 주황색 (앞으로 길게)
  box3d(n+'_beak_top', -U*1.4, 0, bodyZ + U*1.3, U*0.6, U*0.25, U*0.25, o.t, o.l, o.r);
  
  // 7. 부리 하단 - 주황색 (약간 작게)
  box3d(n+'_beak_bot', -U*1.35, 0, bodyZ + U*1.0, U*0.5, U*0.3, U*0.2, o.t, o.l, o.r);
  
  // 8. 꼬물 (wattle) - 핑크색 (부리 아래로 늘어짐)
  box3d(n+'_wattle', -U*1.35, 0, bodyZ + U*0.5, U*0.25, U*0.2, U*0.5, p.t, p.l, p.r);
  
  // 9. 눈 - 검정색 (평면, 한쪽만)
  box3d(n+'_eye_r', -U*0.95, -U*0.65, bodyZ + U*1.4, U*0.3, U*0.3, U*0.3, b.t, b.l, b.r);
  deleteEntity(n+'_eye_r_t');
  deleteEntity(n+'_eye_r_l');

  // 그룹화
  createGroup(n+'_feet', [n+'_toe_l1', n+'_toe_l2', n+'_toe_l3', n+'_toe_r1', n+'_toe_r2', n+'_toe_r3']);
  createGroup(n+'_legs', [n+'_leg_l', n+'_leg_r']);
  createGroup(n+'_head', [n+'_comb', n+'_beak_top', n+'_beak_bot', n+'_wattle', n+'_eye_r']);
  createGroup(n, [n+'_feet', n+'_legs', n+'_body', n+'_head']);
  
  // 스케일
  scale(n, 5, 5);
  
  // z-order
  sortByDepth(n+'_leg_l', n+'_leg_r', n+'_body');
  drawOrder(n+'_head', 'front');
  drawOrder(n+'_eye_r', 'front');
  drawOrder(n+'_wattle', 'front');
  drawOrder(n+'_beak_bot', 'above:'+n+'_wattle');
  drawOrder(n+'_beak_top', 'above:'+n+'_beak_bot');
  
  // 최종 위치
  translate(n, x, y);
  
  // 눈 위치 스케치에 맞춤
  const eyeNow = getWorldCenter(n+'_eye_r');
  if (eyeNow) {
    const chickenScale = 5;  // 닭의 스케일 (scale(n, 5, 5)에서 확인)
    const eyeLocalTarget = [378 * chickenScale / 100, 263 * chickenScale / 100];  // 스케일 비율 적용된 로컬 좌표
    const eyeWorldTarget = [x + eyeLocalTarget[0], y + eyeLocalTarget[1]];  // 월드 좌표 = 엔티티 위치 + 로컬 오프셋
    translate(n+'_eye_r', eyeWorldTarget[0] - eyeNow[0], eyeWorldTarget[1] - eyeNow[1]);
  }
}
