use serde::Serialize;

use crate::scene::entity::Entity;

#[derive(Serialize)]
struct SceneJson<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<&'a str>,
    entities: &'a [Entity],
}

pub fn serialize_scene(name: &str, entities: &[Entity]) -> String {
    let scene_json = SceneJson {
        // AC3: omit the name for empty scenes to avoid implying content exists.
        name: if entities.is_empty() { None } else { Some(name) },
        entities,
    };

    serde_json::to_string_pretty(&scene_json)
        .unwrap_or_else(|err| {
            eprintln!("Warning: Scene serialization failed for '{}': {}", name, err);
            r#"{"entities": []}"#.to_string()
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scene::entity::{Entity, EntityType, Geometry, Metadata, Style, Transform};

    fn create_test_entity(name: &str, entity_type: EntityType, geometry: Geometry) -> Entity {
        Entity {
            id: uuid::Uuid::new_v4().to_string(),
            entity_type,
            geometry,
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata {
                name: name.to_string(),
                layer: None,
                locked: false,
            },
        }
    }

    #[test]
    fn test_serialize_scene_empty() {
        let entities: Vec<Entity> = vec![];
        let json = serialize_scene("test", &entities);
        
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        // Empty scene should omit name
        assert!(value.get("name").is_none());
        
        let entities_arr = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        assert!(entities_arr.is_empty());
    }

    #[test]
    fn test_serialize_scene_with_name() {
        let entity = create_test_entity(
            "line1",
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.0, 0.0], [10.0, 10.0]],
            },
        );
        
        let json = serialize_scene("my-scene", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        // Non-empty scene should include name
        assert_eq!(
            value.get("name").and_then(|v| v.as_str()),
            Some("my-scene")
        );
    }

    #[test]
    fn test_serialize_scene_single_line() {
        let entity = create_test_entity(
            "line1",
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.0, 0.0], [10.0, 10.0]],
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        assert_eq!(entities.len(), 1);
        
        let line = &entities[0];
        assert_eq!(
            line.get("entity_type").and_then(|v| v.as_str()),
            Some("Line")
        );
        
        let geometry = line.get("geometry")
            .and_then(|g| g.get("Line"))
            .expect("should have Line geometry");
        
        let points = geometry.get("points")
            .and_then(|p| p.as_array())
            .expect("should have points array");
        
        assert_eq!(points.len(), 2);
    }

    #[test]
    fn test_serialize_scene_single_circle() {
        let entity = create_test_entity(
            "circle1",
            EntityType::Circle,
            Geometry::Circle {
                center: [5.0, 5.0],
                radius: 10.0,
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        assert_eq!(entities.len(), 1);
        
        let circle = &entities[0];
        assert_eq!(
            circle.get("entity_type").and_then(|v| v.as_str()),
            Some("Circle")
        );
        
        let geometry = circle.get("geometry")
            .and_then(|g| g.get("Circle"))
            .expect("should have Circle geometry");
        
        assert_eq!(
            geometry.get("radius").and_then(|r| r.as_f64()),
            Some(10.0)
        );
    }

    #[test]
    fn test_serialize_scene_single_rect() {
        let entity = create_test_entity(
            "rect1",
            EntityType::Rect,
            Geometry::Rect {
                origin: [0.0, 0.0],
                width: 100.0,
                height: 50.0,
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        assert_eq!(entities.len(), 1);
        
        let rect = &entities[0];
        assert_eq!(
            rect.get("entity_type").and_then(|v| v.as_str()),
            Some("Rect")
        );
        
        let geometry = rect.get("geometry")
            .and_then(|g| g.get("Rect"))
            .expect("should have Rect geometry");
        
        assert_eq!(
            geometry.get("width").and_then(|w| w.as_f64()),
            Some(100.0)
        );
        assert_eq!(
            geometry.get("height").and_then(|h| h.as_f64()),
            Some(50.0)
        );
    }

    #[test]
    fn test_serialize_scene_multiple_entities() {
        let entities = vec![
            create_test_entity(
                "line1",
                EntityType::Line,
                Geometry::Line {
                    points: vec![[0.0, 0.0], [10.0, 10.0]],
                },
            ),
            create_test_entity(
                "circle1",
                EntityType::Circle,
                Geometry::Circle {
                    center: [5.0, 5.0],
                    radius: 3.0,
                },
            ),
            create_test_entity(
                "rect1",
                EntityType::Rect,
                Geometry::Rect {
                    origin: [0.0, 0.0],
                    width: 20.0,
                    height: 30.0,
                },
            ),
        ];
        
        let json = serialize_scene("multi", &entities);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities_arr = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        assert_eq!(entities_arr.len(), 3);
        
        // Verify entity types
        assert_eq!(
            entities_arr[0].get("entity_type").and_then(|v| v.as_str()),
            Some("Line")
        );
        assert_eq!(
            entities_arr[1].get("entity_type").and_then(|v| v.as_str()),
            Some("Circle")
        );
        assert_eq!(
            entities_arr[2].get("entity_type").and_then(|v| v.as_str()),
            Some("Rect")
        );
    }

    #[test]
    fn test_serialize_scene_preserves_entity_id() {
        let id = uuid::Uuid::new_v4().to_string();
        let entity = Entity {
            id: id.clone(),
            entity_type: EntityType::Line,
            geometry: Geometry::Line {
                points: vec![[0.0, 0.0], [1.0, 1.0]],
            },
            transform: Transform::default(),
            style: Style::default(),
            metadata: Metadata {
                name: "test".to_string(),
                layer: None,
                locked: false,
            },
        };
        
        let json = serialize_scene("test", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        assert_eq!(
            entities[0].get("id").and_then(|v| v.as_str()),
            Some(id.as_str())
        );
    }

    #[test]
    fn test_serialize_scene_includes_transform() {
        let entity = create_test_entity(
            "line1",
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.0, 0.0], [10.0, 10.0]],
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        let transform = entities[0].get("transform")
            .expect("should have transform");
        
        assert!(transform.get("translate").is_some());
        assert!(transform.get("rotate").is_some());
        assert!(transform.get("scale").is_some());
    }

    #[test]
    fn test_serialize_scene_includes_style() {
        let entity = create_test_entity(
            "line1",
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.0, 0.0], [10.0, 10.0]],
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        let style = entities[0].get("style")
            .expect("should have style");
        
        assert!(style.get("stroke").is_some());
        assert!(style.get("fill").is_some());
    }

    #[test]
    fn test_serialize_scene_includes_metadata() {
        let entity = create_test_entity(
            "my-line",
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.0, 0.0], [10.0, 10.0]],
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        let metadata = entities[0].get("metadata")
            .expect("should have metadata");
        
        assert_eq!(
            metadata.get("name").and_then(|v| v.as_str()),
            Some("my-line")
        );
        assert_eq!(
            metadata.get("locked").and_then(|v| v.as_bool()),
            Some(false)
        );
    }

    #[test]
    fn test_serialize_scene_pretty_format() {
        let entity = create_test_entity(
            "line1",
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.0, 0.0], [10.0, 10.0]],
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        
        // Pretty format should have newlines and indentation
        assert!(json.contains('\n'));
        assert!(json.contains("  "));
    }

    #[test]
    fn test_serialize_scene_with_polyline() {
        let entity = create_test_entity(
            "polyline",
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.0, 0.0], [10.0, 10.0], [20.0, 5.0], [30.0, 15.0]],
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        let geometry = entities[0].get("geometry")
            .and_then(|g| g.get("Line"))
            .expect("should have Line geometry");
        
        let points = geometry.get("points")
            .and_then(|p| p.as_array())
            .expect("should have points array");
        
        assert_eq!(points.len(), 4);
    }

    #[test]
    fn test_serialize_scene_with_special_name() {
        let entity = create_test_entity(
            "line1",
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.0, 0.0], [10.0, 10.0]],
            },
        );
        
        // Test scene name with special characters
        let json = serialize_scene("test-scene_123", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        assert_eq!(
            value.get("name").and_then(|v| v.as_str()),
            Some("test-scene_123")
        );
    }

    #[test]
    fn test_serialize_scene_with_unicode_name() {
        let entity = create_test_entity(
            "線分",
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.0, 0.0], [10.0, 10.0]],
            },
        );
        
        let json = serialize_scene("テストシーン", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        assert_eq!(
            value.get("name").and_then(|v| v.as_str()),
            Some("テストシーン")
        );
        
        let metadata = value.get("entities")
            .and_then(|e| e.as_array())
            .and_then(|arr| arr[0].get("metadata"))
            .expect("should have metadata");
        
        assert_eq!(
            metadata.get("name").and_then(|v| v.as_str()),
            Some("線分")
        );
    }

    #[test]
    fn test_serialize_scene_arc_geometry() {
        let entity = create_test_entity(
            "arc1",
            EntityType::Arc,
            Geometry::Arc {
                center: [0.0, 0.0],
                radius: 50.0,
                start_angle: 0.0,
                end_angle: std::f64::consts::PI,
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        let geometry = entities[0].get("geometry")
            .and_then(|g| g.get("Arc"))
            .expect("should have Arc geometry");
        
        assert_eq!(
            geometry.get("radius").and_then(|r| r.as_f64()),
            Some(50.0)
        );
        assert!(geometry.get("start_angle").is_some());
        assert!(geometry.get("end_angle").is_some());
    }

    #[test]
    fn test_serialize_scene_with_negative_coordinates() {
        let entity = create_test_entity(
            "line1",
            EntityType::Line,
            Geometry::Line {
                points: vec![[-10.0, -20.0], [30.0, -5.0]],
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        let geometry = entities[0].get("geometry")
            .and_then(|g| g.get("Line"))
            .and_then(|l| l.get("points"))
            .and_then(|p| p.as_array())
            .expect("should have points");
        
        // Verify negative coordinates are preserved
        assert!(geometry[0].as_array().unwrap()[0].as_f64().unwrap() < 0.0);
        assert!(geometry[0].as_array().unwrap()[1].as_f64().unwrap() < 0.0);
    }

    #[test]
    fn test_serialize_scene_with_floating_point_precision() {
        let entity = create_test_entity(
            "line1",
            EntityType::Line,
            Geometry::Line {
                points: vec![[0.123456789, 0.987654321], [1.111111111, 2.222222222]],
            },
        );
        
        let json = serialize_scene("test", &[entity]);
        
        // Verify JSON contains floating point numbers
        assert!(json.contains("0.123456789"));
        assert!(json.contains("0.987654321"));
    }

    #[test]
    fn test_serialize_scene_empty_with_long_name() {
        let entities: Vec<Entity> = vec![];
        let long_name = "a".repeat(1000);
        
        let json = serialize_scene(&long_name, &entities);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        // Empty scene should omit name even if it's long
        assert!(value.get("name").is_none());
    }

    #[test]
    fn test_serialize_scene_large_number_of_entities() {
        let mut entities = Vec::new();
        for i in 0..100 {
            entities.push(create_test_entity(
                &format!("entity{}", i),
                EntityType::Circle,
                Geometry::Circle {
                    center: [i as f64, i as f64],
                    radius: 1.0,
                },
            ));
        }
        
        let json = serialize_scene("large", &entities);
        let value: serde_json::Value = serde_json::from_str(&json)
            .expect("should produce valid JSON");
        
        let entities_arr = value.get("entities")
            .and_then(|v| v.as_array())
            .expect("should have entities array");
        
        assert_eq!(entities_arr.len(), 100);
    }
}
