// Glass Railing
// 유리 난간 컴포넌트
// - L자형 (복층/선큰 플랫폼용)
// - 계단 영역 제외
//
// 사용법:
//   import 'glass_railing'
//   glassRailing('railing', platformX, platformY, 150, 150, 50);
//
// 조립 예시:
//   // 복층 플랫폼 + 난간
//   import 'interior_lib'
//   sunkenPlatformWithStairs('platform', 100, 100, 150, 150, 50, 60, 50, 4, J.white);
//   glassRailing('railing', 100 - 150, 100, 150, 150, 50, { stairW: 60, stairD: 50 });
//
//   // 단순 직선 난간 (계단 없음)
//   glassRailing('simple', 0, 100, 200, 10, 0, { stairW: 0, stairD: 0 });
//
// @builtin true
// @version 1.0.0

// 의존성: interior_lib, japandi_palette (japandi_lib에서 로드)

// L자형 유리 난간 (복층용)
// name: 이름, platformX: 플랫폼 왼쪽X, platformY: 플랫폼 뒤쪽Y
// platformW/D: 플랫폼 크기, z: 바닥Z
// opts: { h: 높이(35), t: 두께(5), stairW: 계단너비(60), stairD: 계단깊이(50), color }
function glassRailing(name, platformX, platformY, platformW, platformD, z, opts) {
  opts = opts || {};
  const h = opts.h || 35;
  const t = opts.t || 5;
  const stairW = opts.stairW || 60;
  const stairD = opts.stairD || 50;
  const color = opts.color || japandiRailGlass;

  // 계단 경계
  const stairEndX = platformX + stairW;
  const stairEndY = platformY - (platformD - stairD);

  // 앞쪽 난간 (계단 옆)
  const frontW = (platformX + platformW) - stairEndX;
  const frontX = (stairEndX + platformX + platformW) / 2;
  const frontY = platformY - platformD + t/2;
  box(name + '_front', frontX, frontY, z, frontW, t, h, color);

  // 왼쪽 난간 (계단 위)
  const leftD = platformY - stairEndY;
  const leftX = platformX + t/2;
  const leftY = (stairEndY + platformY) / 2;
  box(name + '_left', leftX, leftY, z, t, leftD, h, color);

  // 그룹화
  createGroup(name, [name + '_front', name + '_left']);
}
