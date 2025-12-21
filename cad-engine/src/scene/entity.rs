use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub entity_type: EntityType,
    pub geometry: Geometry,
    pub transform: Transform,
    pub style: Style,
    pub metadata: Metadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntityType {
    Line,
    Circle,
    Rect,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Geometry {
    Line { points: Vec<[f64; 2]> },
    Circle { center: [f64; 2], radius: f64 },
    Rect {
        origin: [f64; 2],
        width: f64,
        height: f64,
    },
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Style {
    pub stroke: Option<String>,
    pub fill: Option<String>,
    pub stroke_width: Option<f64>,
}

impl Default for Style {
    fn default() -> Self {
        Self {
            stroke: Some("#000000".to_string()),
            fill: None,
            stroke_width: Some(1.0),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub name: String,
    pub layer: Option<String>,
    pub locked: bool,
}

impl Default for Metadata {
    fn default() -> Self {
        Self {
            name: String::new(),
            layer: None,
            locked: false,
        }
    }
}
