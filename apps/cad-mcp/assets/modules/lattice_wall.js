// Wood Lattice Wall
// 나무 격자벽 컴포넌트
// - 세로/가로 격자 바 + 4면 프레임 캡
// - Japandi/스칸디 스타일 공간 분리용
//
// 사용법:
//   import 'lattice_wall'
//   woodLatticeWall('my_wall', -100, 100, 140, 0, 280);
//
// 조립 예시:
//   // 거실과 침실 분리
//   woodLatticeWall('divider', -50, 50, 0, 0, 200);
//   sofa('sofa', 0, -60, 0, 80, 40, 35, J.white);
//
//   // 복층 난간 겸용
//   woodLatticeWall('mezz_wall', 0, 100, 50, 60, 100, { rows: 6 });
//
// @builtin true
// @version 1.0.0

// 의존성: interior_lib, japandi_palette (japandi_lib에서 로드)

// 나무 격자벽 with 프레임
// name: 이름, x0/x1: 시작/끝 X좌표, y: 벽 내부면Y, z0: 바닥Z, height: 높이
// opts: { frameT: 격자두께(4), outerT: 프레임두께(10), capDepth: 캡깊이(10),
//         cols: 세로칸수(8), rows: 가로칸수(16), color }
function woodLatticeWall(name, x0, x1, y, z0, height, opts) {
  opts = opts || {};

  // 입력 검증 및 정규화
  if (x1 < x0) { const tmp = x0; x0 = x1; x1 = tmp; }  // x0/x1 순서 보장
  if (height <= 0) { createGroup(name, []); return; }   // 유효하지 않은 높이

  const frameT = typeof opts.frameT === 'number' ? opts.frameT : 4;
  const outerT = typeof opts.outerT === 'number' ? opts.outerT : 10;
  const capDepth = typeof opts.capDepth === 'number' ? opts.capDepth : 10;
  // cols/rows 최소값 검증 (0이나 음수 시 Infinity/NaN 방지)
  const cols = Math.max(1, typeof opts.cols === 'number' ? opts.cols : 8);
  const rows = Math.max(1, typeof opts.rows === 'number' ? opts.rows : 16);
  const color = opts.color || japandiOak;

  const width = x1 - x0;
  if (width <= 0) { createGroup(name, []); return; }    // 유효하지 않은 너비
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
}
