/**
 * TV Stand Module
 * 
 * TV 스탠드 (서랍장 + TV)
 * - 나무 프레임 서랍장
 * - 흰색 서랍 2개
 * - TV (검은 화면)
 */

import 'interior_lib'

// ============================================
// 가구용 밝은 오크 (바닥보다 밝고 채도 높음)
// ============================================
const brightOak = {
  t: [0.96, 0.78, 0.48, 1],   // 웜 오크 (레드+옐로우 밸런스)
  l: [0.82, 0.66, 0.40, 1],   // 그림자
  r: [0.89, 0.72, 0.44, 1]    // 측면
};

// ============================================
// TV 스탠드 (서랍장) - Class-based Builder
// ============================================

class TVCabinetBuilder {
  constructor(name) {
    this.name = name;
    this.wx = 0;
    this.wy = 0;
    this.wz = 0;
    this.w = 60;
    this.d = 20;
    this.h = 25;
    this.frameColor = brightOak;
    this.drawerColor = J.white;
  }

  setPosition(wx, wy, wz) {
    this.wx = wx;
    this.wy = wy;
    this.wz = wz;
    return this;
  }

  setSize(w, d, h) {
    this.w = w;
    this.d = d;
    this.h = h;
    return this;
  }

  setFrameColor(color) {
    this.frameColor = color;
    return this;
  }

  setDrawerColor(color) {
    this.drawerColor = color;
    return this;
  }

  drawFrame() {
    const name = this.name;
    const { wx, wy, wz, w, d, h, frameColor } = this;
    const frameT = 3;

    // z-order: base(바닥) 먼저 → right(뒤) → top → left(앞)
    box(name+'_base', wx, wy, wz, w, d, frameT, frameColor);
    box(name+'_right', wx + w/2 - frameT/2, wy, wz + frameT, frameT, d, h - frameT*2, frameColor);
    box(name+'_top', wx, wy, wz + h - frameT, w, d, frameT, frameColor);
    box(name+'_left', wx - w/2 + frameT/2, wy, wz + frameT, frameT, d, h - frameT*2, frameColor);

    return frameT;
  }

  drawDrawers(frameT) {
    const name = this.name;
    const { wx, wy, wz, w, d, h, drawerColor } = this;
    const drawerGap = 3;

    const drawerW = (w - frameT*2 - drawerGap*3) / 2;
    const drawerH = h - frameT*2 - 4;
    const drawerD = 2;

    const drawerY = wy - d/2 + drawerD/2;

    const leftX = wx - drawerW/2 - drawerGap/2;
    box(name+'_drawer1', leftX, drawerY, wz + frameT + 2, drawerW, drawerD, drawerH, drawerColor);

    const rightX = wx + drawerW/2 + drawerGap/2;
    box(name+'_drawer2', rightX, drawerY, wz + frameT + 2, drawerW, drawerD, drawerH, drawerColor);
  }

  build() {
    // Validate numeric inputs
    const numericFields = [this.wx, this.wy, this.wz, this.w, this.d, this.h];
    if (!numericFields.every(v => Number.isFinite(v))) {
      throw new Error('TVCabinetBuilder: position and size must be finite numbers');
    }

    const name = this.name;
    const frameT = this.drawFrame();
    this.drawDrawers(frameT);

    createGroup(name, [
      name+'_drawer1', name+'_drawer2',
      name+'_base', name+'_top', name+'_left', name+'_right'
    ]);

    return this;
  }

  getName() {
    return this.name;
  }
}

/**
 * TV 서랍장 (레거시 함수 - 하위 호환)
 * @param {string} name - 이름
 * @param {number} wx, wy, wz - 중심 좌표
 * @param {number} w - 너비 (기본 60)
 * @param {number} d - 깊이 (기본 20)
 * @param {number} h - 높이 (기본 25)
 * @param {object} frameColor - 프레임 색상
 * @param {object} drawerColor - 서랍 색상
 */
function tvCabinet(name, wx, wy, wz, w, d, h, frameColor, drawerColor) {
  const builder = new TVCabinetBuilder(name)
    .setPosition(wx, wy, wz)
    .setSize(w ?? 60, d ?? 20, h ?? 25);

  if (frameColor) builder.setFrameColor(frameColor);
  if (drawerColor) builder.setDrawerColor(drawerColor);

  builder.build();
}

// ============================================
// TV
// ============================================

/**
 * TV
 * @param {string} name - 이름
 * @param {number} wx, wy, wz - 중심 좌표 (스탠드 바닥 기준)
 * @param {number} screenW - 화면 너비 (기본 40)
 * @param {number} screenH - 화면 높이 (기본 25)
 */
function tv(name, wx, wy, wz, screenW, screenH) {
  screenW = screenW ?? 40;
  screenH = screenH ?? 25;
  
  const screenD = 2;  // 화면 두께
  const standW = 15;
  const standH = 3;
  const standD = 8;
  
  // 1. 스탠드 (밝은 나무색)
  box(name+'_stand', wx, wy, wz, standW, standD, standH, brightOak);
  
  // 2. 화면 (검정)
  box(name+'_screen', wx, wy + 2, wz + standH, screenW, screenD, screenH, J.black);
  
  createGroup(name, [name+'_stand', name+'_screen']);
}

// ============================================
// 소파 (Japandi 스타일)
// ============================================

// 패브릭 색상 (베이지/그레이 톤)
const fabricBeige = {
  t: [0.88, 0.84, 0.78, 1],   // 밝은 베이지
  l: [0.75, 0.71, 0.66, 1],   // 그림자
  r: [0.82, 0.78, 0.72, 1]    // 측면
};

/**
 * 소파 (2인/3인)
 * - 낮은 나무 프레임 + 패브릭 쿠션
 *
 * @param {string} name - 이름
 * @param {number} wx, wy, wz - 중심 좌표
 * @param {number} w - 너비 (기본 70)
 * @param {number} d - 깊이 (기본 35)
 * @param {number} h - 높이 (기본 30)
 * @param {object} frameColor - 프레임 색상 (기본 brightOak)
 * @param {object} cushionColor - 쿠션 색상 (기본 fabricBeige)
 */
function sofa(name, wx, wy, wz, w, d, h, frameColor, cushionColor) {
  w = w ?? 70;
  d = d ?? 35;
  h = h ?? 30;
  frameColor = frameColor ?? brightOak;
  cushionColor = cushionColor ?? fabricBeige;
  
  const frameH = 5;      // 프레임 높이
  const seatH = 8;       // 좌석 높이
  const extraBackH = 8;  // 등받이 추가 높이 (시각적으로 더 높게 보이게)
  const backH = h - frameH - seatH + extraBackH;  // 등받이 높이
  const backD = 8;       // 등받이 깊이
  const armW = 6;        // 팔걸이 너비
  const armH = 14;       // 팔걸이 높이
  
  // TV를 향함: 등받이가 Y- 방향 (화면 앞쪽)
  // z-order: 뒤(Y+)부터 앞(Y-)으로

  // 1. 오른쪽 팔걸이 (X+ 방향, 가장 뒤 depth)
  box(name+'_arm_r', wx + w/2 - armW/2, wy, wz, armW, d, frameH + armH, frameColor);

  // 2. 프레임 (베이스)
  box(name+'_frame', wx, wy, wz, w, d, frameH, frameColor);

  // 3. 좌석 (중앙)
  const seatD = d - backD;
  const seatY = wy + backD/2;
  box(name+'_seat', wx, seatY, wz + frameH, w - armW*2, seatD, seatH, cushionColor);

  // 4. 등받이 (Y- 방향, TV를 향함)
  const backY = wy - d/2 + backD/2;
  box(name+'_back', wx, backY, wz + frameH, w - armW*2, backD, backH, cushionColor);

  // 5. 왼쪽 팔걸이 (X- 방향, 가장 앞 depth)
  box(name+'_arm_l', wx - w/2 + armW/2, wy, wz, armW, d, frameH + armH, frameColor);
  
  createGroup(name, [
    name+'_arm_r',
    name+'_frame',
    name+'_seat',
    name+'_back',
    name+'_arm_l'
  ]);
}

// ============================================
// 커피 테이블
// ============================================

/**
 * 커피 테이블 (Japandi 스타일)
 * - 양쪽 벽체 + 유리 상판
 * 
 * @param {string} name - 이름
 * @param {number} wx, wy, wz - 중심 좌표
 * @param {number} w - 너비 (기본 50)
 * @param {number} d - 깊이 (기본 30)
 * @param {number} h - 높이 (기본 18)
 * @param {object} color - 벽체 색상 (기본 brightOak)
 */
function coffeeTable(name, wx, wy, wz, w, d, h, color) {
  w = w ?? 50;
  d = d ?? 30;
  h = h ?? 18;
  color = color ?? brightOak;
  
  const topT = 2;      // 상판 두께
  const wallT = 4;     // 벽체 두께
  const wallInset = 6; // 벽체가 안쪽으로 들어간 거리
  const frameW = 5;    // 상판 테두리 너비
  
  // 유리 색상 (반투명)
  const glass = {
    t: [0.85, 0.92, 0.95, 0.4],
    l: [0.75, 0.85, 0.88, 0.4],
    r: [0.80, 0.88, 0.92, 0.4]
  };
  
  const wallH = h - topT;
  const wallX = w/2 - wallInset - wallT/2;
  
  // z-order: 뒤쪽 벽체 → 앞쪽 벽체 → 상판
  
  // 1. 오른쪽 벽체 (X+ 방향, 뒤)
  box(name+'_wall_r', wx + wallX, wy, wz, wallT, d - 4, wallH, color);
  
  // 2. 왼쪽 벽체 (X- 방향, 앞)
  box(name+'_wall_l', wx - wallX, wy, wz, wallT, d - 4, wallH, color);
  
  // 3. 상판 프레임 (나무 테두리)
  const topZ = wz + wallH;
  // 뒤쪽 테두리 (Y+)
  box(name+'_frame_back', wx, wy + d/2 - frameW/2, topZ, w, frameW, topT, color);
  // 앞쪽 테두리 (Y-)
  box(name+'_frame_front', wx, wy - d/2 + frameW/2, topZ, w, frameW, topT, color);
  // 오른쪽 테두리 (X+)
  box(name+'_frame_right', wx + w/2 - frameW/2, wy, topZ, frameW, d - frameW*2, topT, color);
  // 왼쪽 테두리 (X-)
  box(name+'_frame_left', wx - w/2 + frameW/2, wy, topZ, frameW, d - frameW*2, topT, color);
  
  // 4. 중앙 유리 (테두리 안쪽)
  const glassW = w - frameW*2;
  const glassD = d - frameW*2;
  box(name+'_glass', wx, wy, topZ, glassW, glassD, topT, glass);
  
  createGroup(name, [
    name+'_wall_r',
    name+'_wall_l',
    name+'_frame_back',
    name+'_frame_front',
    name+'_frame_right',
    name+'_frame_left',
    name+'_glass'
  ]);
}

// ============================================
// 침대 (Japandi 스타일)
// ============================================

/**
 * 침대 (플랫폼 스타일)
 * - 낮은 나무 플랫폼 프레임
 * - 매트리스 + 베개
 * 
 * @param {string} name - 이름
 * @param {number} wx, wy, wz - 중심 좌표
 * @param {number} w - 너비 (기본 50, single)
 * @param {number} d - 깊이 (기본 90)
 * @param {object} frameColor - 프레임 색상 (기본 brightOak)
 * @param {object} mattressColor - 매트리스 색상 (기본 J.white)
 * @param {number} headW - 헤드보드 너비 (기본 w와 같음, 별도 지정 가능)
 */
function bed(name, wx, wy, wz, w, d, frameColor, mattressColor, headW) {
  w = w ?? 50;
  d = d ?? 90;
  frameColor = frameColor ?? brightOak;
  mattressColor = mattressColor ?? J.white;
  headW = headW ?? w;  // 헤드보드 너비 (기본은 침대 너비와 같음)
  
  const platformH = 6;     // 플랫폼 높이
  const mattressH = 10;    // 매트리스 높이
  const platformExt = 3;   // 플랫폼이 매트리스보다 튀어나온 정도
  
  // 베개 - 더 크게
  const pillowW = 28;
  const pillowD = 18;
  const pillowH = 6;
  
  // 헤드보드 (Y+ 방향, 벽쪽) - 두껍고 크게
  const headH = 40;
  const headT = 8;
  
  // z-order: 뒤(Y+)부터 앞(Y-)으로
  
  // 1. 헤드보드 (가장 뒤) - 별도 너비 사용
  const headY = wy + d/2 - headT/2;
  box(name+'_head', wx, headY, wz + platformH, headW, headT, headH, frameColor);
  
  // 2. 플랫폼 프레임
  box(name+'_platform', wx, wy, wz, w + platformExt*2, d + platformExt, platformH, frameColor);
  
  // 3. 매트리스
  const mattY = wy - platformExt/2;
  box(name+'_mattress', wx, mattY, wz + platformH, w, d - headT, mattressH, mattressColor);
  
  // 4. 베개 2개 (Y+ 쪽, 헤드보드 앞)
  const pillowY = wy + d/2 - headT - pillowD/2 - 2;
  const pillowZ = wz + platformH + mattressH;
  box(name+'_pillow_r', wx + w/4, pillowY, pillowZ, pillowW, pillowD, pillowH, mattressColor);
  box(name+'_pillow_l', wx - w/4, pillowY, pillowZ, pillowW, pillowD, pillowH, mattressColor);
  
  createGroup(name, [
    name+'_head',
    name+'_platform',
    name+'_mattress',
    name+'_pillow_r',
    name+'_pillow_l'
  ]);
}

// ============================================
// 통합: TV 스탠드 세트
// ============================================

/**
 * TV 스탠드 세트 (서랍장 + TV)
 * @param {string} name - 이름
 * @param {number} wx, wy, wz - 바닥 중심 좌표
 */
function tvStandSet(name, wx, wy, wz) {
  // 서랍장 (더 크게: 80x25x30)
  tvCabinet(name+'_cabinet', wx, wy, wz, 80, 25, 30, brightOak, J.white);
  
  // TV (서랍장 위에, 화면 더 크게: 55x35)
  tv(name+'_tv', wx, wy, wz + 30, 55, 35);
  
  createGroup(name, [name+'_cabinet', name+'_tv']);
}
