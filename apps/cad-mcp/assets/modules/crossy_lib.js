// Crossy Road 스타일 - 이소메트릭 3D 복셀 라이브러리
// 레거시 함수 API

// ============================================
// Constants
// ============================================
var ISO = Math.PI / 6;
var COS = Math.cos(ISO);
var SIN = Math.sin(ISO);

// 팔레트 (l/r 바꿈: 앞면(l)이 밝게)
var C = {
  white:  {t:[1.00,1.00,1.00,1], l:[0.90,0.90,0.90,1], r:[0.82,0.82,0.82,1]},
  pink:   {t:[0.95,0.55,0.65,1], l:[0.85,0.48,0.58,1], r:[0.78,0.42,0.52,1]},
  black:  {t:[0.08,0.08,0.08,1], l:[0.05,0.05,0.05,1], r:[0.02,0.02,0.02,1]},
  brown:  {t:[0.65,0.45,0.25,1], l:[0.58,0.40,0.22,1], r:[0.50,0.35,0.18,1]},
  orange: {t:[0.95,0.65,0.30,1], l:[0.85,0.58,0.26,1], r:[0.78,0.50,0.22,1]},
  gray:   {t:[0.60,0.60,0.60,1], l:[0.52,0.52,0.52,1], r:[0.45,0.45,0.45,1]},
  cream:  {t:[0.98,0.92,0.80,1], l:[0.92,0.85,0.72,1], r:[0.85,0.78,0.65,1]},
};

// ============================================
// 공유 상태
// ============================================
var _parts = {};
var _isoGroups = [];

function clearParts() {
  for (var key in _parts) {
    delete _parts[key];
  }
}

// 파츠 정보 조회 (파생 모듈/디버깅용)
function getPartInfo(name) {
  var p = _parts[name];
  if (!p) return null;
  // 얕은 복사로 내부 상태 변조 방지
  return {
    wx: p.wx, wy: p.wy, wz: p.wz,
    w: p.w, d: p.d, h: p.h,
    tC: p.tC, lC: p.lC, rC: p.rC
  };
}

// ============================================
// 함수 API
// ============================================

// 월드 좌표를 이소메트릭 화면 좌표로 변환
function toIso(x, y, z) {
  return [(x - y) * COS, (x + y) * SIN + z];
}

// 박스 (직육면체) 생성
function box(name, wx, wy, wz, width, depth, height, tC, lC, rC) {
  var hw = width / 2;
  var hd = depth / 2;

  var p = {
    bf: toIso(wx-hw, wy-hd, wz), br: toIso(wx+hw, wy-hd, wz),
    bb: toIso(wx+hw, wy+hd, wz), bl: toIso(wx-hw, wy+hd, wz),
    tf: toIso(wx-hw, wy-hd, wz+height), tr: toIso(wx+hw, wy-hd, wz+height),
    tb: toIso(wx+hw, wy+hd, wz+height), tl: toIso(wx-hw, wy+hd, wz+height)
  };

  drawPolygon(name+'_l', [p.tf[0],p.tf[1], p.tl[0],p.tl[1], p.bl[0],p.bl[1], p.bf[0],p.bf[1]]);
  setFill(name+'_l', lC); setStroke(name+'_l', [0,0,0,0], 0);

  drawPolygon(name+'_r', [p.tr[0],p.tr[1], p.tb[0],p.tb[1], p.bb[0],p.bb[1], p.br[0],p.br[1]]);
  setFill(name+'_r', rC); setStroke(name+'_r', [0,0,0,0], 0);

  // 그룹 내부 z-order는 createGroup() 시점의 z_index(생성 순서)에 의해 정렬된다.
  // 따라서 뒤→앞 렌더링을 보장하려면 면을 뒤→앞 순서로 생성해야 한다: _l/_r → _t(최상단)
  drawPolygon(name+'_t', [p.tf[0],p.tf[1], p.tr[0],p.tr[1], p.tb[0],p.tb[1], p.tl[0],p.tl[1]]);
  setFill(name+'_t', tC); setStroke(name+'_t', [0,0,0,0], 0);

  createGroup(name, [name+'_l', name+'_r', name+'_t']);
}

// 박스 생성 + 좌표 저장 (스태킹용)
function box3d(name, wx, wy, wz, width, depth, height, tC, lC, rC) {
  _parts[name] = { wx: wx, wy: wy, wz: wz, w: width, d: depth, h: height, tC: tC, lC: lC, rC: rC };
  box(name, wx, wy, wz, width, depth, height, tC, lC, rC);
}

// 파츠 위에 스태킹할 Z 좌표 반환
function stackZ(baseName, gap) {
  var p = _parts[baseName];
  return p ? p.wz + p.h + (gap || 0) : 0;
}

// 깊이 기준 정렬 (3D 박스 겹침용)
function sortByDepth() {
  var names = Array.prototype.slice.call(arguments);
  var valid = names.filter(function(n) { return _parts[n]; });
  if (valid.length < 2) return;

  valid.sort(function(a, b) {
    var pa = _parts[a], pb = _parts[b];
    return (pa.wx - pa.wy + pa.wz) - (pb.wx - pb.wy + pb.wz);
  });

  for (var i = 0; i < valid.length; i++) {
    drawOrder(valid[i], 'front');
  }
}

// 이소메트릭 정렬용 그룹 등록
function registerIsoGroup(groupName, x, y) {
  _isoGroups.push({ name: groupName, x: x, y: y, depth: x + y });
}

// 등록된 그룹들을 이소메트릭 깊이로 정렬
function sortIsoGroups() {
  if (_isoGroups.length < 2) {
    clearParts();
    _isoGroups.length = 0;
    return;
  }

  // 오름차순 정렬 (작은 depth부터) → 큰 depth(화면 위쪽)가 마지막에 front로 이동하여 최전면
  _isoGroups.sort(function(a, b) { return a.depth - b.depth; });

  for (var i = 0; i < _isoGroups.length; i++) {
    drawOrder(_isoGroups[i].name, 'front');
  }

  clearParts();
  _isoGroups.length = 0;
}
