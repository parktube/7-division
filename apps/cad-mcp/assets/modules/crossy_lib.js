/**
 * Crossy Road 스타일 - 핵심 함수만
 */
const ISO = Math.PI / 6;
const COS = Math.cos(ISO);
const SIN = Math.sin(ISO);

function toIso(x, y, z) {
  return [(x - y) * COS, (x + y) * SIN + z];
}

// 박스 (직육면체)
function box(name, wx, wy, wz, width, depth, height, tC, lC, rC) {
  const hw = width / 2;
  const hd = depth / 2;
  
  const p = {
    bf: toIso(wx-hw, wy-hd, wz), br: toIso(wx+hw, wy-hd, wz),
    bb: toIso(wx+hw, wy+hd, wz), bl: toIso(wx-hw, wy+hd, wz),
    tf: toIso(wx-hw, wy-hd, wz+height), tr: toIso(wx+hw, wy-hd, wz+height),
    tb: toIso(wx+hw, wy+hd, wz+height), tl: toIso(wx-hw, wy+hd, wz+height),
  };
  
  drawPolygon(name+'_t', [p.tf[0],p.tf[1], p.tr[0],p.tr[1], p.tb[0],p.tb[1], p.tl[0],p.tl[1]]);
  setFill(name+'_t', tC); setStroke(name+'_t', [0,0,0,0], 0);
  
  drawPolygon(name+'_l', [p.tf[0],p.tf[1], p.tl[0],p.tl[1], p.bl[0],p.bl[1], p.bf[0],p.bf[1]]);
  setFill(name+'_l', lC); setStroke(name+'_l', [0,0,0,0], 0);
  
  drawPolygon(name+'_r', [p.tf[0],p.tf[1], p.tr[0],p.tr[1], p.br[0],p.br[1], p.bf[0],p.bf[1]]);
  setFill(name+'_r', rC); setStroke(name+'_r', [0,0,0,0], 0);
  
  createGroup(name, [name+'_r', name+'_t', name+'_l']);
}

// 팔레트 (l/r 바꿈: 앞면(l)이 밝게)
const C = {
  white:  {t:[1.00,1.00,1.00,1], l:[0.90,0.90,0.90,1], r:[0.82,0.82,0.82,1]},
  pink:   {t:[0.95,0.55,0.65,1], l:[0.85,0.48,0.58,1], r:[0.78,0.42,0.52,1]},
  black:  {t:[0.08,0.08,0.08,1], l:[0.05,0.05,0.05,1], r:[0.02,0.02,0.02,1]},
  brown:  {t:[0.65,0.45,0.25,1], l:[0.58,0.40,0.22,1], r:[0.50,0.35,0.18,1]},
  orange: {t:[0.95,0.65,0.30,1], l:[0.85,0.58,0.26,1], r:[0.78,0.50,0.22,1]},
  gray:   {t:[0.60,0.60,0.60,1], l:[0.52,0.52,0.52,1], r:[0.45,0.45,0.45,1]},
  cream:  {t:[0.98,0.92,0.80,1], l:[0.92,0.85,0.72,1], r:[0.85,0.78,0.65,1]},
};

// 파츠 저장소
const _parts = {};

// 박스 생성 + 좌표 저장
function box3d(name, wx, wy, wz, width, depth, height, tC, lC, rC) {
  _parts[name] = { wx, wy, wz, w: width, d: depth, h: height, tC, lC, rC };
  box(name, wx, wy, wz, width, depth, height, tC, lC, rC);
}

// 파츠 위에 스태킹할 Z 좌표
function stackZ(baseName, gap) {
  const p = _parts[baseName];
  return p ? p.wz + p.h + (gap || 0) : 0;
}

// 깊이 정렬 (엔티티/그룹 내부용)
function sortByDepth() {
  const names = Array.prototype.slice.call(arguments);
  const valid = names.filter(function(n) { return _parts[n]; });
  if (valid.length < 2) return;
  
  valid.sort(function(a, b) {
    const pa = _parts[a], pb = _parts[b];
    return (pa.wx - pa.wy + pa.wz) - (pb.wx - pb.wy + pb.wz);
  });
  
  for (let i = 0; i < valid.length; i++) {
    drawOrder(valid[i], 'front');
  }
}

// ============================================
// 이소메트릭 그룹 z-order 정렬
// ============================================
// 알고리즘: depth = x + y (screenY에 비례)
// 내림차순 정렬 후 drawOrder('front') 루프
// → 화면 위쪽(depth 작음)이 뒤로, 아래쪽(depth 큼)이 앞으로

const _isoGroups = [];

/**
 * 이소메트릭 정렬용 그룹 등록
 * @param {string} groupName - 그룹 이름
 * @param {number} x - 월드 X 좌표
 * @param {number} y - 월드 Y 좌표
 */
function registerIsoGroup(groupName, x, y) {
  _isoGroups.push({ name: groupName, x: x, y: y, depth: x + y });
}

/**
 * 등록된 그룹들을 이소메트릭 깊이로 정렬
 * 화면 위쪽(작은 depth)이 뒤로, 아래쪽(큰 depth)이 앞으로
 */
function sortIsoGroups() {
  if (_isoGroups.length < 2) {
    _isoGroups.length = 0;
    return;
  }
  
  // 내림차순 정렬 (큰 depth부터)
  _isoGroups.sort(function(a, b) { return b.depth - a.depth; });
  
  // front로 밀어서 마지막이 맨 앞
  for (let i = 0; i < _isoGroups.length; i++) {
    drawOrder(_isoGroups[i].name, 'front');
  }
  
  // 다음 실행을 위해 초기화
  _isoGroups.length = 0;
}
