//! Scene 모듈
//!
//! CAD 씬을 관리하는 Scene 클래스를 제공합니다.
//! wasm-bindgen 패턴을 사용하여 JS에서 직접 인스턴스화 가능합니다.

use wasm_bindgen::prelude::*;
use uuid::Uuid;

pub mod entity;

pub use entity::{Entity, EntityType, Geometry, Transform, Style, Metadata};

/// Scene 클래스 - CAD 씬 컨테이너
///
/// Entity들을 관리하고, name 기반으로 Entity를 식별합니다.
/// AX 원칙: AI는 UUID보다 의미있는 이름을 더 잘 이해합니다.
#[wasm_bindgen]
pub struct Scene {
    name: String,
    entities: Vec<Entity>,
}

#[wasm_bindgen]
impl Scene {
    /// Scene 생성자
    ///
    /// # Arguments
    /// * `name` - 씬 이름
    ///
    /// # Example (JS)
    /// ```js
    /// const scene = new Scene("my-scene");
    /// ```
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str) -> Scene {
        Scene {
            name: name.to_string(),
            entities: Vec::new(),
        }
    }

    /// 씬 이름 반환
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.name.clone()
    }

    /// Entity 개수 반환
    #[wasm_bindgen(getter)]
    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    /// 특정 이름의 Entity가 존재하는지 확인
    pub fn has_entity(&self, name: &str) -> bool {
        self.entities.iter().any(|e| e.metadata.name == name)
    }

    /// 모든 Entity 이름 목록 반환 (JSON 배열)
    pub fn list_entities(&self) -> String {
        let names: Vec<&str> = self.entities.iter()
            .map(|e| e.metadata.name.as_str())
            .collect();
        serde_json::to_string(&names).unwrap_or_else(|_| "[]".to_string())
    }
}

// Rust 전용 메서드 (wasm_bindgen 미적용)
impl Scene {
    /// UUID 생성
    fn generate_id() -> String {
        Uuid::new_v4().to_string()
    }

    /// Entity 추가 (내부용)
    ///
    /// # Returns
    /// * `Ok(name)` - 추가 성공 시 Entity name 반환
    /// * `Err(msg)` - name 중복 시 에러
    pub fn add_entity_internal(&mut self, entity: Entity) -> Result<String, String> {
        let name = entity.metadata.name.clone();

        // name 중복 체크
        if self.has_entity(&name) {
            return Err(format!("Entity with name '{}' already exists", name));
        }

        self.entities.push(entity);
        Ok(name)
    }

    /// name으로 Entity 찾기
    pub fn find_by_name(&self, name: &str) -> Option<&Entity> {
        self.entities.iter().find(|e| e.metadata.name == name)
    }

    /// name으로 Entity 찾기 (mutable)
    pub fn find_by_name_mut(&mut self, name: &str) -> Option<&mut Entity> {
        self.entities.iter_mut().find(|e| e.metadata.name == name)
    }

    /// Entity 목록 접근 (읽기 전용)
    pub fn entities(&self) -> &[Entity] {
        &self.entities
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scene_new() {
        let scene = Scene::new("test-scene");
        assert_eq!(scene.name(), "test-scene");
        assert_eq!(scene.entity_count(), 0);
    }

    #[test]
    fn test_scene_has_entity() {
        let mut scene = Scene::new("test");
        assert!(!scene.has_entity("circle1"));

        let entity = Entity {
            id: Scene::generate_id(),
            entity_type: EntityType::Circle,
            geometry: Geometry::Circle { center: [0.0, 0.0], radius: 10.0 },
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata::new("circle1"),
        };

        scene.add_entity_internal(entity).unwrap();
        assert!(scene.has_entity("circle1"));
    }

    #[test]
    fn test_scene_duplicate_name_error() {
        let mut scene = Scene::new("test");

        let entity1 = Entity {
            id: Scene::generate_id(),
            entity_type: EntityType::Circle,
            geometry: Geometry::Circle { center: [0.0, 0.0], radius: 10.0 },
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata::new("head"),
        };

        let entity2 = Entity {
            id: Scene::generate_id(),
            entity_type: EntityType::Circle,
            geometry: Geometry::Circle { center: [5.0, 5.0], radius: 5.0 },
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata::new("head"), // 중복!
        };

        assert!(scene.add_entity_internal(entity1).is_ok());
        assert!(scene.add_entity_internal(entity2).is_err());
    }

    #[test]
    fn test_scene_find_by_name() {
        let mut scene = Scene::new("test");

        let entity = Entity {
            id: Scene::generate_id(),
            entity_type: EntityType::Rect,
            geometry: Geometry::Rect { origin: [0.0, 0.0], width: 100.0, height: 50.0 },
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata::new("my_rect"),
        };

        scene.add_entity_internal(entity).unwrap();

        let found = scene.find_by_name("my_rect");
        assert!(found.is_some());
        assert_eq!(found.unwrap().metadata.name, "my_rect");

        let not_found = scene.find_by_name("nonexistent");
        assert!(not_found.is_none());
    }

    #[test]
    fn test_list_entities() {
        let mut scene = Scene::new("test");

        let e1 = Entity {
            id: Scene::generate_id(),
            entity_type: EntityType::Circle,
            geometry: Geometry::Circle { center: [0.0, 0.0], radius: 10.0 },
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata::new("circle1"),
        };

        let e2 = Entity {
            id: Scene::generate_id(),
            entity_type: EntityType::Line,
            geometry: Geometry::Line { points: vec![[0.0, 0.0], [10.0, 10.0]] },
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata::new("line1"),
        };

        scene.add_entity_internal(e1).unwrap();
        scene.add_entity_internal(e2).unwrap();

        let list = scene.list_entities();
        assert!(list.contains("circle1"));
        assert!(list.contains("line1"));
    }
}
