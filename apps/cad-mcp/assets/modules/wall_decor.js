// Wall Decoration
// 벽 장식 컴포넌트 모음
// - 플로팅 선반, 벽 액자
//
// 사용법:
//   import 'wall_decor'
//   floatingShelf('shelf', 0, 140, 100);
//   wallFrameSet('frames', 0, 140, 130);
//
// 조립 예시:
//   // 침대 위 벽 장식
//   bed('bed', 0, 80, 0, 95, 120, J.oak, J.white, 148);
//   floatingShelf('shelf', 0, 140, 65, { w: 100 });
//   wallFrameSet('frames', 0, 140, 95);
//
//   // 거실 벽 갤러리
//   wallFrame('art1', -50, 140, 80, { w: 40, h: 50, artColor: artBeige });
//   wallFrame('art2', 0, 140, 90, { w: 30, h: 30, artColor: artWhite });
//   wallFrame('art3', 40, 140, 75, { w: 35, h: 45, artColor: artBeige });
//
// @builtin true
// @version 1.0.0

import 'interior_lib'
import 'japandi_palette'

// 플로팅 선반
// name: 이름, x: 중심X, y: 벽앞Y, z: 높이
// opts: { w: 너비(100), d: 깊이(12), h: 두께(3), color: 색상 }
function floatingShelf(name, x, y, z, opts) {
  opts = opts || {};
  const w = opts.w || 100;
  const d = opts.d || 12;
  const h = opts.h || 3;
  const color = opts.color || J.oak;

  box(name, x, y - d/2, z, w, d, h, color);
}

// 벽 액자 (단일)
// name: 이름, x: 중심X, y: 벽Y, z: 하단Z
// opts: { w: 너비(24), h: 높이(32), frameT: 프레임두께(3), depth: 깊이(3), frameColor, artColor }
function wallFrame(name, x, y, z, opts) {
  opts = opts || {};
  const w = opts.w || 24;
  const h = opts.h || 32;
  const frameT = opts.frameT || 3;
  const depth = opts.depth || 3;
  const frameColor = opts.frameColor || J.white;
  const artColor = opts.artColor || artBeige;

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
}

// 벽 액자 세트 (3개)
// Japandi 스타일: 다양한 크기와 배치
// name: 이름, centerX: 중심X, y: 벽Y, z: 하단Z
// opts: { spacing: 간격(35) }
function wallFrameSet(name, centerX, y, z, opts) {
  opts = opts || {};
  const spacing = opts.spacing || 35;

  // 왼쪽 - 세로 직사각형
  wallFrame(name + '_1', centerX - spacing, y, z, {
    w: 24, h: 32, artColor: artBeige
  });

  // 중앙 - 정사각형 (큰 것)
  wallFrame(name + '_2', centerX, y, z, {
    w: 30, h: 30, artColor: artWhite
  });

  // 오른쪽 - 가로 직사각형 (살짝 높게)
  wallFrame(name + '_3', centerX + spacing + 3, y, z + 6, {
    w: 28, h: 20, artColor: artBeige
  });

  // 그룹화
  createGroup(name, [name + '_1', name + '_2', name + '_3']);
}
