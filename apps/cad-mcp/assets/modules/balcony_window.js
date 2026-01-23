// Balcony Window
// 3분할 베란다 창문 컴포넌트
// - 프레임 + 창살 + 유리 패널
// - 좌우 미닫이문 + 중앙 고정창
//
// 클래스 기반 API와 레거시 함수 API 모두 제공
//
// @example 클래스 사용
// const window = new BalconyWindowBuilder('window')
//   .setPosition(140, 0, 0)
//   .setSize(160, 200)
//   .build();
//
// @example 레거시 함수 사용 (하위 호환)
// balconyWindow('window', 140, 0, 0, { w: 160, h: 200 });
//
// NOTE: Uses world coordinate pattern (direct x,y,z placement).
// Alternative: local coordinate pattern (0,0,0 based) + createGroup() + translate().
// Current approach is simpler for inline wall placement but less flexible for rotation.
// See: interior_lib.js for local coordinate examples.
//
// 조립 예시:
//   // 벽에 창문 배치 (벽 내부면 X좌표 사용)
//   box('wall', 150, 0, 0, 10, 200, 280, J.white);
//   balconyWindow('win', 144, 0, 0, { w: 160, h: 200 });
//
// @builtin true
// @version 2.0.0

// 의존성: interior_lib, japandi_palette (japandi_lib에서 로드)

// ============================================
// BalconyWindowBuilder Class
// ============================================

class BalconyWindowBuilder {
  constructor(name) {
    this.name = name;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 160;
    this.h = 200;
    this.frameT = 4;
    this.mullionT = 3;
    this.depth = 6;
    this.doorH = 180;
    this.frameColor = null;
    this.glassColor = null;
  }

  setPosition(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  setSize(w, h) {
    this.w = w;
    this.h = h;
    return this;
  }

  setFrameThickness(frameT, mullionT) {
    this.frameT = frameT;
    if (mullionT !== undefined) this.mullionT = mullionT;
    return this;
  }

  setDepth(depth) {
    this.depth = depth;
    return this;
  }

  setDoorHeight(doorH) {
    this.doorH = doorH;
    return this;
  }

  setFrameColor(color) {
    this.frameColor = color;
    return this;
  }

  setGlassColor(color) {
    this.glassColor = color;
    return this;
  }

  build() {
    const name = this.name;
    const x = this.x;
    const y = this.y;
    const z0 = this.z;
    const w = this.w;
    const h = this.h;
    const frameT = this.frameT;
    const mullionT = this.mullionT;
    const depth = this.depth;
    const doorH = this.doorH;
    const frameColor = this.frameColor ?? J.white;
    const glassColor = this.glassColor ?? japandiGlass;

    const entities = [];

    // 치수 검증 (음수/0 방지)
    const paneW = (w - frameT*2 - mullionT*2) / 3;
    const glassH1 = doorH - frameT - mullionT;
    const glassH2 = h - doorH - frameT - mullionT;
    if (paneW <= 0 || glassH1 <= 0 || glassH2 <= 0 || depth <= 0) {
      createGroup(name, []);
      return this;
    }

    // 1. 외곽 프레임
    box(name + '_frame_b', x, y, z0 + frameT/2, depth, w, frameT, frameColor);
    box(name + '_frame_t', x, y, z0 + h - frameT/2, depth, w, frameT, frameColor);
    box(name + '_frame_l', x, y - w/2 + frameT/2, z0, depth, frameT, h, frameColor);
    box(name + '_frame_r', x, y + w/2 - frameT/2, z0, depth, frameT, h, frameColor);
    createGroup(name + '_frame', [name + '_frame_b', name + '_frame_t', name + '_frame_l', name + '_frame_r']);
    entities.push(name + '_frame');

    // 2. 창살 (3분할)
    wallSide(name + '_mull_v1', x, y - paneW/2 - mullionT/2, z0 + frameT, mullionT, h - frameT*2, frameColor);
    wallSide(name + '_mull_v2', x, y + paneW/2 + mullionT/2, z0 + frameT, mullionT, h - frameT*2, frameColor);
    wallSide(name + '_mull_h', x, y, z0 + doorH, w - frameT*2, mullionT, frameColor);
    createGroup(name + '_mullions', [name + '_mull_v1', name + '_mull_v2', name + '_mull_h']);
    entities.push(name + '_mullions');

    // 3. 유리 패널
    wallSide(name + '_glass_l', x + 1, y - paneW - mullionT, z0 + frameT, paneW, doorH - frameT - mullionT, glassColor);
    wallSide(name + '_glass_m', x + 1, y, z0 + frameT, paneW, h - frameT*2, glassColor);
    wallSide(name + '_glass_r', x + 1, y + paneW + mullionT, z0 + frameT, paneW, doorH - frameT - mullionT, glassColor);
    wallSide(name + '_glass_tl', x + 1, y - paneW - mullionT, z0 + doorH + mullionT, paneW, h - doorH - frameT - mullionT, glassColor);
    wallSide(name + '_glass_tr', x + 1, y + paneW + mullionT, z0 + doorH + mullionT, paneW, h - doorH - frameT - mullionT, glassColor);
    createGroup(name + '_glass', [name + '_glass_l', name + '_glass_m', name + '_glass_r', name + '_glass_tl', name + '_glass_tr']);
    entities.push(name + '_glass');

    // 최상위 그룹
    createGroup(name, entities);
    return this;
  }

  getName() {
    return this.name;
  }
}

// ============================================
// Legacy API (하위 호환성)
// ============================================

// 3분할 베란다 창문
// name: 이름, x: 벽앞X, y: 창문중심Y, z0: 시작Z
// opts: { w: 너비(160), h: 높이(200), frameT: 프레임두께(4), mullionT: 창살두께(3),
//         depth: 프레임깊이(6), doorH: 문높이(180), frameColor, glassColor }
function balconyWindow(name, x, y, z0, opts) {
  opts = opts || {};
  const builder = new BalconyWindowBuilder(name)
    .setPosition(x, y, z0)
    .setSize(opts.w ?? 160, opts.h ?? 200)
    .setFrameThickness(opts.frameT ?? 4, opts.mullionT ?? 3)
    .setDepth(opts.depth ?? 6)
    .setDoorHeight(opts.doorH ?? 180);

  if (opts.frameColor) builder.setFrameColor(opts.frameColor);
  if (opts.glassColor) builder.setGlassColor(opts.glassColor);

  builder.build();
}
