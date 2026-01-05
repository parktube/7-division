use serde::{Deserialize, Serialize};

pub use super::style::{FillStyle, LineCap, LineJoin, StrokeStyle, Style};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub entity_type: EntityType,
    pub geometry: Geometry,
    pub transform: Transform,
    pub style: Style,
    pub metadata: Metadata,
    /// 부모 그룹의 name (None이면 최상위)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    /// 자식 Entity들의 name 목록 (Group만 사용)
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub children: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntityType {
    Line,
    Circle,
    Rect,
    Arc,
    Polygon,
    Bezier,
    Group,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Geometry {
    Line {
        points: Vec<[f64; 2]>,
    },
    Circle {
        center: [f64; 2],
        radius: f64,
    },
    Rect {
        origin: [f64; 2],
        width: f64,
        height: f64,
    },
    Arc {
        center: [f64; 2],
        radius: f64,
        start_angle: f64, // 라디안, 0 = 3시 방향
        end_angle: f64,   // 라디안, 양수 = 반시계방향 (CCW)
    },
    /// 다각형 (닫힌 경로, fill 지원)
    Polygon {
        points: Vec<[f64; 2]>,
    },
    /// 베지어 커브 (큐빅 베지어 세그먼트들)
    /// 각 세그먼트: [시작점, 제어점1, 제어점2, 끝점]
    /// 첫 세그먼트 이후는 이전 끝점에서 이어짐
    Bezier {
        /// 시작점
        start: [f64; 2],
        /// 세그먼트들: 각각 [cp1, cp2, end] (3점씩)
        segments: Vec<[[f64; 2]; 3]>,
        /// 닫힌 경로 여부 (true면 fill 가능)
        closed: bool,
    },
    /// Group용 빈 geometry (자체 도형 없음)
    Empty,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform {
    pub translate: [f64; 2],
    pub rotate: f64,
    pub scale: [f64; 2],
    /// 회전/스케일 중심점 (로컬 좌표계). 기본값 [0, 0]
    #[serde(default, skip_serializing_if = "is_zero_pivot")]
    pub pivot: [f64; 2],
}

/// pivot이 기본값([0, 0])인지 확인하는 헬퍼
fn is_zero_pivot(pivot: &[f64; 2]) -> bool {
    pivot[0] == 0.0 && pivot[1] == 0.0
}

impl Default for Transform {
    fn default() -> Self {
        Self {
            translate: [0.0, 0.0],
            rotate: 0.0,
            scale: [1.0, 1.0],
            pivot: [0.0, 0.0],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Metadata {
    pub name: String,
    pub layer: Option<String>,
    pub locked: bool,
    /// 렌더링 순서 (높을수록 앞에 그려짐). 기본값 0
    #[serde(default)]
    pub z_index: i32,
}

/// 3x3 동차 행렬 (2D 변환용)
/// [[a, b, tx], [c, d, ty], [0, 0, 1]]
pub type Matrix3x3 = [[f64; 3]; 3];

impl Transform {
    /// 항등 행렬
    pub fn identity_matrix() -> Matrix3x3 {
        [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
    }

    /// Transform을 3x3 동차 행렬로 변환
    /// 변환 순서: translate * pivot * rotate * scale * (-pivot)
    pub fn to_matrix(&self) -> Matrix3x3 {
        let [tx, ty] = self.translate;
        let [sx, sy] = self.scale;
        let [px, py] = self.pivot;
        let cos_r = self.rotate.cos();
        let sin_r = self.rotate.sin();

        // 변환 순서 (오른쪽부터 적용):
        // 1. -pivot 이동
        // 2. scale
        // 3. rotate
        // 4. +pivot 이동
        // 5. translate

        // 결합된 행렬 계산
        // M = T * Tp * R * S * T(-p)
        // 여기서:
        // - T = translate(tx, ty)
        // - Tp = translate(px, py)
        // - R = rotate(angle)
        // - S = scale(sx, sy)
        // - T(-p) = translate(-px, -py)

        // 행렬 결합 결과:
        // a = cos * sx, b = -sin * sy
        // c = sin * sx, d = cos * sy
        // tx' = tx + px - (cos*sx*px - sin*sy*py)
        // ty' = ty + py - (sin*sx*px + cos*sy*py)

        let a = cos_r * sx;
        let b = -sin_r * sy;
        let c = sin_r * sx;
        let d = cos_r * sy;
        let tx_final = tx + px - (a * px + b * py);
        let ty_final = ty + py - (c * px + d * py);

        [[a, b, tx_final], [c, d, ty_final], [0.0, 0.0, 1.0]]
    }

    /// 두 행렬을 곱합니다 (a * b)
    #[allow(clippy::needless_range_loop)]
    pub fn multiply_matrices(a: &Matrix3x3, b: &Matrix3x3) -> Matrix3x3 {
        let mut result = [[0.0; 3]; 3];
        // 행렬 곱셈: result[i][j] = Σ a[i][k] * b[k][j]
        // 인덱스 기반 접근이 수학 공식과 일치하여 가독성이 높음
        for i in 0..3 {
            for j in 0..3 {
                for k in 0..3 {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        result
    }

    /// 점에 행렬 변환을 적용합니다
    pub fn transform_point(matrix: &Matrix3x3, point: [f64; 2]) -> [f64; 2] {
        let x = matrix[0][0] * point[0] + matrix[0][1] * point[1] + matrix[0][2];
        let y = matrix[1][0] * point[0] + matrix[1][1] * point[1] + matrix[1][2];
        [x, y]
    }
}

#[cfg(test)]
mod transform_tests {
    use super::*;
    use std::f64::consts::PI;

    fn approx_eq(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    fn matrix_approx_eq(a: &Matrix3x3, b: &Matrix3x3, eps: f64) -> bool {
        for i in 0..3 {
            for j in 0..3 {
                if !approx_eq(a[i][j], b[i][j], eps) {
                    return false;
                }
            }
        }
        true
    }

    #[test]
    fn test_identity_transform() {
        let t = Transform::default();
        let m = t.to_matrix();
        let identity = Transform::identity_matrix();
        assert!(matrix_approx_eq(&m, &identity, 1e-10));
    }

    #[test]
    fn test_translate_only() {
        let t = Transform {
            translate: [10.0, 20.0],
            ..Default::default()
        };
        let m = t.to_matrix();
        let p = Transform::transform_point(&m, [0.0, 0.0]);
        assert!(approx_eq(p[0], 10.0, 1e-10));
        assert!(approx_eq(p[1], 20.0, 1e-10));
    }

    #[test]
    fn test_rotate_90_degrees() {
        let t = Transform {
            rotate: PI / 2.0, // 90도 반시계방향
            ..Default::default()
        };
        let m = t.to_matrix();
        let p = Transform::transform_point(&m, [1.0, 0.0]);
        // (1, 0) -> (0, 1)
        assert!(approx_eq(p[0], 0.0, 1e-10));
        assert!(approx_eq(p[1], 1.0, 1e-10));
    }

    #[test]
    fn test_scale() {
        let t = Transform {
            scale: [2.0, 3.0],
            ..Default::default()
        };
        let m = t.to_matrix();
        let p = Transform::transform_point(&m, [1.0, 1.0]);
        assert!(approx_eq(p[0], 2.0, 1e-10));
        assert!(approx_eq(p[1], 3.0, 1e-10));
    }

    #[test]
    fn test_pivot_rotation() {
        // pivot (5, 0)에서 90도 회전
        let t = Transform {
            rotate: PI / 2.0,
            pivot: [5.0, 0.0],
            ..Default::default()
        };
        let m = t.to_matrix();
        // (5, 0)은 pivot이므로 그대로
        let p1 = Transform::transform_point(&m, [5.0, 0.0]);
        assert!(approx_eq(p1[0], 5.0, 1e-10));
        assert!(approx_eq(p1[1], 0.0, 1e-10));
        // (10, 0)은 pivot에서 (5, 0) 떨어짐 -> 회전 후 (5, 5)
        let p2 = Transform::transform_point(&m, [10.0, 0.0]);
        assert!(approx_eq(p2[0], 5.0, 1e-10));
        assert!(approx_eq(p2[1], 5.0, 1e-10));
    }

    #[test]
    fn test_combined_transform() {
        // translate(10, 0) + rotate(90) + scale(2, 1)
        let t = Transform {
            translate: [10.0, 0.0],
            rotate: PI / 2.0,
            scale: [2.0, 1.0],
            pivot: [0.0, 0.0],
        };
        let m = t.to_matrix();
        // (1, 0) -> scale(2,1) -> (2, 0) -> rotate(90) -> (0, 2) -> translate -> (10, 2)
        let p = Transform::transform_point(&m, [1.0, 0.0]);
        assert!(approx_eq(p[0], 10.0, 1e-10));
        assert!(approx_eq(p[1], 2.0, 1e-10));
    }

    #[test]
    fn test_matrix_multiply() {
        // 행렬 곱셈: a * b = b 먼저 적용, 그 다음 a 적용
        let scale_mat = [[2.0, 0.0, 0.0], [0.0, 2.0, 0.0], [0.0, 0.0, 1.0]]; // scale(2, 2)
        let translate_mat = [[1.0, 0.0, 5.0], [0.0, 1.0, 10.0], [0.0, 0.0, 1.0]]; // translate(5, 10)

        // scale * translate = translate 먼저, scale 나중
        // (0, 0) -> translate(5, 10) -> (5, 10) -> scale(2, 2) -> (10, 20)
        let st = Transform::multiply_matrices(&scale_mat, &translate_mat);
        let p1 = Transform::transform_point(&st, [0.0, 0.0]);
        assert!(approx_eq(p1[0], 10.0, 1e-10));
        assert!(approx_eq(p1[1], 20.0, 1e-10));

        // translate * scale = scale 먼저, translate 나중
        // (1, 1) -> scale(2, 2) -> (2, 2) -> translate(5, 10) -> (7, 12)
        let ts = Transform::multiply_matrices(&translate_mat, &scale_mat);
        let p2 = Transform::transform_point(&ts, [1.0, 1.0]);
        assert!(approx_eq(p2[0], 7.0, 1e-10));
        assert!(approx_eq(p2[1], 12.0, 1e-10));
    }
}
