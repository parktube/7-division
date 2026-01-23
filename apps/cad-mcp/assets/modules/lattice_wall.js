// Wood Lattice Wall
// 나무 격자벽 컴포넌트
// - 세로/가로 격자 바 + 4면 프레임 캡
// - Japandi/스칸디 스타일 공간 분리용
//
// 클래스 기반 API와 레거시 함수 API 모두 제공
//
// @example 클래스 사용
// const wall = new WoodLatticeWallBuilder('my_wall')
//   .setPosition(-100, 100, 100)
//   .setWidth(140)
//   .setHeight(280)
//   .setGrid(8, 16)
//   .build();
//
// @example 레거시 함수 사용 (하위 호환)
// woodLatticeWall('my_wall', -100, 100, 140, 0, 280);
//
// 조립 예시:
//   // 거실과 침실 분리
//   woodLatticeWall('divider', -50, 50, 0, 0, 200);
//   sofa('sofa', 0, -60, 0, 80, 40, 35, J.white);
//
// @builtin true
// @version 2.0.0

// 의존성: interior_lib, japandi_palette (japandi_lib에서 로드)

// ============================================
// WoodLatticeWallBuilder Class
// ============================================

class WoodLatticeWallBuilder {
  constructor(name) {
    this.name = name;
    this.x0 = 0;
    this.x1 = 100;
    this.y = 0;
    this.z0 = 0;
    this.height = 280;
    this.frameT = 4;
    this.outerT = 10;
    this.capDepth = 10;
    this.cols = 8;
    this.rows = 16;
    this.color = null;
  }

  setPosition(x0, x1, y) {
    this.x0 = x0;
    this.x1 = x1;
    this.y = y;
    return this;
  }

  setWidth(width) {
    this.x1 = this.x0 + width;
    return this;
  }

  setFloorZ(z0) {
    this.z0 = z0;
    return this;
  }

  setHeight(height) {
    this.height = height;
    return this;
  }

  setFrameThickness(frameT, outerT, capDepth) {
    this.frameT = frameT;
    if (outerT !== undefined) this.outerT = outerT;
    if (capDepth !== undefined) this.capDepth = capDepth;
    return this;
  }

  setGrid(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    return this;
  }

  setColor(color) {
    this.color = color;
    return this;
  }

  build() {
    const name = this.name;

    // Validate numeric inputs - abort with empty group if invalid
    if (!Number.isFinite(this.x0) || !Number.isFinite(this.x1) ||
        !Number.isFinite(this.y) || !Number.isFinite(this.z0) ||
        !Number.isFinite(this.height)) {
      createGroup(name, []);
      return this;
    }

    let x0 = this.x0;
    let x1 = this.x1;
    const y = this.y;
    const z0 = this.z0;
    const height = this.height;

    // 입력 검증 및 정규화
    if (x1 < x0) { const tmp = x0; x0 = x1; x1 = tmp; }
    if (height <= 0) { createGroup(name, []); return this; }

    // Number.isFinite 사용하여 NaN/Infinity 방지
    const frameT = Number.isFinite(this.frameT) ? this.frameT : 4;
    const outerT = Number.isFinite(this.outerT) ? this.outerT : 10;
    const capDepth = Number.isFinite(this.capDepth) ? this.capDepth : 10;
    const cols = Math.max(1, Number.isFinite(this.cols) ? this.cols : 8);
    const rows = Math.max(1, Number.isFinite(this.rows) ? this.rows : 16);
    const color = this.color || japandiOak;

    const width = x1 - x0;
    if (width <= 0) { createGroup(name, []); return this; }
    const centerX = (x0 + x1) / 2;

    // 내부 격자 영역 (음수/0 방지)
    const gw = Math.max(1, width - outerT * 2);
    const gh = Math.max(1, height - outerT * 2);
    const cellW = gw / cols;
    const cellH = gh / rows;

    // 캡 위치
    const capCenterY = y + capDepth / 2;

    const entities = [];

    // --- 내부 세로 바 ---
    const vBars = [];
    for (let i = 1; i < cols; i++) {
      const vx = x0 + outerT + i * cellW;
      wallSide(name + '_v' + i, vx, y, z0 + outerT, frameT, gh, color);
      vBars.push(name + '_v' + i);
    }
    createGroup(name + '_bars_v', vBars);
    entities.push(name + '_bars_v');

    // --- 내부 가로 바 ---
    const hBars = [];
    for (let i = 1; i < rows; i++) {
      const hz = z0 + outerT + i * cellH;
      wallBack(name + '_h' + i, centerX, y, hz, gw, frameT, color);
      hBars.push(name + '_h' + i);
    }
    createGroup(name + '_bars_h', hBars);
    entities.push(name + '_bars_h');

    // --- 프레임 캡 ---
    box(name + '_cap_b', centerX, capCenterY, z0, width, capDepth, outerT, color);
    box(name + '_cap_l', x0 + outerT/2, capCenterY, z0, outerT, capDepth, height, color);
    box(name + '_cap_r', x1 - outerT/2, capCenterY, z0, outerT, capDepth, height, color);
    box(name + '_cap_t', centerX, capCenterY, z0 + height - outerT, width, capDepth, outerT, color);
    createGroup(name + '_caps', [name + '_cap_b', name + '_cap_l', name + '_cap_r', name + '_cap_t']);
    entities.push(name + '_caps');

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

// 나무 격자벽 with 프레임
// name: 이름, x0/x1: 시작/끝 X좌표, y: 벽 내부면Y, z0: 바닥Z, height: 높이
// opts: { frameT: 격자두께(4), outerT: 프레임두께(10), capDepth: 캡깊이(10),
//         cols: 세로칸수(8), rows: 가로칸수(16), color }
function woodLatticeWall(name, x0, x1, y, z0, height, opts) {
  opts = opts || {};
  const builder = new WoodLatticeWallBuilder(name)
    .setPosition(x0, x1, y)
    .setFloorZ(z0)
    .setHeight(height);

  if (opts.frameT !== undefined || opts.outerT !== undefined || opts.capDepth !== undefined) {
    builder.setFrameThickness(
      opts.frameT || 4,
      opts.outerT || 10,
      opts.capDepth || 10
    );
  }
  if (opts.cols !== undefined || opts.rows !== undefined) {
    builder.setGrid(opts.cols || 8, opts.rows || 16);
  }
  if (opts.color) {
    builder.setColor(opts.color);
  }

  builder.build();
}
