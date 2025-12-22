use std::fmt;
use wasm_bindgen::prelude::*;
use uuid::Uuid;
use js_sys::Float64Array;

pub mod entity;

use entity::{Entity, EntityType, Geometry, Metadata, Style, Transform};
use crate::primitives::parse_line_points;

#[derive(Debug, Clone, PartialEq, Eq)]
enum SceneError {
    DuplicateEntityName(String),
    InvalidInput(String),
}

impl fmt::Display for SceneError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SceneError::DuplicateEntityName(name) => {
                write!(f, "Entity '{}' already exists", name)
            }
            SceneError::InvalidInput(msg) => {
                write!(f, "{}", msg)
            }
        }
    }
}

impl std::error::Error for SceneError {}

#[wasm_bindgen]
pub struct Scene {
    name: String,
    entities: Vec<Entity>,
}

fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

impl Scene {
    fn find_by_name(&self, name: &str) -> Option<&Entity> {
        self.entities
            .iter()
            .find(|entity| entity.metadata.name == name)
    }

    fn has_entity(&self, name: &str) -> bool {
        self.find_by_name(name).is_some()
    }

    fn add_entity_internal(
        &mut self,
        name: &str,
        entity_type: EntityType,
        geometry: Geometry,
    ) -> Result<String, SceneError> {
        if self.has_entity(name) {
            return Err(SceneError::DuplicateEntityName(name.to_string()));
        }

        let entity = Entity {
            id: generate_id(),
            entity_type,
            geometry,
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata {
                name: name.to_string(),
                ..Default::default()
            },
        };

        self.entities.push(entity);
        Ok(name.to_string())
    }

    /// 내부용 Line 생성 함수 (테스트용)
    /// Vec<f64> 좌표를 받아 Line Entity 생성
    fn add_line_internal(&mut self, name: &str, coords: Vec<f64>) -> Result<String, SceneError> {
        let point_pairs = parse_line_points(coords)
            .map_err(SceneError::InvalidInput)?;

        self.add_entity_internal(
            name,
            EntityType::Line,
            Geometry::Line { points: point_pairs },
        )
    }
}

#[wasm_bindgen]
impl Scene {
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str) -> Scene {
        Scene {
            name: name.to_string(),
            entities: Vec::new(),
        }
    }

    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    pub fn add_entity(&mut self, name: &str) -> Result<String, JsValue> {
        self.add_entity_internal(
            name,
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.0, 0.0], [0.0, 0.0]],
            },
        )
        .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// 선분(Line) 도형을 생성합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (예: "spine", "left_arm") - Scene 내 unique
    /// * `points` - [x1, y1, x2, y2, ...] 형태의 Float64Array
    ///
    /// # Returns
    /// * Ok(name) - 성공 시 name 반환
    /// * Err - name 중복 또는 잘못된 입력
    ///
    /// # 입력 보정 (AC3)
    /// 홀수 개 좌표가 주어지면 마지막 좌표를 무시하고 정상 처리
    pub fn add_line(&mut self, name: &str, points: Float64Array) -> Result<String, JsValue> {
        self.add_line_internal(name, points.to_vec())
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_geometry() -> Geometry {
        Geometry::Line {
            points: vec![[0.0, 0.0], [1.0, 1.0]],
        }
    }

    #[test]
    fn test_scene_new() {
        let scene = Scene::new("my-scene");
        assert_eq!(scene.get_name(), "my-scene");
        assert_eq!(scene.entity_count(), 0);
    }

    #[test]
    fn test_add_entity_returns_name() {
        let mut scene = Scene::new("test");
        let name = scene
            .add_entity_internal("head", EntityType::Line, sample_geometry())
            .expect("add_entity should succeed");

        assert_eq!(name, "head");
        assert_eq!(scene.entity_count(), 1);

        let stored = scene.find_by_name("head").expect("entity should exist");
        assert_eq!(stored.metadata.name, "head");
        assert!(!stored.id.is_empty());
    }

    #[test]
    fn test_add_entity_duplicate_name() {
        let mut scene = Scene::new("test");
        scene
            .add_entity_internal("head", EntityType::Line, sample_geometry())
            .expect("first add_entity should succeed");

        let err = scene
            .add_entity_internal("head", EntityType::Line, sample_geometry())
            .expect_err("duplicate name should error");
        assert_eq!(err.to_string(), "Entity 'head' already exists");
        assert!(matches!(
            err,
            SceneError::DuplicateEntityName(name) if name == "head"
        ));
    }

    // === add_line 테스트 (Story 1.3) ===

    #[test]
    fn test_add_line_two_points() {
        // AC1: 기본 선분 생성
        let mut scene = Scene::new("test");
        let name = scene
            .add_line_internal("spine", vec![0.0, 100.0, 0.0, 50.0])
            .expect("add_line should succeed");

        assert_eq!(name, "spine");
        assert_eq!(scene.entity_count(), 1);

        let entity = scene.find_by_name("spine").unwrap();
        assert_eq!(entity.metadata.name, "spine");
        assert!(matches!(entity.entity_type, EntityType::Line));
        assert!(matches!(
            &entity.geometry,
            Geometry::Line { points } if points == &vec![[0.0, 100.0], [0.0, 50.0]]
        ));
    }

    #[test]
    fn test_add_line_polyline_3_points() {
        // AC2: 폴리라인 (3점)
        let mut scene = Scene::new("test");
        let name = scene
            .add_line_internal("left_arm", vec![0.0, 85.0, -20.0, 70.0, -25.0, 50.0])
            .expect("add_line polyline should succeed");

        assert_eq!(name, "left_arm");

        let entity = scene.find_by_name("left_arm").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Line { points } if points.len() == 3
        ));
    }

    #[test]
    fn test_add_line_polyline_4_points() {
        // AC2: 폴리라인 (4개 이상 좌표 = 4점)
        let mut scene = Scene::new("test");
        let name = scene
            .add_line_internal(
                "skeleton_arm",
                vec![0.0, 85.0, -20.0, 70.0, -25.0, 50.0, -30.0, 30.0],
            )
            .expect("add_line 4-point polyline should succeed");

        assert_eq!(name, "skeleton_arm");

        let entity = scene.find_by_name("skeleton_arm").unwrap();
        assert!(matches!(
            &entity.geometry,
            Geometry::Line { points } if points.len() == 4
        ));
    }

    #[test]
    fn test_add_line_odd_coordinates_drops_last() {
        // AC3: 홀수 좌표 -> 마지막 무시하고 정상 생성
        let mut scene = Scene::new("test");
        let name = scene
            .add_line_internal("test_line", vec![0.0, 100.0, 0.0, 50.0, 999.0])
            .expect("odd coords should be forgiven");

        assert_eq!(name, "test_line");

        let entity = scene.find_by_name("test_line").unwrap();
        // 마지막 999.0은 무시되어야 함
        assert!(matches!(
            &entity.geometry,
            Geometry::Line { points } if points == &vec![[0.0, 100.0], [0.0, 50.0]]
        ));
    }

    #[test]
    fn test_add_line_too_few_points_error() {
        // 최소 2점 필요
        let mut scene = Scene::new("test");
        let err = scene
            .add_line_internal("invalid", vec![0.0, 100.0])
            .expect_err("should error with < 2 points");

        assert_eq!(err.to_string(), "At least 2 points required");
    }

    #[test]
    fn test_add_line_duplicate_name_error() {
        // name 중복 시 에러
        let mut scene = Scene::new("test");
        scene
            .add_line_internal("spine", vec![0.0, 100.0, 0.0, 50.0])
            .expect("first add should succeed");

        let err = scene
            .add_line_internal("spine", vec![10.0, 10.0, 20.0, 20.0])
            .expect_err("duplicate name should error");

        assert_eq!(err.to_string(), "Entity 'spine' already exists");
    }
}
