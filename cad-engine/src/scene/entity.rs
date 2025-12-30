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
    /// Group용 빈 geometry (자체 도형 없음)
    Empty,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform {
    pub translate: [f64; 2],
    pub rotate: f64,
    pub scale: [f64; 2],
}

impl Default for Transform {
    fn default() -> Self {
        Self {
            translate: [0.0, 0.0],
            rotate: 0.0,
            scale: [1.0, 1.0],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Metadata {
    pub name: String,
    pub layer: Option<String>,
    pub locked: bool,
}
