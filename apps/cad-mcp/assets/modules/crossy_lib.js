/**
 * Crossy Road 스타일 - 이소메트릭 3D 복셀 라이브러리
 *
 * 클래스 기반 API와 레거시 함수 API 모두 제공
 *
 * @example 클래스 사용
 * const crossy = new CrossyLib();
 * crossy.box3d('myBox', 0, 0, 0, 10, 10, 10, C.white);
 * crossy.sortByDepth('myBox', 'otherBox');
 *
 * @example 레거시 함수 사용 (하위 호환)
 * box3d('myBox', 0, 0, 0, 10, 10, 10, C.white.t, C.white.l, C.white.r);
 * sortByDepth('myBox', 'otherBox');
 */

// ============================================
// Constants
// ============================================
const ISO = Math.PI / 6;
const COS = Math.cos(ISO);
const SIN = Math.sin(ISO);

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

// ============================================
// CrossyLib Class
// ============================================

/**
 * Crossy Road 스타일 이소메트릭 3D 라이브러리
 *
 * 인스턴스별로 파츠 저장소와 이소메트릭 그룹을 관리
 */
class CrossyLib {
  constructor() {
    this._parts = {};
    this._isoGroups = [];
  }

  /**
   * 월드 좌표를 이소메트릭 화면 좌표로 변환
   */
  static toIso(x, y, z) {
    return [(x - y) * COS, (x + y) * SIN + z];
  }

  /**
   * 박스 (직육면체) 생성
   * @param {string} name - 엔티티 이름
   * @param {number} wx, wy, wz - 월드 좌표
   * @param {number} width, depth, height - 크기
   * @param {object} color - 색상 객체 {t, l, r} 또는 개별 배열
   */
  box(name, wx, wy, wz, width, depth, height, color) {
    const tC = color.t || color;
    const lC = color.l || color;
    const rC = color.r || color;

    const hw = width / 2;
    const hd = depth / 2;

    const p = {
      bf: CrossyLib.toIso(wx-hw, wy-hd, wz), br: CrossyLib.toIso(wx+hw, wy-hd, wz),
      bb: CrossyLib.toIso(wx+hw, wy+hd, wz), bl: CrossyLib.toIso(wx-hw, wy+hd, wz),
      tf: CrossyLib.toIso(wx-hw, wy-hd, wz+height), tr: CrossyLib.toIso(wx+hw, wy-hd, wz+height),
      tb: CrossyLib.toIso(wx+hw, wy+hd, wz+height), tl: CrossyLib.toIso(wx-hw, wy+hd, wz+height),
    };

    drawPolygon(name+'_t', [p.tf[0],p.tf[1], p.tr[0],p.tr[1], p.tb[0],p.tb[1], p.tl[0],p.tl[1]]);
    setFill(name+'_t', tC); setStroke(name+'_t', [0,0,0,0], 0);

    drawPolygon(name+'_l', [p.tf[0],p.tf[1], p.tl[0],p.tl[1], p.bl[0],p.bl[1], p.bf[0],p.bf[1]]);
    setFill(name+'_l', lC); setStroke(name+'_l', [0,0,0,0], 0);

    drawPolygon(name+'_r', [p.tf[0],p.tf[1], p.tr[0],p.tr[1], p.br[0],p.br[1], p.bf[0],p.bf[1]]);
    setFill(name+'_r', rC); setStroke(name+'_r', [0,0,0,0], 0);

    createGroup(name, [name+'_r', name+'_t', name+'_l']);
  }

  /**
   * 박스 생성 + 좌표 저장 (스태킹용)
   */
  box3d(name, wx, wy, wz, width, depth, height, color) {
    const tC = color.t || color;
    const lC = color.l || color;
    const rC = color.r || color;

    this._parts[name] = { wx, wy, wz, w: width, d: depth, h: height, tC, lC, rC };
    this.box(name, wx, wy, wz, width, depth, height, color);
  }

  /**
   * 파츠 위에 스태킹할 Z 좌표 반환
   */
  stackZ(baseName, gap = 0) {
    const p = this._parts[baseName];
    return p ? p.wz + p.h + gap : 0;
  }

  /**
   * 깊이 기준 정렬 (3D 박스 겹침용)
   */
  sortByDepth(...names) {
    const valid = names.filter(n => this._parts[n]);
    if (valid.length < 2) return;

    valid.sort((a, b) => {
      const pa = this._parts[a], pb = this._parts[b];
      return (pa.wx - pa.wy + pa.wz) - (pb.wx - pb.wy + pb.wz);
    });

    for (let i = 0; i < valid.length; i++) {
      drawOrder(valid[i], 'front');
    }
  }

  /**
   * 이소메트릭 정렬용 그룹 등록
   */
  registerIsoGroup(groupName, x, y) {
    this._isoGroups.push({ name: groupName, x, y, depth: x + y });
  }

  /**
   * 등록된 그룹들을 이소메트릭 깊이로 정렬
   */
  sortIsoGroups() {
    if (this._isoGroups.length < 2) {
      this._isoGroups.length = 0;
      return;
    }

    // 오름차순 정렬 (작은 depth부터) → 큰 depth가 마지막에 front로 이동하여 최전면
    this._isoGroups.sort((a, b) => a.depth - b.depth);

    for (let i = 0; i < this._isoGroups.length; i++) {
      drawOrder(this._isoGroups[i].name, 'front');
    }

    this._isoGroups.length = 0;
  }

  /**
   * 파츠 정보 조회
   */
  getPart(name) {
    return this._parts[name];
  }

  /**
   * 모든 파츠 초기화
   */
  clearParts() {
    this._parts = {};
  }
}

// ============================================
// Legacy API (하위 호환성)
// ============================================

// 공유 인스턴스 (레거시 함수용)
const _defaultInstance = new CrossyLib();
const _parts = _defaultInstance._parts;
const _isoGroups = [];

function toIso(x, y, z) {
  return CrossyLib.toIso(x, y, z);
}

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

function box3d(name, wx, wy, wz, width, depth, height, tC, lC, rC) {
  _parts[name] = { wx, wy, wz, w: width, d: depth, h: height, tC, lC, rC };
  box(name, wx, wy, wz, width, depth, height, tC, lC, rC);
}

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

/**
 * 이소메트릭 정렬용 그룹 등록
 */
function registerIsoGroup(groupName, x, y) {
  _isoGroups.push({ name: groupName, x: x, y: y, depth: x + y });
}

/**
 * 등록된 그룹들을 이소메트릭 깊이로 정렬
 */
function sortIsoGroups() {
  if (_isoGroups.length < 2) {
    _isoGroups.length = 0;
    return;
  }

  // 오름차순 정렬 (작은 depth부터) → 큰 depth가 마지막에 front로 이동하여 최전면
  _isoGroups.sort(function(a, b) { return a.depth - b.depth; });

  for (let i = 0; i < _isoGroups.length; i++) {
    drawOrder(_isoGroups[i].name, 'front');
  }

  _isoGroups.length = 0;
}
