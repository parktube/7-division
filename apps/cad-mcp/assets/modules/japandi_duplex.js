// Japandi Duplex Interior - Complete Scene Module
// 복층 원룸 Japandi 스타일 인테리어 완성 씬
// - 나무 격자벽 거실 + 선큰 복층 침실
// - 미니멀한 가구 배치
//
// 클래스 기반 API와 레거시 함수 API 모두 제공
//
// @example 클래스 사용
// const duplex = new JapandiDuplexBuilder('my_room')
//   .setPosition(0, 0, 0)
//   .setRoomSize(300, 300, 280)
//   .build();
//
// @example 레거시 함수 사용 (하위 호환)
// japandiDuplex('my_room', 0, 0, 0);
//
// 또는 개별 영역만:
//   japandiLivingRoom('living', 0, 0, 0, opts);
//   japandiMezzanine('mezz', x, y, z, opts);
//
// @builtin true
// @version 2.0.0

import 'japandi_lib'

// ============================================
// 기본 설정
// ============================================

const DEFAULT_ROOM = {
  w: 300,        // 룸 너비
  d: 300,        // 룸 깊이
  h: 280,        // 천장 높이
  floorT: 15,    // 바닥 슬래브 두께
  wallT: 10      // 벽 두께
};

const DEFAULT_PLATFORM = {
  w: 150,        // 너비
  d: 290,        // 깊이
  h: 50          // 높이
};

const DEFAULT_STAIR = {
  w: 60,         // 계단 너비
  d: 50,         // 계단 깊이
  steps: 4       // 계단 수
};

// 침대 관련 상수
const BED_WIDTH = 95;
const BED_DEPTH = 120;
const BED_HEAD_WIDTH = 148;
const BED_OFFSET_Y = -60;           // 침대 Y 오프셋 (플랫폼 후면 기준)
const SHADOW_OFFSET_X = -4;
const SHADOW_OFFSET_Z = 0.5;
const SHADOW_EXPAND = 10;
const SHELF_HEIGHT = 65;            // 선반 높이 (플랫폼 바닥 기준)
const FRAME_HEIGHT = 95;            // 프레임 높이 (플랫폼 바닥 기준)

// ============================================
// JapandiDuplexBuilder Class
// ============================================

class JapandiDuplexBuilder {
  constructor(name) {
    this.name = name;
    this.wx = 0;
    this.wy = 0;
    this.wz = 0;
    this.room = { ...DEFAULT_ROOM };
    this.platform = { ...DEFAULT_PLATFORM };
  }

  setPosition(wx, wy, wz) {
    this.wx = wx;
    this.wy = wy;
    this.wz = wz;
    return this;
  }

  setRoomSize(w, d, h) {
    this.room.w = w;
    this.room.d = d;
    this.room.h = h;
    return this;
  }

  setFloorThickness(floorT) {
    this.room.floorT = floorT;
    return this;
  }

  setWallThickness(wallT) {
    this.room.wallT = wallT;
    return this;
  }

  setPlatformSize(w, d, h) {
    this.platform.w = w;
    this.platform.d = d;
    this.platform.h = h;
    return this;
  }

  build() {
    const name = this.name;
    const wx = this.wx;
    const wy = this.wy;
    const wz = this.wz;
    const room = this.room;
    const platform = this.platform;

    // 벽 내부 면 좌표
    const wallInnerX = wx + room.w/2 - room.wallT;
    const wallInnerY = wy + room.d/2 - room.wallT;

    const topLevelGroups = [];

    // ==========================================
    // 1. 바닥
    // ==========================================
    box(name + '_floor_base', wx, wy, wz - room.floorT, room.w, room.d, room.floorT, J.white);
    parquetFloor(name + '_parquet', wx, wy, wz, room.w, room.d, 40, 4, J.oak);
    floor(name + '_parquet_edge', wx, wy + room.d/2 - 10, wz, room.w, 20, J.oak);
    createGroup(name + '_floor', [name + '_floor_base', name + '_parquet', name + '_parquet_edge']);
    topLevelGroups.push(name + '_floor');

    // ==========================================
    // 2. 벽
    // ==========================================
    box(name + '_wall_back', wx, wy + room.d/2 - room.wallT/2, wz, room.w, room.wallT, room.h, J.white);
    box(name + '_wall_right', wx + room.w/2 - room.wallT/2, wy - room.wallT/2, wz, room.wallT, room.d - room.wallT, room.h, J.white);
    createGroup(name + '_walls', [name + '_wall_back', name + '_wall_right']);
    topLevelGroups.push(name + '_walls');

    // ==========================================
    // 3. 나무 격자벽 (거실 영역)
    // ==========================================
    const latticeX0 = wx - room.w/2;
    const latticeX1 = wallInnerX - platform.w;

    woodLatticeWall(name + '_lattice', latticeX0, latticeX1, wallInnerY, wz, room.h, {
      cols: 8,
      rows: 16,
      capDepth: room.wallT
    });
    topLevelGroups.push(name + '_lattice');

    // ==========================================
    // 4. 베란다 창문
    // ==========================================
    const windowX = wallInnerX - 3;
    balconyWindow(name + '_window', windowX, wy - 20, wz, {
      w: 160,
      h: 200
    });
    topLevelGroups.push(name + '_window');

    // ==========================================
    // 5. 선큰 플랫폼 + 계단 (창문 위에 덮음)
    // ==========================================
    sunkenPlatformWithStairs(
      name + '_platform',
      wallInnerX,
      wallInnerY,
      platform.w,
      platform.d,
      platform.h,
      DEFAULT_STAIR.w, DEFAULT_STAIR.d, DEFAULT_STAIR.steps,
      J.white
    );
    topLevelGroups.push(name + '_platform');

    // ==========================================
    // 6. 거실 가구
    // ==========================================
    const livingCX = wx - 80;

    // TV 스탠드 + 그림자 (wz로 높이 동기화)
    furnitureShadow(name + '_shadow_tv', livingCX, wy + 98, 85, 28, 4, wz);
    tvStandSet(name + '_tv', livingCX, wy + 100, wz);

    // 커피 테이블 + 그림자 (wz로 높이 동기화)
    furnitureShadow(name + '_shadow_table', livingCX, wy + 18, 65, 38, 4, wz);
    coffeeTable(name + '_table', livingCX, wy + 20, wz, 60, 35, 18);

    // 소파 + 그림자 (wz로 높이 동기화)
    furnitureShadow(name + '_shadow_sofa', livingCX, wy - 40, 105, 55, 4, wz);
    sofa(name + '_sofa', livingCX, wy - 40, wz, 100, 50, 38, J.white);

    createGroup(name + '_living', [
      name + '_shadow_tv', name + '_tv',
      name + '_shadow_table', name + '_table',
      name + '_shadow_sofa', name + '_sofa'
    ]);
    topLevelGroups.push(name + '_living');

    // ==========================================
    // 7. 복층 침실
    // ==========================================
    const mezzZ = wz + platform.h;
    const bedW = 95;
    const bedD = 120;
    const headW = 148;
    const mezzCX = wallInnerX - platform.w/2;
    const mezzCY = wallInnerY - bedD/2 - 4;

    // 침대 + 그림자 (복층 레벨)
    box(name + '_shadow_bed', mezzCX - 4, mezzCY, mezzZ + 0.5, bedW + 10, bedD + 10, 1, japandiShadow);
    bed(name + '_bed', mezzCX, mezzCY, mezzZ, bedW, bedD, J.oak, J.white, headW);

    // 벽 장식
    const decoY = wallInnerY - 1;
    floatingShelf(name + '_shelf', mezzCX, decoY, mezzZ + 65, { w: 100 });
    wallFrameSet(name + '_frames', mezzCX, decoY, mezzZ + 95);

    createGroup(name + '_mezzanine', [
      name + '_shadow_bed', name + '_bed',
      name + '_shelf', name + '_frames'
    ]);
    topLevelGroups.push(name + '_mezzanine');

    // ==========================================
    // 8. 유리 난간
    // ==========================================
    const railPlatformX = wallInnerX - platform.w;
    glassRailing(name + '_railing', railPlatformX, wallInnerY, platform.w, platform.d, mezzZ, {
      stairW: DEFAULT_STAIR.w,
      stairD: DEFAULT_STAIR.d
    });
    topLevelGroups.push(name + '_railing');

    // ==========================================
    // 최상위 그룹
    // ==========================================
    createGroup(name, topLevelGroups);
    return this;
  }

  getName() {
    return this.name;
  }
}

// ============================================
// JapandiLivingRoomBuilder Class
// ============================================

class JapandiLivingRoomBuilder {
  constructor(name) {
    this.name = name;
    this.wx = 0;
    this.wy = 0;
    this.wz = 0;
    this.w = 140;
    this.d = 280;
    this.h = 280;
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

  build() {
    const name = this.name;
    const wx = this.wx;
    const wy = this.wy;
    const wz = this.wz;
    const w = this.w;
    const d = this.d;
    const h = this.h;

    // 격자벽
    woodLatticeWall(name + '_wall', wx - w/2, wx + w/2, wy + d/2, wz, h);

    // 가구
    tvStandSet(name + '_tv', wx, wy + d/2 - 40, wz);
    coffeeTable(name + '_table', wx, wy, wz, 60, 35, 18);
    sofa(name + '_sofa', wx, wy - 60, wz, 100, 50, 38, J.white);

    // 그룹화
    createGroup(name, [name + '_wall', name + '_tv', name + '_table', name + '_sofa']);
    return this;
  }

  getName() {
    return this.name;
  }
}

// ============================================
// JapandiMezzanineBuilder Class
// ============================================

class JapandiMezzanineBuilder {
  constructor(name) {
    this.name = name;
    this.wx = 0;
    this.wy = 0;
    this.wz = 0;
    this.platformW = 150;
    this.platformD = 150;
    this.platformH = 50;
  }

  setPosition(wx, wy, wz) {
    this.wx = wx;
    this.wy = wy;
    this.wz = wz;
    return this;
  }

  setPlatformSize(w, d, h) {
    this.platformW = w;
    this.platformD = d;
    this.platformH = h;
    return this;
  }

  build() {
    const name = this.name;
    const wx = this.wx;
    const wy = this.wy;
    const wz = this.wz;
    const platformW = this.platformW;
    const platformD = this.platformD;
    const platformH = this.platformH;

    // 플랫폼
    sunkenPlatformWithStairs(
      name + '_platform',
      wx, wy,
      platformW, platformD, platformH,
      DEFAULT_STAIR.w, DEFAULT_STAIR.d, DEFAULT_STAIR.steps,
      J.white
    );

    // 침대 + 그림자
    const bedCX = wx - platformW/2;
    const bedCY = wy + BED_OFFSET_Y;
    box(name + '_shadow_bed', bedCX + SHADOW_OFFSET_X, bedCY, wz + platformH + SHADOW_OFFSET_Z, BED_WIDTH + SHADOW_EXPAND, BED_DEPTH + SHADOW_EXPAND, 1, japandiShadow);
    bed(name + '_bed', bedCX, bedCY, wz + platformH, BED_WIDTH, BED_DEPTH, J.oak, J.white, BED_HEAD_WIDTH);

    // 벽 장식
    floatingShelf(name + '_shelf', bedCX, wy - 1, wz + platformH + SHELF_HEIGHT);
    wallFrameSet(name + '_frames', bedCX, wy - 1, wz + platformH + FRAME_HEIGHT);

    // 유리 난간
    glassRailing(name + '_railing', wx - platformW, wy, platformW, platformD, wz + platformH, {
      stairW: DEFAULT_STAIR.w, stairD: DEFAULT_STAIR.d
    });

    // 그룹화
    createGroup(name, [name + '_platform', name + '_shadow_bed', name + '_bed', name + '_shelf', name + '_frames', name + '_railing']);
    return this;
  }

  getName() {
    return this.name;
  }
}

// ============================================
// Legacy API (하위 호환성)
// ============================================

// Japandi 복층 원룸 인테리어 (완성 씬)
// name: 이름 프리픽스, wx/wy/wz: 월드 오프셋
// opts: { room: { w, d, h, floorT, wallT }, platform: { w, d, h } }
function japandiDuplex(name, wx, wy, wz, opts) {
  opts = opts || {};
  const builder = new JapandiDuplexBuilder(name)
    .setPosition(wx, wy, wz);

  if (opts.room) {
    if (opts.room.w !== undefined || opts.room.d !== undefined || opts.room.h !== undefined) {
      builder.setRoomSize(
        opts.room.w ?? DEFAULT_ROOM.w,
        opts.room.d ?? DEFAULT_ROOM.d,
        opts.room.h ?? DEFAULT_ROOM.h
      );
    }
    if (opts.room.floorT !== undefined) {
      builder.setFloorThickness(opts.room.floorT);
    }
    if (opts.room.wallT !== undefined) {
      builder.setWallThickness(opts.room.wallT);
    }
  }

  if (opts.platform) {
    builder.setPlatformSize(
      opts.platform.w ?? DEFAULT_PLATFORM.w,
      opts.platform.d ?? DEFAULT_PLATFORM.d,
      opts.platform.h ?? DEFAULT_PLATFORM.h
    );
  }

  builder.build();
}

// Japandi 거실 영역 - 격자벽 + TV + 소파 + 테이블
// name: 이름 프리픽스, wx/wy/wz: 중심 좌표
// opts: { w: 너비, d: 깊이, h: 높이 } (생략 시 빌더 기본값 사용)
function japandiLivingRoom(name, wx, wy, wz, opts) {
  opts = opts || {};
  const builder = new JapandiLivingRoomBuilder(name)
    .setPosition(wx, wy, wz);
  // 빌더가 기본값 소유 - opts가 제공된 경우만 오버라이드
  if (opts.w !== undefined || opts.d !== undefined || opts.h !== undefined) {
    builder.setSize(opts.w ?? builder.w, opts.d ?? builder.d, opts.h ?? builder.h);
  }
  builder.build();
}

// Japandi 복층 침실 - 플랫폼 + 침대 + 벽 장식 + 유리 난간
// name: 이름 프리픽스, wx/wy/wz: 코너 좌표
// opts: { platformW, platformD, platformH } (생략 시 빌더 기본값 사용)
function japandiMezzanine(name, wx, wy, wz, opts) {
  opts = opts || {};
  const builder = new JapandiMezzanineBuilder(name)
    .setPosition(wx, wy, wz);
  // 빌더가 기본값 소유 - opts가 제공된 경우만 오버라이드
  if (opts.platformW !== undefined || opts.platformD !== undefined || opts.platformH !== undefined) {
    builder.setPlatformSize(
      opts.platformW ?? builder.platformW,
      opts.platformD ?? builder.platformD,
      opts.platformH ?? builder.platformH
    );
  }
  builder.build();
}
