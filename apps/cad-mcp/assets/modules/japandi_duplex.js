// Japandi Duplex Interior - Complete Scene Module
// 복층 원룸 Japandi 스타일 인테리어 완성 씬
// - 나무 격자벽 거실 + 선큰 복층 침실
// - 미니멀한 가구 배치
//
// 사용법:
//   import 'japandi_duplex'
//   japandiDuplex('my_room', 0, 0, 0);
//
// 또는 개별 영역만:
//   japandiLivingRoom('living', 0, 0, 0, opts);
//   japandiMezzanine('mezz', x, y, z, opts);
//
// @builtin true
// @version 1.0.0

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

// ============================================
// 완성 씬: Japandi 복층 원룸
// ============================================

// Japandi 복층 원룸 인테리어 (완성 씬)
// name: 이름 프리픽스, wx/wy/wz: 월드 오프셋
// opts: { room: { w, d, h, floorT, wallT }, platform: { w, d, h } }
function japandiDuplex(name, wx, wy, wz, opts) {
  opts = opts || {};
  const room = { ...DEFAULT_ROOM, ...opts.room };
  const platform = { ...DEFAULT_PLATFORM, ...opts.platform };

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
    60, 50, 4,
    J.white
  );
  topLevelGroups.push(name + '_platform');

  // ==========================================
  // 6. 거실 가구
  // ==========================================
  const livingCX = wx - 80;

  // TV 스탠드 + 그림자
  furnitureShadow(name + '_shadow_tv', livingCX, wy + 98, 85, 28);
  tvStandSet(name + '_tv', livingCX, wy + 100, wz);

  // 커피 테이블 + 그림자
  furnitureShadow(name + '_shadow_table', livingCX, wy + 18, 65, 38);
  coffeeTable(name + '_table', livingCX, wy + 20, wz, 60, 35, 18);

  // 소파 + 그림자
  furnitureShadow(name + '_shadow_sofa', livingCX, wy - 40, 105, 55);
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
    stairW: 60,
    stairD: 50
  });
  topLevelGroups.push(name + '_railing');

  // ==========================================
  // 최상위 그룹
  // ==========================================
  createGroup(name, topLevelGroups);
}

// ============================================
// 부분 씬: 거실 영역만
// ============================================

// Japandi 거실 영역 - 격자벽 + TV + 소파 + 테이블
// name: 이름 프리픽스, wx/wy/wz: 중심 좌표
// opts: { w: 너비(140), d: 깊이(280), h: 높이(280) }
function japandiLivingRoom(name, wx, wy, wz, opts) {
  opts = opts || {};
  const w = opts.w || 140;
  const d = opts.d || 280;
  const h = opts.h || 280;

  // 격자벽
  woodLatticeWall(name + '_wall', wx - w/2, wx + w/2, wy + d/2, wz, h);

  // 가구
  tvStandSet(name + '_tv', wx, wy + d/2 - 40, wz);
  coffeeTable(name + '_table', wx, wy, wz, 60, 35, 18);
  sofa(name + '_sofa', wx, wy - 60, wz, 100, 50, 38, J.white);

  // 그룹화
  createGroup(name, [name + '_wall', name + '_tv', name + '_table', name + '_sofa']);
}

// ============================================
// 부분 씬: 복층 침실만
// ============================================

// Japandi 복층 침실 - 플랫폼 + 침대 + 벽 장식 + 유리 난간
// name: 이름 프리픽스, wx/wy/wz: 코너 좌표
// opts: { platformW(150), platformD(150), platformH(50) }
function japandiMezzanine(name, wx, wy, wz, opts) {
  opts = opts || {};
  const platformW = opts.platformW || 150;
  const platformD = opts.platformD || 150;
  const platformH = opts.platformH || 50;

  // 플랫폼
  sunkenPlatformWithStairs(
    name + '_platform',
    wx, wy,
    platformW, platformD, platformH,
    60, 50, 4,
    J.white
  );

  // 침대
  const bedCX = wx - platformW/2;
  const bedCY = wy - 60;
  bed(name + '_bed', bedCX, bedCY, wz + platformH, 95, 120, J.oak, J.white, 148);

  // 벽 장식
  floatingShelf(name + '_shelf', bedCX, wy - 1, wz + platformH + 65);
  wallFrameSet(name + '_frames', bedCX, wy - 1, wz + platformH + 95);

  // 유리 난간
  glassRailing(name + '_railing', wx - platformW, wy, platformW, platformD, wz + platformH, {
    stairW: 60, stairD: 50
  });

  // 그룹화
  createGroup(name, [name + '_platform', name + '_bed', name + '_shelf', name + '_frames', name + '_railing']);
}
