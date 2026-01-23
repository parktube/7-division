// Glass Railing
// 유리 난간 컴포넌트
// - L자형 (복층/선큰 플랫폼용)
// - 계단 영역 제외
//
// 클래스 기반 API와 레거시 함수 API 모두 제공
//
// @example 클래스 사용
// const railing = new GlassRailingBuilder('railing')
//   .setPlatform(100, 100, 150, 150)
//   .setHeight(50)
//   .setStairSize(60, 50)
//   .build();
//
// @example 레거시 함수 사용 (하위 호환)
// glassRailing('railing', platformX, platformY, 150, 150, 50);
//
// NOTE: Consider refactoring to local coordinate pattern (0,0,0 based)
// then use createGroup() + translate() for placement. Current world coordinate
// approach works but makes reuse/rotation harder.
//
// 조립 예시:
//   // 복층 플랫폼 + 난간
//   import 'interior_lib'
//   sunkenPlatformWithStairs('platform', 100, 100, 150, 150, 50, 60, 50, 4, J.white);
//   glassRailing('railing', 100 - 150, 100, 150, 150, 50, { stairW: 60, stairD: 50 });
//
// @builtin true
// @version 2.0.0

// 의존성: interior_lib, japandi_palette (japandi_lib에서 로드)

// ============================================
// GlassRailingBuilder Class
// ============================================

class GlassRailingBuilder {
  constructor(name) {
    this.name = name;
    this.platformX = 0;
    this.platformY = 0;
    this.platformW = 150;
    this.platformD = 150;
    this.z = 0;
    this.h = 35;
    this.t = 5;
    this.stairW = 60;
    this.stairD = 50;
    this.color = null;
  }

  setPlatform(x, y, w, d) {
    this.platformX = x;
    this.platformY = y;
    this.platformW = w;
    this.platformD = d;
    return this;
  }

  setHeight(z) {
    this.z = z;
    return this;
  }

  setRailingSize(h, t) {
    this.h = h;
    if (t !== undefined) this.t = t;
    return this;
  }

  setStairSize(w, d) {
    this.stairW = w;
    this.stairD = d;
    return this;
  }

  setColor(color) {
    this.color = color;
    return this;
  }

  build() {
    const name = this.name;
    const platformX = this.platformX;
    const platformY = this.platformY;
    const platformW = this.platformW;
    const platformD = this.platformD;
    const z = this.z;

    // Number.isFinite로 NaN/Infinity 방지 + Math.max(0, ...)로 음수 방지
    const h = Math.max(0, Number.isFinite(this.h) ? this.h : 35);
    const t = Math.max(0, Number.isFinite(this.t) ? this.t : 5);
    const stairW = Math.max(0, Number.isFinite(this.stairW) ? this.stairW : 60);
    const stairD = Math.max(0, Number.isFinite(this.stairD) ? this.stairD : 50);
    const color = this.color ?? japandiRailGlass;

    // 계단 치수 검증 (음수 방지 + 플랫폼보다 클 수 없음)
    const validStairW = Math.max(0, Math.min(stairW, platformW));
    const validStairD = Math.max(0, Math.min(stairD, platformD));

    // 계단 경계
    const stairEndX = platformX + validStairW;
    const stairEndY = platformY - (platformD - validStairD);

    // 앞쪽 난간 (계단 옆)
    const frontW = (platformX + platformW) - stairEndX;
    const frontX = (stairEndX + platformX + platformW) / 2;
    const frontY = platformY - platformD + t/2;

    // 왼쪽 난간 (계단 위)
    const leftD = platformY - stairEndY;
    const leftX = platformX + t/2;
    const leftY = (stairEndY + platformY) / 2;

    // 유효한 크기의 난간만 생성 (0 방지)
    const entities = [];
    if (frontW > 0) {
      box(name + '_front', frontX, frontY, z, frontW, t, h, color);
      entities.push(name + '_front');
    }
    if (leftD > 0) {
      box(name + '_left', leftX, leftY, z, t, leftD, h, color);
      entities.push(name + '_left');
    }

    // 그룹화
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

// L자형 유리 난간 (복층용)
// name: 이름, platformX: 플랫폼 왼쪽X, platformY: 플랫폼 뒤쪽Y
// platformW/D: 플랫폼 크기, z: 바닥Z
// opts: { h: 높이(35), t: 두께(5), stairW: 계단너비(60), stairD: 계단깊이(50), color }
function glassRailing(name, platformX, platformY, platformW, platformD, z, opts) {
  opts = opts || {};
  const builder = new GlassRailingBuilder(name)
    .setPlatform(platformX, platformY, platformW, platformD)
    .setHeight(z);

  if (opts.h !== undefined || opts.t !== undefined) {
    builder.setRailingSize(opts.h ?? 35, opts.t ?? 5);
  }
  if (opts.stairW !== undefined || opts.stairD !== undefined) {
    builder.setStairSize(opts.stairW ?? 60, opts.stairD ?? 50);
  }
  if (opts.color !== undefined) {
    builder.setColor(opts.color);
  }

  builder.build();
}
