//! Scene Query 모듈
//!
//! 엔티티 조회 및 월드 좌표 변환 API를 제공합니다.

use super::Scene;
use super::entity::{EntityType, Transform};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl Scene {
    // ========================================
    // Scene Query Functions (Story 3.0-a)
    // ========================================

    /// Scene 내 모든 Entity의 이름과 타입을 반환합니다.
    ///
    /// # Returns
    /// JSON 배열: [{"name": "head", "type": "Circle"}, ...]
    ///
    /// # Examples
    /// ```ignore
    /// let list = scene.list_entities();
    /// // [{"name":"wall","type":"Rect"},{"name":"door","type":"Arc"}]
    /// ```
    pub fn list_entities(&self) -> String {
        let list: Vec<serde_json::Value> = self
            .entities
            .iter()
            .map(|e| {
                serde_json::json!({
                    "name": e.metadata.name,
                    "type": e.entity_type.as_str()
                })
            })
            .collect();

        serde_json::to_string(&list).unwrap_or_else(|_| "[]".to_string())
    }

    /// 계층적 드로우 오더를 조회합니다.
    ///
    /// Progressive Disclosure: LLM이 필요한 만큼만 drill-down할 수 있도록
    /// root level 또는 특정 그룹의 자식들을 순서대로 반환합니다.
    ///
    /// # Arguments
    /// * `group_name` - 빈 문자열이면 root level, 그룹 이름이면 해당 그룹의 자식들
    ///
    /// # Returns
    /// JSON 형태 (뒤→앞 순서로 정렬):
    /// ```json
    /// {
    ///   "level": "root",
    ///   "order": ["bg", "robot", "fg"],  // 뒤→앞 순서
    ///   "details": {
    ///     "robot": { "type": "Group", "children": 3 }
    ///   }
    /// }
    /// ```
    ///
    /// LLM은 순서만 확인하고, bringToFront/sendToBack/moveAbove 등으로 조작
    pub fn get_draw_order(&self, group_name: &str) -> String {
        if group_name.is_empty() {
            // Root level: parent_id가 None인 엔티티들
            let mut root_entities: Vec<_> = self
                .entities
                .iter()
                .filter(|e| e.parent_id.is_none())
                .collect();

            // z_index 오름차순 정렬 (뒤→앞)
            root_entities.sort_by_key(|e| e.metadata.z_index);

            let order: Vec<&str> = root_entities
                .iter()
                .map(|e| e.metadata.name.as_str())
                .collect();

            // 그룹만 details에 포함
            let mut details = serde_json::Map::new();
            for e in &root_entities {
                if matches!(e.entity_type, EntityType::Group) {
                    details.insert(
                        e.metadata.name.clone(),
                        serde_json::json!({
                            "type": "Group",
                            "children": e.children.len()
                        }),
                    );
                }
            }

            serde_json::json!({
                "level": "root",
                "order": order,
                "details": details
            })
            .to_string()
        } else {
            // 그룹 drill-down: 특정 그룹의 자식들
            match self.find_by_name(group_name) {
                Some(group) if matches!(group.entity_type, EntityType::Group) => {
                    let mut children: Vec<_> = group
                        .children
                        .iter()
                        .filter_map(|child_name| self.find_by_name(child_name))
                        .collect();

                    // z_index 오름차순 정렬
                    children.sort_by_key(|e| e.metadata.z_index);

                    let order: Vec<&str> =
                        children.iter().map(|e| e.metadata.name.as_str()).collect();

                    // 중첩 그룹만 details에 포함
                    let mut details = serde_json::Map::new();
                    for e in &children {
                        if matches!(e.entity_type, EntityType::Group) {
                            details.insert(
                                e.metadata.name.clone(),
                                serde_json::json!({
                                    "type": "Group",
                                    "children": e.children.len()
                                }),
                            );
                        }
                    }

                    serde_json::json!({
                        "level": format!("group:{}", group_name),
                        "order": order,
                        "details": details
                    })
                    .to_string()
                }
                _ => serde_json::json!({
                    "error": format!("'{}' is not a valid group", group_name)
                })
                .to_string(),
            }
        }
    }

    /// 이름으로 Entity를 조회하여 전체 JSON을 반환합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * Some(JSON) - Entity가 존재하면 전체 JSON 반환
    /// * None - Entity가 없으면 None
    ///
    /// # Examples
    /// ```ignore
    /// if let Some(json) = scene.get_entity("head") {
    ///     // {"id":"...","entity_type":"Circle",...}
    /// }
    /// ```
    pub fn get_entity(&self, name: &str) -> Option<String> {
        self.find_by_name(name)
            .map(|entity| serde_json::to_string(entity).unwrap_or_else(|_| "{}".to_string()))
    }

    /// Entity의 상세 정보를 local/world 좌표 포함하여 반환합니다 (FR42).
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * Some(JSON) - local/world 좌표 포함 상세 정보
    /// * None - Entity가 없으면 None
    ///
    /// # JSON Format
    /// ```json
    /// {
    ///   "name": "house1_wall",
    ///   "type": "Rect",
    ///   "parent": "house1",
    ///   "local": {
    ///     "geometry": {...},
    ///     "transform": {...},
    ///     "bounds": {"min": [x, y], "max": [x, y]}
    ///   },
    ///   "world": {
    ///     "bounds": {"min_x": ..., "min_y": ..., "max_x": ..., "max_y": ...},
    ///     "center": [x, y]
    ///   }
    /// }
    /// ```
    pub fn get_entity_detailed(&self, name: &str) -> Option<String> {
        let entity = self.find_by_name(name)?;

        // Calculate local bounds from geometry
        let local_bounds = Self::geometry_bounds(&entity.geometry);

        // Get world bounds
        let world_bounds = self.get_world_bounds_internal(name);

        // Calculate world center from pivot (not bounds center)
        // pivot is the center point for transformations
        let world_center = self
            .get_world_transform_internal(name)
            .map(|matrix| Transform::transform_point(&matrix, entity.transform.pivot));

        // Build response
        let response = serde_json::json!({
            "name": entity.metadata.name,
            "type": entity.entity_type.as_str(),
            "parent": entity.parent_id,
            "local": {
                "geometry": entity.geometry,
                "transform": entity.transform,
                "bounds": {
                    "min": local_bounds.0,
                    "max": local_bounds.1
                },
                "pivot": entity.transform.pivot
            },
            "world": match world_bounds {
                Some((min, max)) => serde_json::json!({
                    "bounds": {
                        "min_x": min[0],
                        "min_y": min[1],
                        "max_x": max[0],
                        "max_y": max[1]
                    },
                    "center": world_center.unwrap_or([(min[0] + max[0]) / 2.0, (min[1] + max[1]) / 2.0])
                }),
                None => serde_json::Value::Null
            },
            "style": entity.style,
            "children": if entity.children.is_empty() { serde_json::Value::Null } else { serde_json::json!(entity.children) },
            "z_order": entity.metadata.z_index
        });

        Some(serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string()))
    }

    /// Scene의 전체 정보를 반환합니다.
    ///
    /// # Returns
    /// JSON 객체: {"name": "scene-name", "entity_count": 5, "bounds": {"min": [x,y], "max": [x,y]}}
    /// bounds가 null이면 Scene이 비어있음
    ///
    /// # Examples
    /// ```ignore
    /// let info = scene.get_scene_info();
    /// // {"name":"my-scene","entity_count":2,"bounds":{"min":[0,0],"max":[100,100]}}
    /// ```
    pub fn get_scene_info(&self) -> String {
        let bounds = self.calculate_bounds();

        let bounds_json = match bounds {
            Some((min, max)) => serde_json::json!({
                "min": min,
                "max": max
            }),
            None => serde_json::Value::Null,
        };

        let last_op_json = match &self.last_operation {
            Some(op) => serde_json::Value::String(op.clone()),
            None => serde_json::Value::Null,
        };

        serde_json::to_string(&serde_json::json!({
            "name": self.name,
            "entity_count": self.entities.len(),
            "bounds": bounds_json,
            "last_operation": last_op_json
        }))
        .unwrap_or_else(|_| "{}".to_string())
    }

    // ========================================
    // World Transform API (Phase 2)
    // ========================================

    /// Entity의 월드 변환 행렬을 반환합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * Some(JSON) - 3x3 행렬 JSON: [[a, b, tx], [c, d, ty], [0, 0, 1]]
    /// * None - Entity가 없으면 None
    ///
    /// # 변환 상속
    /// 부모 그룹의 변환이 자식에게 상속됩니다.
    /// 반환되는 행렬은 모든 조상의 변환이 결합된 최종 월드 변환입니다.
    pub fn get_world_transform(&self, name: &str) -> Option<String> {
        let matrix = self.get_world_transform_internal(name)?;
        Some(
            serde_json::to_string(&matrix)
                .unwrap_or_else(|e| format!(r#"{{"error":"serialization failed: {}"}}"#, e)),
        )
    }

    /// 로컬 좌표를 월드 좌표로 변환합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름 (이 엔티티의 좌표계 기준)
    /// * `x` - 로컬 x 좌표
    /// * `y` - 로컬 y 좌표
    ///
    /// # Returns
    /// * Some(JSON) - 월드 좌표: {"x": ..., "y": ...}
    /// * None - Entity가 없으면 None
    pub fn get_world_point(&self, name: &str, x: f64, y: f64) -> Option<String> {
        let matrix = self.get_world_transform_internal(name)?;
        let world_point = Transform::transform_point(&matrix, [x, y]);
        Some(
            serde_json::to_string(&serde_json::json!({
                "x": world_point[0],
                "y": world_point[1]
            }))
            .unwrap_or_else(|e| format!(r#"{{"error":"serialization failed: {}"}}"#, e)),
        )
    }

    /// Entity의 월드 좌표 바운딩 박스를 반환합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * Some(JSON) - {"min": [x, y], "max": [x, y]}
    /// * None - Entity가 없거나 빈 그룹이면 None
    ///
    /// # Notes
    /// 변환(translate, rotate, scale)이 적용된 최종 월드 좌표 바운드입니다.
    /// 그룹의 경우 모든 자식의 바운드를 포함합니다.
    pub fn get_world_bounds(&self, name: &str) -> Option<String> {
        let (min, max) = self.get_world_bounds_internal(name)?;
        Some(
            serde_json::to_string(&serde_json::json!({
                "min": min,
                "max": max
            }))
            .unwrap_or_else(|_| "{}".to_string()),
        )
    }

    /// Entity가 존재하는지 확인합니다.
    ///
    /// # Arguments
    /// * `name` - Entity 이름
    ///
    /// # Returns
    /// * true - Entity 존재
    /// * false - Entity 없음
    pub fn exists(&self, name: &str) -> bool {
        self.has_entity(name)
    }
}

#[cfg(test)]
mod tests {
    use super::Scene;
    use crate::scene::entity::Transform;

    fn approx_eq(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    // ========================================
    // World Transform Tests (Phase 2)
    // ========================================

    #[test]
    fn test_world_transform_no_parent() {
        let mut scene = Scene::new("test");
        scene.add_rect_internal("r1", 0.0, 0.0, 10.0, 10.0).unwrap();
        scene.find_by_name_mut("r1").unwrap().transform.translate = [5.0, 10.0];

        let matrix = scene.get_world_transform_internal("r1").unwrap();
        assert!(approx_eq(matrix[0][2], 5.0, 1e-10));
        assert!(approx_eq(matrix[1][2], 10.0, 1e-10));
    }

    #[test]
    fn test_world_transform_with_parent() {
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 5.0).unwrap();
        scene
            .create_group_internal("g1", vec!["c1".to_string()])
            .unwrap();

        scene.find_by_name_mut("g1").unwrap().transform.translate = [10.0, 20.0];

        let matrix = scene.get_world_transform_internal("c1").unwrap();
        assert!(approx_eq(matrix[0][2], 10.0, 1e-10));
        assert!(approx_eq(matrix[1][2], 20.0, 1e-10));
    }

    #[test]
    fn test_world_transform_nested_groups() {
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 5.0).unwrap();
        scene
            .create_group_internal("parent", vec!["c1".to_string()])
            .unwrap();
        scene
            .create_group_internal("grandparent", vec!["parent".to_string()])
            .unwrap();

        scene
            .find_by_name_mut("grandparent")
            .unwrap()
            .transform
            .translate = [100.0, 0.0];
        scene
            .find_by_name_mut("parent")
            .unwrap()
            .transform
            .translate = [0.0, 50.0];

        let matrix = scene.get_world_transform_internal("c1").unwrap();
        assert!(approx_eq(matrix[0][2], 100.0, 1e-10));
        assert!(approx_eq(matrix[1][2], 50.0, 1e-10));
    }

    #[test]
    fn test_world_transform_with_rotation() {
        use std::f64::consts::PI;

        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 5.0).unwrap();
        scene
            .create_group_internal("g1", vec!["c1".to_string()])
            .unwrap();

        scene.find_by_name_mut("g1").unwrap().transform.rotate = PI / 2.0;
        scene.find_by_name_mut("c1").unwrap().transform.translate = [10.0, 0.0];

        let matrix = scene.get_world_transform_internal("c1").unwrap();
        let world_origin = Transform::transform_point(&matrix, [0.0, 0.0]);
        assert!(approx_eq(world_origin[0], 0.0, 1e-10));
        assert!(approx_eq(world_origin[1], 10.0, 1e-10));
    }

    #[test]
    fn test_world_bounds_simple() {
        let mut scene = Scene::new("test");
        scene.add_rect_internal("r1", 0.0, 0.0, 10.0, 20.0).unwrap();

        let (min, max) = scene.get_world_bounds_internal("r1").unwrap();
        assert!(approx_eq(min[0], -5.0, 1e-10));
        assert!(approx_eq(min[1], -10.0, 1e-10));
        assert!(approx_eq(max[0], 5.0, 1e-10));
        assert!(approx_eq(max[1], 10.0, 1e-10));
    }

    #[test]
    fn test_world_bounds_with_translate() {
        let mut scene = Scene::new("test");
        scene.add_rect_internal("r1", 0.0, 0.0, 10.0, 20.0).unwrap();
        scene.find_by_name_mut("r1").unwrap().transform.translate = [5.0, 10.0];

        let (min, max) = scene.get_world_bounds_internal("r1").unwrap();
        assert!(approx_eq(min[0], 0.0, 1e-10));
        assert!(approx_eq(min[1], 0.0, 1e-10));
        assert!(approx_eq(max[0], 10.0, 1e-10));
        assert!(approx_eq(max[1], 20.0, 1e-10));
    }

    #[test]
    fn test_world_bounds_group() {
        let mut scene = Scene::new("test");
        scene.add_rect_internal("r1", 5.0, 5.0, 10.0, 10.0).unwrap();
        scene.add_circle_internal("c1", 50.0, 50.0, 5.0).unwrap();
        scene
            .create_group_internal("g1", vec!["r1".to_string(), "c1".to_string()])
            .unwrap();

        let (min, max) = scene.get_world_bounds_internal("g1").unwrap();
        assert!(approx_eq(min[0], 0.0, 1e-10));
        assert!(approx_eq(min[1], 0.0, 1e-10));
        assert!(approx_eq(max[0], 55.0, 1e-10));
        assert!(approx_eq(max[1], 55.0, 1e-10));
    }

    #[test]
    fn test_get_world_point() {
        use std::f64::consts::PI;

        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 5.0).unwrap();
        scene
            .create_group_internal("g1", vec!["c1".to_string()])
            .unwrap();

        scene.find_by_name_mut("g1").unwrap().transform.rotate = PI / 2.0;
        scene.find_by_name_mut("g1").unwrap().transform.translate = [10.0, 0.0];

        let json = scene.get_world_point("c1", 5.0, 0.0).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        let x = value.get("x").unwrap().as_f64().unwrap();
        let y = value.get("y").unwrap().as_f64().unwrap();
        assert!(approx_eq(x, 10.0, 1e-10));
        assert!(approx_eq(y, 5.0, 1e-10));
    }

    #[test]
    fn test_exists() {
        let mut scene = Scene::new("test");
        scene.add_circle_internal("c1", 0.0, 0.0, 5.0).unwrap();

        assert!(scene.exists("c1"));
        assert!(!scene.exists("nonexistent"));
    }
}
