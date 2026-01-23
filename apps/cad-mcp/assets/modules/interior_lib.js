/**
 * Interior Design Library - Japandi Style
 * 
 * isometric 인테리어 기본 함수
 * - 색상: Japandi 팔레트 (오크/화이트/블랙)
 * - 스트로크 없음
 */

// ============================================
// Isometric 기본
// TODO: crossy_lib.js와 중복 - 향후 공유 유틸로 분리 고려
// ============================================
const ISO = Math.PI / 6;
const COS = Math.cos(ISO);
const SIN = Math.sin(ISO);

function toIso(x, y, z) {
  return [(x - y) * COS, (x + y) * SIN + z];
}

// ============================================
// Japandi 팔레트 (top/left/right)
// ============================================
const J = {
  // 라이트 오크 #D4A574
  oak: {
    t: [0.83, 0.65, 0.46, 1],
    l: [0.71, 0.55, 0.39, 1],
    r: [0.77, 0.60, 0.42, 1]
  },
  // 오프화이트 #F5F5F0
  white: {
    t: [0.96, 0.96, 0.94, 1],
    l: [0.82, 0.82, 0.80, 1],
    r: [0.89, 0.89, 0.87, 1]
  },
  // 블랙 #2C2C2C
  black: {
    t: [0.17, 0.17, 0.17, 1],
    l: [0.10, 0.10, 0.10, 1],
    r: [0.14, 0.14, 0.14, 1]
  },
  // 베이지 #E8DFD0
  beige: {
    t: [0.91, 0.87, 0.82, 1],
    l: [0.77, 0.74, 0.70, 1],
    r: [0.84, 0.81, 0.76, 1]
  },
  // 그린 #4A5D4A
  green: {
    t: [0.29, 0.36, 0.29, 1],
    l: [0.25, 0.31, 0.25, 1],
    r: [0.27, 0.34, 0.27, 1]
  },
  // 콘크리트 #B5B5B5
  concrete: {
    t: [0.71, 0.71, 0.71, 1],
    l: [0.60, 0.60, 0.60, 1],
    r: [0.66, 0.66, 0.66, 1]
  }
};

// ============================================
// 파츠 저장소 (스태킹용)
// ============================================
const _parts = {};

// ============================================
// 기본 박스 (스트로크 없음)
// ============================================
function box(name, wx, wy, wz, width, depth, height, color) {
  const hw = width / 2;
  const hd = depth / 2;
  
  const p = {
    bf: toIso(wx-hw, wy-hd, wz),
    br: toIso(wx+hw, wy-hd, wz),
    bb: toIso(wx+hw, wy+hd, wz),
    bl: toIso(wx-hw, wy+hd, wz),
    tf: toIso(wx-hw, wy-hd, wz+height),
    tr: toIso(wx+hw, wy-hd, wz+height),
    tb: toIso(wx+hw, wy+hd, wz+height),
    tl: toIso(wx-hw, wy+hd, wz+height)
  };
  
  // Top face
  drawPolygon(name+'_t', [p.tf[0],p.tf[1], p.tr[0],p.tr[1], p.tb[0],p.tb[1], p.tl[0],p.tl[1]]);
  setFill(name+'_t', color.t);
  setStroke(name+'_t', [0,0,0,0], 0);
  
  // Left face
  drawPolygon(name+'_l', [p.tf[0],p.tf[1], p.tl[0],p.tl[1], p.bl[0],p.bl[1], p.bf[0],p.bf[1]]);
  setFill(name+'_l', color.l);
  setStroke(name+'_l', [0,0,0,0], 0);
  
  // Right face
  drawPolygon(name+'_r', [p.tf[0],p.tf[1], p.tr[0],p.tr[1], p.br[0],p.br[1], p.bf[0],p.bf[1]]);
  setFill(name+'_r', color.r);
  setStroke(name+'_r', [0,0,0,0], 0);
  
  createGroup(name, [name+'_t', name+'_l', name+'_r']);
  
  // 좌표 저장
  _parts[name] = { wx, wy, wz, w: width, d: depth, h: height };
}

// ============================================
// 바닥 (top face만)
// ============================================
function floor(name, wx, wy, wz, width, depth, color) {
  const hw = width / 2;
  const hd = depth / 2;
  
  const p = {
    f: toIso(wx-hw, wy-hd, wz),
    r: toIso(wx+hw, wy-hd, wz),
    b: toIso(wx+hw, wy+hd, wz),
    l: toIso(wx-hw, wy+hd, wz)
  };
  
  drawPolygon(name, [p.f[0],p.f[1], p.r[0],p.r[1], p.b[0],p.b[1], p.l[0],p.l[1]]);
  setFill(name, color.t);
  setStroke(name, [0,0,0,0], 0);
  
  _parts[name] = { wx, wy, wz, w: width, d: depth, h: 0 };
}

// ============================================
// 벽 함수
// ============================================

/**
 * 뒤쪽 벽 (Back Wall)
 * - Y축 고정, X축 방향으로 확장
 * - 화면에서: 왼쪽 위 → 오른쪽 위 방향
 * - 보이는 면: -Y 방향 (right shading 사용)
 */
function wallBack(name, wx, wy, wz, width, height, color) {
  const hw = width / 2;
  
  // 4개 꼭지점: X축 방향으로 펼쳐진 수직면
  const p = {
    bl: toIso(wx-hw, wy, wz),          // bottom left
    br: toIso(wx+hw, wy, wz),          // bottom right
    tl: toIso(wx-hw, wy, wz+height),   // top left
    tr: toIso(wx+hw, wy, wz+height)    // top right
  };
  
  // 폴리곤: 시계방향 (tl → tr → br → bl)
  drawPolygon(name, [p.tl[0],p.tl[1], p.tr[0],p.tr[1], p.br[0],p.br[1], p.bl[0],p.bl[1]]);
  setFill(name, color.r);  // -Y 방향 면 = right shading
  setStroke(name, [0,0,0,0], 0);
  
  _parts[name] = { wx, wy, wz, w: width, d: 0, h: height };
}

/**
 * 옆쪽 벽 (Side Wall) 
 * - X축 고정, Y축 방향으로 확장
 * - 화면에서: 오른쪽 위 → 오른쪽 아래 방향
 * - 보이는 면: -X 방향 (left shading 사용)
 */
function wallSide(name, wx, wy, wz, depth, height, color) {
  const hd = depth / 2;
  
  // 4개 꼭지점: Y축 방향으로 펼쳐진 수직면
  const p = {
    bf: toIso(wx, wy-hd, wz),          // bottom front
    bb: toIso(wx, wy+hd, wz),          // bottom back
    tf: toIso(wx, wy-hd, wz+height),   // top front
    tb: toIso(wx, wy+hd, wz+height)    // top back
  };
  
  // 폴리곤: 시계방향 (tf → tb → bb → bf)
  drawPolygon(name, [p.tf[0],p.tf[1], p.tb[0],p.tb[1], p.bb[0],p.bb[1], p.bf[0],p.bf[1]]);
  setFill(name, color.l);  // -X 방향 면 = left shading
  setStroke(name, [0,0,0,0], 0);
  
  _parts[name] = { wx, wy, wz, w: 0, d: depth, h: height };
}

/**
 * @deprecated Use wallBack instead
 */
function wallLeft(name, wx, wy, wz, width, height, color) {
  wallBack(name, wx, wy, wz, width, height, color);
}

/**
 * @deprecated Use wallSide instead
 */
function wallRight(name, wx, wy, wz, depth, height, color) {
  wallSide(name, wx, wy, wz, depth, height, color);
}

// ============================================
// 원목 마루 바닥 (Wood Plank Floor)
// ============================================

/**
 * 원목 마루 바닥 - 마루판 패턴
 * @param {string} name - 이름
 * @param {number} wx, wy, wz - 중심 좌표
 * @param {number} width, depth - 크기
 * @param {number} plankWidth - 마루판 너비 (기본 20)
 * @param {object} color - 색상 (J.oak 등)
 */
function woodFloor(name, wx, wy, wz, width, depth, plankWidth, color) {
  // || 사용: plankWidth=0은 무의미하므로 falsy 체크로 충분
  plankWidth = plankWidth || 20;
  
  const hw = width / 2;
  const hd = depth / 2;
  const entities = [];
  
  // 마루판 색상 변형 (밝은/어두운 교차)
  const colorLight = color.t;
  const colorDark = [
    color.t[0] * 0.92,
    color.t[1] * 0.92,
    color.t[2] * 0.92,
    1
  ];
  
  // TODO: 마루판 간 틈새 렌더링 시 사용 (현재 미사용)
  // const gapColor = [
  //   color.t[0] * 0.7,
  //   color.t[1] * 0.7,
  //   color.t[2] * 0.7,
  //   1
  // ];
  
  // Y축 방향으로 마루판 배치 (화면에서 왼쪽위→오른쪽아래 방향)
  const plankCount = Math.ceil(depth / plankWidth);
  const gapWidth = 1;  // 틈새 너비
  
  for (let i = 0; i < plankCount; i++) {
    const py = wy - hd + plankWidth/2 + i * plankWidth;
    
    if (py - plankWidth/2 > wy + hd) break;
    
    const plankName = name + '_p' + i;
    const actualWidth = Math.min(plankWidth - gapWidth, (wy + hd) - (py - plankWidth/2));
    
    // 마루판 상단면
    const p = {
      f: toIso(wx - hw, py - actualWidth/2, wz),
      r: toIso(wx + hw, py - actualWidth/2, wz),
      b: toIso(wx + hw, py + actualWidth/2, wz),
      l: toIso(wx - hw, py + actualWidth/2, wz)
    };
    
    drawPolygon(plankName, [p.f[0],p.f[1], p.r[0],p.r[1], p.b[0],p.b[1], p.l[0],p.l[1]]);
    
    // 밝은/어두운 색상 교차
    const plankColor = (i % 2 === 0) ? colorLight : colorDark;
    setFill(plankName, plankColor);
    setStroke(plankName, [0,0,0,0], 0);
    
    entities.push(plankName);
  }
  
  createGroup(name, entities);
  _parts[name] = { wx, wy, wz, w: width, d: depth, h: 0 };
}

/**
 * 두께가 있는 원목 마루 바닥
 */
function woodFloorSlab(name, wx, wy, wz, width, depth, height, plankWidth, color) {
  plankWidth = plankWidth || 20;
  const hw = width / 2;
  const hd = depth / 2;
  const entities = [];
  
  // 측면 (Left face - X축 최소)
  const pLeft = {
    tf: toIso(wx-hw, wy-hd, wz+height),
    tl: toIso(wx-hw, wy+hd, wz+height),
    bl: toIso(wx-hw, wy+hd, wz),
    bf: toIso(wx-hw, wy-hd, wz)
  };
  drawPolygon(name+'_l', [pLeft.tf[0],pLeft.tf[1], pLeft.tl[0],pLeft.tl[1], pLeft.bl[0],pLeft.bl[1], pLeft.bf[0],pLeft.bf[1]]);
  setFill(name+'_l', color.l);
  setStroke(name+'_l', [0,0,0,0], 0);
  entities.push(name+'_l');
  
  // 측면 (Right face - Y축 최소)
  const pRight = {
    tf: toIso(wx-hw, wy-hd, wz+height),
    tr: toIso(wx+hw, wy-hd, wz+height),
    br: toIso(wx+hw, wy-hd, wz),
    bf: toIso(wx-hw, wy-hd, wz)
  };
  drawPolygon(name+'_r', [pRight.tf[0],pRight.tf[1], pRight.tr[0],pRight.tr[1], pRight.br[0],pRight.br[1], pRight.bf[0],pRight.bf[1]]);
  setFill(name+'_r', color.r);
  setStroke(name+'_r', [0,0,0,0], 0);
  entities.push(name+'_r');
  
  // 상단 마루판 패턴
  const colorLight = color.t;
  const colorDark = [color.t[0]*0.92, color.t[1]*0.92, color.t[2]*0.92, 1];
  
  const plankCount = Math.ceil(depth / plankWidth);
  const gapWidth = 1;
  
  for (let i = 0; i < plankCount; i++) {
    const py = wy - hd + plankWidth/2 + i * plankWidth;
    if (py - plankWidth/2 > wy + hd) break;
    
    const plankName = name + '_p' + i;
    const actualDepth = Math.min(plankWidth - gapWidth, (wy + hd) - (py - plankWidth/2 + gapWidth/2));
    
    const p = {
      f: toIso(wx - hw, py - actualDepth/2, wz + height),
      r: toIso(wx + hw, py - actualDepth/2, wz + height),
      b: toIso(wx + hw, py + actualDepth/2, wz + height),
      l: toIso(wx - hw, py + actualDepth/2, wz + height)
    };
    
    drawPolygon(plankName, [p.f[0],p.f[1], p.r[0],p.r[1], p.b[0],p.b[1], p.l[0],p.l[1]]);
    setFill(plankName, (i % 2 === 0) ? colorLight : colorDark);
    setStroke(plankName, [0,0,0,0], 0);
    entities.push(plankName);
  }
  
  createGroup(name, entities);
  _parts[name] = { wx, wy, wz, w: width, d: depth, h: height };
}

// ============================================
// 파케이 마루 (Parquet Floor - 작은 블록 패턴)
// ============================================

// ============================================
// 벽 코너 기준 박스
// ============================================

/**
 * 벽 코너 기준 박스
 * - 박스의 뒤쪽 코너(+X,+Y)가 벽 코너에 위치
 * 
 * @param {string} name - 이름
 * @param {number} cornerX, cornerY - 벽 코너 좌표 (내부면)
 * @param {number} width - X방향 크기
 * @param {number} depth - Y방향 크기
 * @param {number} height - Z방향 크기
 * @param {object} color - 색상
 */
function boxAtWallCorner(name, cornerX, cornerY, width, depth, height, color) {
  const cx = cornerX - width/2;
  const cy = cornerY - depth/2;
  box(name, cx, cy, 0, width, depth, height, color);
}

// ============================================
// 선큰 플랫폼 + 계단 (Sunken Platform with Stairs)
// ============================================

/**
 * L자형 선큰 플랫폼 + 계단
 * - 복층, 선큰 구조에 사용
 * - 앞쪽 왼편에 계단 배치 (벽 코너 기준)
 * 
 * 구조:
 *   ┌──────────────┐
 *   │  back (full) │  ← 뒤쪽 전체 너비
 *   ├────┬─────────┤
 *   │stair│ front  │  ← 앞쪽: 계단 + 플랫폼
 *   └────┴─────────┘
 * 
 * @param {string} name - 기본 이름
 * @param {number} cornerX, cornerY - 벽 코너 좌표 (WALL_INNER)
 * @param {number} platformW - 플랫폼 너비 (X방향)
 * @param {number} platformD - 플랫폼 깊이 (Y방향)
 * @param {number} platformH - 플랫폼 높이
 * @param {number} stairW - 계단 전체 너비
 * @param {number} stairD - 계단 깊이
 * @param {number} steps - 계단 수
 * @param {object} color - 색상 (J.white 등)
 */
function sunkenPlatformWithStairs(name, cornerX, cornerY, platformW, platformD, platformH, stairW, stairD, steps, color) {
  // 입력 검증: 모든 치수가 양수여야 함
  if (platformW <= 0 || platformD <= 0 || platformH <= 0) {
    createGroup(name, []);
    return;
  }
  if (stairW <= 0 || stairD <= 0) {
    createGroup(name, []);
    return;
  }
  // 계단이 플랫폼보다 클 수 없음
  if (stairW >= platformW || stairD >= platformD) {
    createGroup(name, []);
    return;
  }

  const entities = [];
  const validSteps = Math.max(1, steps);

  // L자형 플랫폼 계산
  const backD = platformD - stairD;
  
  // 1. 뒷쪽 플랫폼 (back) - 전체 너비
  const backName = name + '_back';
  boxAtWallCorner(backName, cornerX, cornerY, platformW, backD, platformH, color);
  entities.push(backName);
  
  // 2. 앞쪽 플랫폼 (front) - 계단 옆 (벽쪽)
  const frontW = platformW - stairW;
  const frontX = cornerX - frontW/2;
  const frontY = cornerY - backD - stairD/2;
  const frontName = name + '_front';
  box(frontName, frontX, frontY, 0, frontW, stairD, platformH, color);
  entities.push(frontName);
  
  // 3. 계단 (z-order: 뒤쪽 먼저 → 앞쪽 나중에)
  const stairY = cornerY - backD - stairD/2;
  const stairLeftX = cornerX - platformW;
  const stepW = stairW / validSteps;
  const stepH = platformH / validSteps;
  
  for (let i = validSteps - 1; i >= 0; i--) {
    const stepX = stairLeftX + (i + 0.5) * stepW;
    const stepHeight = (i + 1) * stepH;  // Solid from Z=0
    const stairName = name + '_stair_' + (i + 1);
    box(stairName, stepX, stairY, 0, stepW, stairD, stepHeight, color);
    entities.push(stairName);
  }
  
  createGroup(name, entities);
  _parts[name] = { 
    wx: cornerX - platformW/2, 
    wy: cornerY - platformD/2, 
    wz: 0, 
    w: platformW, 
    d: platformD, 
    h: platformH 
  };
}

// ============================================
// 파케이 마루 (Parquet Floor - 작은 블록 패턴)
// ============================================

/**
 * 파케이 마루 - 바스켓위브 패턴 (블록 방향 교차)
 * @param {string} name - 이름
 * @param {number} wx, wy, wz - 중심 좌표
 * @param {number} width, depth - 전체 크기
 * @param {number} blockSize - 블록 묶음 크기 (기본 30)
 * @param {number} plankCount - 묶음당 판자 수 (기본 3)
 * @param {object} color - 색상 (J.oak 등)
 */
function parquetFloor(name, wx, wy, wz, width, depth, blockSize, plankCount, color) {
  // 검증: 0/음수 방지 (Infinity/무한루프 방지)
  blockSize = (blockSize && blockSize > 0) ? blockSize : 30;
  plankCount = (plankCount && plankCount > 0) ? plankCount : 3;

  // 유효하지 않은 영역이면 빈 그룹 반환
  if (width <= 0 || depth <= 0) {
    createGroup(name, []);
    return;
  }

  const hw = width / 2;
  const hd = depth / 2;
  const entities = [];
  const gap = 0;  // 틈새 없음

  const plankSize = blockSize / plankCount;
  
  // 블록 묶음 단위로 배치
  const countX = Math.ceil(width / blockSize);
  const countY = Math.ceil(depth / blockSize);

  let idx = 0;
  for (let bx = 0; bx < countX; bx++) {
    for (let by = 0; by < countY; by++) {
      const cx = wx - hw + blockSize/2 + bx * blockSize;
      const cy = wy - hd + blockSize/2 + by * blockSize;
      
      // 체스판 패턴으로 방향 결정
      const horizontal = (bx + by) % 2 === 0;
      
      for (let i = 0; i < plankCount; i++) {
        let px, py, pw, pd;
        
        if (horizontal) {
          px = cx;
          py = cy - blockSize/2 + plankSize/2 + i * plankSize;
          pw = blockSize - gap;
          pd = plankSize - gap;
        } else {
          px = cx - blockSize/2 + plankSize/2 + i * plankSize;
          py = cy;
          pw = plankSize - gap;
          pd = blockSize - gap;
        }
        
        // 경계 체크
        if (px - pw/2 < wx - hw - 1 || px + pw/2 > wx + hw + 1) continue;
        if (py - pd/2 < wy - hd - 1 || py + pd/2 > wy + hd + 1) continue;
        
        const x1 = Math.max(px - pw/2, wx - hw);
        const x2 = Math.min(px + pw/2, wx + hw);
        const y1 = Math.max(py - pd/2, wy - hd);
        const y2 = Math.min(py + pd/2, wy + hd);
        
        if (x2 - x1 < 2 || y2 - y1 < 2) continue;
        
        const plankName = name + '_p' + idx;
        
        const p = {
          f: toIso(x1, y1, wz),
          r: toIso(x2, y1, wz),
          b: toIso(x2, y2, wz),
          l: toIso(x1, y2, wz)
        };
        
        drawPolygon(plankName, [p.f[0],p.f[1], p.r[0],p.r[1], p.b[0],p.b[1], p.l[0],p.l[1]]);
        
        // color 파라미터에서 톤 팔레트 생성
        const baseColor = color || [0.82, 0.62, 0.38, 1];  // 기본: 오크색
        const r = baseColor[0], g = baseColor[1], b = baseColor[2], a = baseColor[3] ?? 1;

        // 밝은 톤 변형 (3단계)
        const lightTones = [
          [Math.min(1, r * 1.05), Math.min(1, g * 1.05), Math.min(1, b * 1.05), a],
          [Math.min(1, r * 1.00), Math.min(1, g * 1.00), Math.min(1, b * 1.00), a],
          [Math.min(1, r * 0.97), Math.min(1, g * 0.97), Math.min(1, b * 0.97), a],
          [Math.min(1, r * 0.95), Math.min(1, g * 0.95), Math.min(1, b * 0.95), a],
        ];
        // 어두운 포인트 톤 (20% 어둡게)
        const darkTone = [r * 0.80, g * 0.80, b * 0.80, a];
        
        // 밝은 색 순차 배치, 10개마다 어두운 포인트
        let plankColor;
        if (idx % 10 === 5) {
          plankColor = darkTone;
        } else {
          plankColor = lightTones[idx % lightTones.length];
        }
        setFill(plankName, plankColor);
        setStroke(plankName, [0,0,0,0], 0);
        
        entities.push(plankName);
        idx++;
      }
    }
  }
  
  createGroup(name, entities);
  _parts[name] = { wx, wy, wz, w: width, d: depth, h: 0 };
}
