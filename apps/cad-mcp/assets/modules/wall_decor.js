// Wall Decoration
// 벽 장식 컴포넌트 모음
// - 플로팅 선반, 벽 액자
//
// 클래스 기반 API와 레거시 함수 API 모두 제공
//
// @example 클래스 사용
// const shelf = new FloatingShelfBuilder('shelf')
//   .setPosition(0, 140, 100)
//   .setSize(100, 12, 3)
//   .build();
//
// const frame = new WallFrameBuilder('frame')
//   .setPosition(0, 140, 80)
//   .setSize(24, 32)
//   .build();
//
// @example 레거시 함수 사용 (하위 호환)
// floatingShelf('shelf', 0, 140, 100);
// wallFrameSet('frames', 0, 140, 130);
//
// 조립 예시:
//   // 침대 위 벽 장식
//   bed('bed', 0, 80, 0, 95, 120, J.oak, J.white, 148);
//   floatingShelf('shelf', 0, 140, 65, { w: 100 });
//   wallFrameSet('frames', 0, 140, 95);
//
// @builtin true
// @version 2.0.0

import 'interior_lib'
import 'japandi_palette'

// ============================================
// FloatingShelfBuilder Class
// ============================================

class FloatingShelfBuilder {
  constructor(name) {
    this.name = name;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 100;
    this.d = 12;
    this.h = 3;
    this.color = null;
  }

  setPosition(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  setSize(w, d, h) {
    this.w = w;
    if (d !== undefined) this.d = d;
    if (h !== undefined) this.h = h;
    return this;
  }

  setColor(color) {
    this.color = color;
    return this;
  }

  build() {
    const color = this.color || J.oak;
    box(this.name, this.x, this.y - this.d/2, this.z, this.w, this.d, this.h, color);
    return this;
  }

  getName() {
    return this.name;
  }
}

// ============================================
// WallFrameBuilder Class
// ============================================

class WallFrameBuilder {
  constructor(name) {
    this.name = name;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 24;
    this.h = 32;
    this.frameT = 3;
    this.depth = 3;
    this.frameColor = null;
    this.artColor = null;
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

  setFrameThickness(frameT, depth) {
    this.frameT = frameT;
    if (depth !== undefined) this.depth = depth;
    return this;
  }

  setFrameColor(color) {
    this.frameColor = color;
    return this;
  }

  setArtColor(color) {
    this.artColor = color;
    return this;
  }

  build() {
    const name = this.name;
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const w = this.w;
    const h = this.h;
    const frameT = this.frameT;
    const depth = this.depth;
    const frameColor = this.frameColor || J.white;
    const artColor = this.artColor || artBeige;

    const fY = y - depth/2;

    // 내부 치수 계산 (음수 방지)
    const innerW = Math.max(1, w - frameT * 2);
    const innerH = Math.max(1, h - frameT * 2);

    // 배경
    wallBack(name + '_back', x, y, z, innerW, innerH, artColor);

    // 프레임 테두리
    box(name + '_l', x - w/2 + frameT/2, fY, z, frameT, depth, h, frameColor);
    box(name + '_r', x + w/2 - frameT/2, fY, z, frameT, depth, h, frameColor);
    box(name + '_t', x, fY, z + h - frameT, w, depth, frameT, frameColor);
    box(name + '_b', x, fY, z, w, depth, frameT, frameColor);

    // 그룹화
    createGroup(name, [name + '_back', name + '_l', name + '_r', name + '_t', name + '_b']);
    return this;
  }

  getName() {
    return this.name;
  }
}

// ============================================
// WallFrameSetBuilder Class
// ============================================

class WallFrameSetBuilder {
  constructor(name) {
    this.name = name;
    this.centerX = 0;
    this.y = 0;
    this.z = 0;
    this.spacing = 35;
  }

  setPosition(centerX, y, z) {
    this.centerX = centerX;
    this.y = y;
    this.z = z;
    return this;
  }

  setSpacing(spacing) {
    this.spacing = spacing;
    return this;
  }

  build() {
    const name = this.name;
    const centerX = this.centerX;
    const y = this.y;
    const z = this.z;
    const spacing = this.spacing;

    // 왼쪽 - 세로 직사각형
    new WallFrameBuilder(name + '_1')
      .setPosition(centerX - spacing, y, z)
      .setSize(24, 32)
      .setArtColor(artBeige)
      .build();

    // 중앙 - 정사각형 (큰 것)
    new WallFrameBuilder(name + '_2')
      .setPosition(centerX, y, z)
      .setSize(30, 30)
      .setArtColor(artWhite)
      .build();

    // 오른쪽 - 가로 직사각형 (살짝 높게)
    new WallFrameBuilder(name + '_3')
      .setPosition(centerX + spacing + 3, y, z + 6)
      .setSize(28, 20)
      .setArtColor(artBeige)
      .build();

    // 그룹화
    createGroup(name, [name + '_1', name + '_2', name + '_3']);
    return this;
  }

  getName() {
    return this.name;
  }
}

// ============================================
// Legacy API (하위 호환성)
// ============================================

// 플로팅 선반
// name: 이름, x: 중심X, y: 벽앞Y, z: 높이
// opts: { w: 너비(100), d: 깊이(12), h: 두께(3), color: 색상 }
function floatingShelf(name, x, y, z, opts) {
  opts = opts || {};
  const builder = new FloatingShelfBuilder(name)
    .setPosition(x, y, z);

  if (opts.w !== undefined || opts.d !== undefined || opts.h !== undefined) {
    builder.setSize(opts.w || 100, opts.d || 12, opts.h || 3);
  }
  if (opts.color) {
    builder.setColor(opts.color);
  }

  builder.build();
}

// 벽 액자 (단일)
// name: 이름, x: 중심X, y: 벽Y, z: 하단Z
// opts: { w: 너비(24), h: 높이(32), frameT: 프레임두께(3), depth: 깊이(3), frameColor, artColor }
function wallFrame(name, x, y, z, opts) {
  opts = opts || {};
  const builder = new WallFrameBuilder(name)
    .setPosition(x, y, z);

  if (opts.w !== undefined || opts.h !== undefined) {
    builder.setSize(opts.w || 24, opts.h || 32);
  }
  if (opts.frameT !== undefined || opts.depth !== undefined) {
    builder.setFrameThickness(opts.frameT || 3, opts.depth || 3);
  }
  if (opts.frameColor) {
    builder.setFrameColor(opts.frameColor);
  }
  if (opts.artColor) {
    builder.setArtColor(opts.artColor);
  }

  builder.build();
}

// 벽 액자 세트 (3개)
// Japandi 스타일: 다양한 크기와 배치
// name: 이름, centerX: 중심X, y: 벽Y, z: 하단Z
// opts: { spacing: 간격(35) }
function wallFrameSet(name, centerX, y, z, opts) {
  opts = opts || {};
  new WallFrameSetBuilder(name)
    .setPosition(centerX, y, z)
    .setSpacing(opts.spacing || 35)
    .build();
}
