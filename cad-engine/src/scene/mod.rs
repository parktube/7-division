use wasm_bindgen::prelude::*;
use uuid::Uuid;

pub mod entity;

use entity::{Entity, EntityType, Geometry, Metadata, Style, Transform};

#[wasm_bindgen]
pub struct Scene {
    name: String,
    entities: Vec<Entity>,
}

fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

fn duplicate_name_error(name: &str) -> JsValue {
    #[cfg(target_arch = "wasm32")]
    {
        JsValue::from_str(&format!("Entity '{}' already exists", name))
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = name;
        JsValue::NULL
    }
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
    ) -> Result<String, JsValue> {
        if self.has_entity(name) {
            return Err(duplicate_name_error(name));
        }

        let entity = Entity {
            id: generate_id(),
            entity_type,
            geometry,
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata {
                name: name.to_string(),
                layer: None,
                locked: false,
            },
        };

        self.entities.push(entity);
        Ok(name.to_string())
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
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
            .add_entity("head")
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
        scene.add_entity("head").expect("first add_entity should succeed");

        assert!(scene.add_entity("head").is_err());
    }
}
