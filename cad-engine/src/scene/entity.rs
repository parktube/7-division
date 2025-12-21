//! Entity 데이터 모델
//!
//! CAD 씬 내의 개별 도형(Entity)을 정의합니다.
//! AX 원칙: Entity는 UUID(id)가 아닌 의미있는 이름(name)으로 식별합니다.

use serde::{Deserialize, Serialize};

/// CAD Entity - 씬 내의 개별 도형
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    /// 내부 UUID (JSON export용)
    pub id: String,
    /// Entity 타입
    pub entity_type: EntityType,
    /// 기하학적 데이터
    pub geometry: Geometry,
    /// 변환 정보 (이동, 회전, 스케일)
    pub transform: Transform,
    /// 스타일 정보 (선색, 채움색 등)
    pub style: Style,
    /// 메타데이터 (name 필수)
    pub metadata: Metadata,
}

/// Entity 타입 열거형
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EntityType {
    Line,
    Circle,
    Rect,
    // Phase 2+: Polygon, Arc, Group
}

/// 기하학적 데이터 열거형
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Geometry {
    Line { points: Vec<[f64; 2]> },
    Circle { center: [f64; 2], radius: f64 },
    Rect { origin: [f64; 2], width: f64, height: f64 },
}

/// 변환 정보 (이동, 회전, 스케일)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform {
    /// 이동 [dx, dy]
    pub translate: [f64; 2],
    /// 회전 (라디안)
    pub rotate: f64,
    /// 스케일 [sx, sy]
    pub scale: [f64; 2],
}

impl Default for Transform {
    fn default() -> Self {
        Transform {
            translate: [0.0, 0.0],
            rotate: 0.0,
            scale: [1.0, 1.0],
        }
    }
}

/// 스타일 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Style {
    /// 선 색상 (e.g., "#000000")
    pub stroke: Option<String>,
    /// 채움 색상
    pub fill: Option<String>,
    /// 선 두께
    pub stroke_width: Option<f64>,
}

impl Default for Style {
    fn default() -> Self {
        Style {
            stroke: Some("#000000".to_string()),
            fill: None,
            stroke_width: Some(1.0),
        }
    }
}

/// 메타데이터 - name은 필수이며 Scene 내에서 unique해야 함
///
/// **AX 원칙**: AI는 "head", "left_arm" 같은 이름을 자연어처럼 이해합니다.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    /// Entity 이름 (필수, Scene 내 unique)
    pub name: String,
    /// 레이어 이름
    pub layer: Option<String>,
    /// 잠금 상태
    pub locked: bool,
}

impl Metadata {
    /// 이름으로 Metadata 생성
    pub fn new(name: &str) -> Self {
        Metadata {
            name: name.to_string(),
            layer: None,
            locked: false,
        }
    }
}

impl Default for Metadata {
    fn default() -> Self {
        Metadata {
            name: String::new(),
            layer: None,
            locked: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transform_default() {
        let t = Transform::default();
        assert_eq!(t.translate, [0.0, 0.0]);
        assert_eq!(t.rotate, 0.0);
        assert_eq!(t.scale, [1.0, 1.0]);
    }

    #[test]
    fn test_style_default() {
        let s = Style::default();
        assert_eq!(s.stroke, Some("#000000".to_string()));
        assert_eq!(s.fill, None);
        assert_eq!(s.stroke_width, Some(1.0));
    }

    #[test]
    fn test_metadata_new() {
        let m = Metadata::new("my_circle");
        assert_eq!(m.name, "my_circle");
        assert_eq!(m.layer, None);
        assert!(!m.locked);
    }
}
