// Balcony Window
// 3분할 베란다 창문 컴포넌트
// - 프레임 + 창살 + 유리 패널
// - 좌우 미닫이문 + 중앙 고정창
//
// 사용법:
//   import 'balcony_window'
//   balconyWindow('window', 140, 0, 0, { w: 160, h: 200 });
//
// 조립 예시:
//   // 벽에 창문 배치 (벽 내부면 X좌표 사용)
//   box('wall', 150, 0, 0, 10, 200, 280, J.white);
//   balconyWindow('win', 144, 0, 0, { w: 160, h: 200 });
//
//   // 복층 위 작은 창문
//   balconyWindow('mezz_win', 144, 0, 100, { w: 80, h: 100 });
//
// @builtin true
// @version 1.0.0

// 의존성: interior_lib, japandi_palette (japandi_lib에서 로드)

// 3분할 베란다 창문
// name: 이름, x: 벽앞X, y: 창문중심Y, z0: 시작Z
// opts: { w: 너비(160), h: 높이(200), frameT: 프레임두께(4), mullionT: 창살두께(3),
//         depth: 프레임깊이(6), doorH: 문높이(180), frameColor, glassColor }
function balconyWindow(name, x, y, z0, opts) {
  opts = opts || {};
  const w = opts.w || 160;
  const h = opts.h || 200;
  const frameT = opts.frameT || 4;
  const mullionT = opts.mullionT || 3;
  const depth = opts.depth || 6;
  const doorH = opts.doorH || 180;
  const frameColor = opts.frameColor || J.white;
  const glassColor = opts.glassColor || japandiGlass;

  const entities = [];

  // 1. 외곽 프레임
  box(name + '_frame_b', x, y, z0 + frameT/2, depth, w, frameT, frameColor);
  box(name + '_frame_t', x, y, z0 + h - frameT/2, depth, w, frameT, frameColor);
  box(name + '_frame_l', x, y - w/2 + frameT/2, z0, depth, frameT, h, frameColor);
  box(name + '_frame_r', x, y + w/2 - frameT/2, z0, depth, frameT, h, frameColor);
  createGroup(name + '_frame', [name + '_frame_b', name + '_frame_t', name + '_frame_l', name + '_frame_r']);
  entities.push(name + '_frame');

  // 2. 창살 (3분할)
  const paneW = (w - frameT*2 - mullionT*2) / 3;
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
}
