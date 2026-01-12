use std::fmt;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

pub mod entity;
mod groups;
mod path_parser;
mod primitives;
mod query;
pub mod style;
mod transforms;
mod z_order;

use crate::serializers::json::serialize_scene;
use crate::serializers::svg::serialize_scene_svg;
use entity::{Entity, EntityType, Geometry, Matrix3x3, Metadata, Style, Transform};
pub use style::{FillStyle, LineCap, LineJoin, StrokeStyle};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum SceneError {
    DuplicateEntityName(String, String), // (fn_name, entity_name)
    InvalidInput(String),
    NotAGroup(String, String), // (fn_name, entity_name)
    InvalidOperation(String),  // 순환 참조 등 유효하지 않은 작업
}

impl fmt::Display for SceneError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SceneError::DuplicateEntityName(fn_name, name) => {
                write!(
                    f,
                    "[{}] duplicate_name: Entity '{}' already exists",
                    fn_name, name
                )
            }
            SceneError::InvalidInput(msg) => {
                write!(f, "{}", msg)
            }
            SceneError::NotAGroup(fn_name, name) => {
                write!(
                    f,
                    "[{}] not_a_group: Entity '{}' is not a Group",
                    fn_name, name
                )
            }
            SceneError::InvalidOperation(msg) => {
                write!(f, "invalid_operation: {}", msg)
            }
        }
    }
}

impl std::error::Error for SceneError {}

#[wasm_bindgen]
pub struct Scene {
    name: String,
    entities: Vec<Entity>,
    /// 마지막 실행된 작업 (LLM 작업 추적용)
    last_operation: Option<String>,
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

    fn find_by_name_mut(&mut self, name: &str) -> Option<&mut Entity> {
        self.entities
            .iter_mut()
            .find(|entity| entity.metadata.name == name)
    }

    fn has_entity(&self, name: &str) -> bool {
        self.find_by_name(name).is_some()
    }

    fn add_entity_internal(
        &mut self,
        fn_name: &str,
        name: &str,
        entity_type: EntityType,
        geometry: Geometry,
    ) -> Result<String, SceneError> {
        if self.has_entity(name) {
            return Err(SceneError::DuplicateEntityName(
                fn_name.to_string(),
                name.to_string(),
            ));
        }

        // Calculate geometry center for default pivot
        let (min, max) = Self::geometry_bounds(&geometry);
        let pivot = [(min[0] + max[0]) / 2.0, (min[1] + max[1]) / 2.0];

        // Auto-increment z_order (0 = bottom, higher = front)
        let z_order = self.allocate_z_order();

        let entity = Entity {
            id: generate_id(),
            entity_type,
            geometry,
            transform: Transform {
                pivot,
                ..Transform::default()
            },
            style: Style::default(),
            metadata: Metadata {
                name: name.to_string(),
                z_index: z_order,
                ..Default::default()
            },
            parent_id: None,
            children: Vec::new(),
        };

        self.entities.push(entity);
        Ok(name.to_string())
    }

    // Primitive creation helpers: add_line_internal, add_circle_internal, add_rect_internal, add_arc_internal
    // See primitives.rs for implementations

    /// Set pivot point for an entity (internal, for native testing)
    fn set_pivot_internal(&mut self, name: &str, px: f64, py: f64) -> Result<bool, SceneError> {
        // Validate finite values
        if !px.is_finite() || !py.is_finite() {
            return Err(SceneError::InvalidInput(
                "[set_pivot] invalid_input: Pivot coordinates must be finite numbers".to_string(),
            ));
        }

        let entity = match self.find_by_name_mut(name) {
            Some(e) => e,
            None => return Ok(false),
        };

        entity.transform.pivot = [px, py];
        self.last_operation = Some(format!("set_pivot({}, [{}, {}])", name, px, py));
        Ok(true)
    }
}

#[wasm_bindgen]
impl Scene {
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str) -> Scene {
        Scene {
            name: name.to_string(),
            entities: Vec::new(),
            last_operation: None,
        }
    }

    /// 다음 z_order 값을 반환 (root level max + 1 기준)
    ///
    /// 기존 global counter 대신 현재 root level의 최대 z-index + 1을 반환합니다.
    /// 이렇게 하면 그룹 생성 시 정규화와 일관성을 유지하고 갭 발생을 최소화합니다.
    fn allocate_z_order(&mut self) -> i32 {
        let max_root_z = self
            .entities
            .iter()
            .filter(|e| e.parent_id.is_none())
            .map(|e| e.metadata.z_index)
            .max()
            .unwrap_or(-1);
        max_root_z + 1
    }

    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    /// Scene을 JSON으로 내보냅니다.
    pub fn export_json(&self) -> String {
        serialize_scene(self)
    }

    /// Scene을 SVG로 내보냅니다.
    pub fn export_svg(&self) -> String {
        serialize_scene_svg(&self.entities)
    }

    // Primitives (add_*, draw_*): see primitives.rs

    // Style Functions: see style.rs
    // Transform Functions (translate, rotate, scale, translate_world, scale_world, delete, set_pivot): see transforms.rs
    // Z-Order: see z_order.rs
    // Group Functions (create_group, ungroup, add_to_group, remove_from_group): see groups.rs
    // Scene Query Functions, World Transform API: see query.rs
}

impl Scene {
    // ========================================
    // Serialization Helpers (non-wasm)
    // ========================================

    /// Entities slice getter (for serialization)
    pub fn entities(&self) -> &[Entity] {
        &self.entities
    }

    /// Scene name getter
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Last operation getter
    pub fn last_operation(&self) -> Option<&str> {
        self.last_operation.as_deref()
    }

    /// Entity의 월드 좌표 바운딩 박스 (직렬화용 public wrapper)
    pub fn get_world_bounds_for_entity(&self, name: &str) -> Option<([f64; 2], [f64; 2])> {
        self.get_world_bounds_internal(name)
    }

    /// Entity의 로컬 좌표 바운딩 박스 (geometry + entity transform, 부모 제외)
    pub fn get_local_bounds_for_entity(&self, name: &str) -> Option<([f64; 2], [f64; 2])> {
        let entity = self.find_by_name(name)?;

        // Group은 자식들의 로컬 바운드 합산 (각 자식의 transform 포함)
        if matches!(entity.entity_type, EntityType::Group) {
            if entity.children.is_empty() {
                return None;
            }

            let mut min_x = f64::INFINITY;
            let mut min_y = f64::INFINITY;
            let mut max_x = f64::NEG_INFINITY;
            let mut max_y = f64::NEG_INFINITY;

            for child_name in &entity.children {
                if let Some(child) = self.find_by_name(child_name) {
                    let child_matrix = child.transform.to_matrix();
                    let local_vertices = Self::geometry_vertices(&child.geometry);

                    for vertex in local_vertices {
                        let transformed = Transform::transform_point(&child_matrix, vertex);
                        min_x = min_x.min(transformed[0]);
                        min_y = min_y.min(transformed[1]);
                        max_x = max_x.max(transformed[0]);
                        max_y = max_y.max(transformed[1]);
                    }
                }
            }

            if min_x == f64::INFINITY {
                return None;
            }
            return Some(([min_x, min_y], [max_x, max_y]));
        }

        // 일반 도형: geometry + entity transform (부모 transform 제외)
        let local_vertices = Self::geometry_vertices(&entity.geometry);
        if local_vertices.is_empty() {
            return None;
        }

        let entity_matrix = entity.transform.to_matrix();
        let mut min_x = f64::INFINITY;
        let mut min_y = f64::INFINITY;
        let mut max_x = f64::NEG_INFINITY;
        let mut max_y = f64::NEG_INFINITY;

        for vertex in local_vertices {
            let transformed = Transform::transform_point(&entity_matrix, vertex);
            min_x = min_x.min(transformed[0]);
            min_y = min_y.min(transformed[1]);
            max_x = max_x.max(transformed[0]);
            max_y = max_y.max(transformed[1]);
        }

        Some(([min_x, min_y], [max_x, max_y]))
    }

    // ========================================
    // World Transform Functions (Phase 2)
    // ========================================

    /// Entity의 부모 체인을 수집합니다 (루트부터 순서대로)
    ///
    /// 순환 참조 방지를 위해 최대 100단계까지만 탐색합니다.
    fn collect_parent_chain(&self, name: &str) -> Vec<&Entity> {
        use std::collections::HashSet;
        const MAX_DEPTH: usize = 100;

        let mut chain = Vec::new();
        let mut visited = HashSet::new();
        let mut current_name = Some(name.to_string());
        let mut depth = 0;

        while let Some(ref n) = current_name {
            // 순환 참조 또는 깊이 제한 도달 시 중단
            if visited.contains(n) || depth >= MAX_DEPTH {
                break;
            }
            visited.insert(n.clone());

            if let Some(entity) = self.find_by_name(n) {
                chain.push(entity);
                current_name = entity.parent_id.clone();
                depth += 1;
            } else {
                break;
            }
        }

        // 루트부터 순서대로 (현재 엔티티가 마지막)
        chain.reverse();
        chain
    }

    /// Entity의 월드 변환 행렬을 계산합니다 (내부용)
    ///
    /// 부모 체인의 모든 변환을 결합하여 최종 월드 변환을 반환합니다.
    /// 변환은 루트부터 적용됩니다: parent1 * parent2 * ... * entity
    fn get_world_transform_internal(&self, name: &str) -> Option<Matrix3x3> {
        let chain = self.collect_parent_chain(name);
        if chain.is_empty() {
            return None;
        }

        // 루트부터 차례대로 변환 결합
        let mut world_matrix = Transform::identity_matrix();
        for entity in chain {
            let local_matrix = entity.transform.to_matrix();
            world_matrix = Transform::multiply_matrices(&world_matrix, &local_matrix);
        }

        Some(world_matrix)
    }

    /// Geometry의 로컬 정점들을 반환합니다
    fn geometry_vertices(geometry: &Geometry) -> Vec<[f64; 2]> {
        match geometry {
            Geometry::Line { points } => points.clone(),
            Geometry::Circle { center, radius } => {
                // 원은 4개 극점으로 근사
                vec![
                    [center[0] - radius, center[1]],
                    [center[0] + radius, center[1]],
                    [center[0], center[1] - radius],
                    [center[0], center[1] + radius],
                ]
            }
            Geometry::Rect {
                center,
                width,
                height,
            } => {
                // 사각형 4개 꼭짓점 (center 기준)
                let hw = width / 2.0;
                let hh = height / 2.0;
                vec![
                    [center[0] - hw, center[1] - hh],
                    [center[0] + hw, center[1] - hh],
                    [center[0] + hw, center[1] + hh],
                    [center[0] - hw, center[1] + hh],
                ]
            }
            Geometry::Arc { center, radius, .. } => {
                // Arc도 보수적으로 원 극점 사용
                vec![
                    [center[0] - radius, center[1]],
                    [center[0] + radius, center[1]],
                    [center[0], center[1] - radius],
                    [center[0], center[1] + radius],
                ]
            }
            Geometry::Polygon { points, .. } => points.clone(),
            Geometry::Bezier {
                start, segments, ..
            } => {
                // 베지어 커브는 모든 제어점과 끝점을 포함
                let mut vertices = vec![*start];
                for seg in segments {
                    vertices.push(seg[0]); // cp1
                    vertices.push(seg[1]); // cp2
                    vertices.push(seg[2]); // end
                }
                vertices
            }
            Geometry::Empty => vec![],
        }
    }

    /// Entity의 월드 좌표 바운딩 박스를 계산합니다 (내부용)
    fn get_world_bounds_internal(&self, name: &str) -> Option<([f64; 2], [f64; 2])> {
        let entity = self.find_by_name(name)?;
        let world_matrix = self.get_world_transform_internal(name)?;

        // Group인 경우 자식들의 바운드를 재귀적으로 계산
        if matches!(entity.entity_type, EntityType::Group) {
            if entity.children.is_empty() {
                return None;
            }

            let mut min_x = f64::INFINITY;
            let mut min_y = f64::INFINITY;
            let mut max_x = f64::NEG_INFINITY;
            let mut max_y = f64::NEG_INFINITY;

            for child_name in &entity.children {
                if let Some((child_min, child_max)) = self.get_world_bounds_internal(child_name) {
                    min_x = min_x.min(child_min[0]);
                    min_y = min_y.min(child_min[1]);
                    max_x = max_x.max(child_max[0]);
                    max_y = max_y.max(child_max[1]);
                }
            }

            if min_x == f64::INFINITY {
                return None;
            }
            return Some(([min_x, min_y], [max_x, max_y]));
        }

        // 일반 도형: 로컬 정점들을 월드 좌표로 변환
        let local_vertices = Self::geometry_vertices(&entity.geometry);
        if local_vertices.is_empty() {
            return None;
        }

        let mut min_x = f64::INFINITY;
        let mut min_y = f64::INFINITY;
        let mut max_x = f64::NEG_INFINITY;
        let mut max_y = f64::NEG_INFINITY;

        for vertex in local_vertices {
            let world_point = Transform::transform_point(&world_matrix, vertex);
            min_x = min_x.min(world_point[0]);
            min_y = min_y.min(world_point[1]);
            max_x = max_x.max(world_point[0]);
            max_y = max_y.max(world_point[1]);
        }

        Some(([min_x, min_y], [max_x, max_y]))
    }

    /// Scene의 전체 bounding box를 계산합니다.
    ///
    /// # Returns
    /// * Some((min, max)) - Entity가 있으면 [min_x, min_y], [max_x, max_y]
    /// * None - Scene이 비어있으면 None
    fn calculate_bounds(&self) -> Option<([f64; 2], [f64; 2])> {
        if self.entities.is_empty() {
            return None;
        }

        let mut min_x = f64::INFINITY;
        let mut min_y = f64::INFINITY;
        let mut max_x = f64::NEG_INFINITY;
        let mut max_y = f64::NEG_INFINITY;

        for entity in &self.entities {
            let (entity_min, entity_max) = Self::geometry_bounds(&entity.geometry);

            min_x = min_x.min(entity_min[0]);
            min_y = min_y.min(entity_min[1]);
            max_x = max_x.max(entity_max[0]);
            max_y = max_y.max(entity_max[1]);
        }

        Some(([min_x, min_y], [max_x, max_y]))
    }

    /// Geometry의 bounding box를 계산합니다.
    fn geometry_bounds(geometry: &Geometry) -> ([f64; 2], [f64; 2]) {
        match geometry {
            Geometry::Line { points } => {
                let mut min_x = f64::INFINITY;
                let mut min_y = f64::INFINITY;
                let mut max_x = f64::NEG_INFINITY;
                let mut max_y = f64::NEG_INFINITY;

                for point in points {
                    min_x = min_x.min(point[0]);
                    min_y = min_y.min(point[1]);
                    max_x = max_x.max(point[0]);
                    max_y = max_y.max(point[1]);
                }

                ([min_x, min_y], [max_x, max_y])
            }
            Geometry::Circle { center, radius } => (
                [center[0] - radius, center[1] - radius],
                [center[0] + radius, center[1] + radius],
            ),
            Geometry::Rect {
                center,
                width,
                height,
            } => (
                [center[0] - width / 2.0, center[1] - height / 2.0],
                [center[0] + width / 2.0, center[1] + height / 2.0],
            ),
            Geometry::Arc { center, radius, .. } => {
                // Arc는 보수적으로 전체 원의 bounding box 사용
                (
                    [center[0] - radius, center[1] - radius],
                    [center[0] + radius, center[1] + radius],
                )
            }
            Geometry::Polygon { points, .. } => {
                // holes는 bounds 계산에 영향 없음 (outer points만 사용)
                let mut min_x = f64::INFINITY;
                let mut min_y = f64::INFINITY;
                let mut max_x = f64::NEG_INFINITY;
                let mut max_y = f64::NEG_INFINITY;

                for point in points {
                    min_x = min_x.min(point[0]);
                    min_y = min_y.min(point[1]);
                    max_x = max_x.max(point[0]);
                    max_y = max_y.max(point[1]);
                }

                ([min_x, min_y], [max_x, max_y])
            }
            Geometry::Bezier {
                start, segments, ..
            } => {
                // 베지어 커브: 모든 제어점과 끝점의 bounds
                let mut min_x = start[0];
                let mut min_y = start[1];
                let mut max_x = start[0];
                let mut max_y = start[1];

                for seg in segments {
                    for point in seg {
                        min_x = min_x.min(point[0]);
                        min_y = min_y.min(point[1]);
                        max_x = max_x.max(point[0]);
                        max_y = max_y.max(point[1]);
                    }
                }

                ([min_x, min_y], [max_x, max_y])
            }
            Geometry::Empty => {
                // Group은 자체 geometry가 없으므로 영점 반환 (자식 bounds는 별도 계산)
                ([0.0, 0.0], [0.0, 0.0])
            }
        }
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
    fn test_export_json_empty_scene() {
        let scene = Scene::new("empty");
        let json = scene.export_json();
        let value: serde_json::Value = serde_json::from_str(&json).expect("valid JSON");

        assert!(value.get("name").is_none());
        let entities = value
            .get("entities")
            .and_then(|v| v.as_array())
            .expect("entities array");
        assert!(entities.is_empty());
    }

    #[test]
    fn test_export_json_with_entities() {
        let mut scene = Scene::new("skeleton");
        scene
            .add_circle_internal("head", 0.0, 100.0, 10.0)
            .expect("circle should succeed");
        scene
            .add_line_internal("spine", vec![0.0, 90.0, 0.0, 50.0])
            .expect("line should succeed");

        let json = scene.export_json();
        let value: serde_json::Value = serde_json::from_str(&json).expect("valid JSON");

        assert_eq!(value.get("name").and_then(|v| v.as_str()), Some("skeleton"));

        let entities = value
            .get("entities")
            .and_then(|v| v.as_array())
            .expect("entities array");
        assert_eq!(entities.len(), 2);

        let circle = &entities[0];
        assert!(
            circle
                .get("id")
                .and_then(|v| v.as_str())
                .map(|id| !id.is_empty())
                .unwrap_or(false)
        );
        assert_eq!(
            circle.get("entity_type").and_then(|v| v.as_str()),
            Some("Circle")
        );
        assert!(
            circle
                .get("geometry")
                .and_then(|g| g.get("Circle"))
                .is_some()
        );
        assert!(circle.get("transform").is_some());

        let line = &entities[1];
        assert_eq!(
            line.get("entity_type").and_then(|v| v.as_str()),
            Some("Line")
        );
        assert!(line.get("geometry").and_then(|g| g.get("Line")).is_some());
        assert!(line.get("transform").is_some());
    }

    #[test]
    fn test_add_entity_returns_name() {
        let mut scene = Scene::new("test");
        let name = scene
            .add_entity_internal("add_entity", "head", EntityType::Line, sample_geometry())
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
            .add_entity_internal("add_entity", "head", EntityType::Line, sample_geometry())
            .expect("first add_entity should succeed");

        let err = scene
            .add_entity_internal("add_entity", "head", EntityType::Line, sample_geometry())
            .expect_err("duplicate name should error");
        assert_eq!(
            err.to_string(),
            "[add_entity] duplicate_name: Entity 'head' already exists"
        );
        assert!(matches!(
            err,
            SceneError::DuplicateEntityName(fn_name, name) if fn_name == "add_entity" && name == "head"
        ));
    }

    // set_pivot tests: see transforms.rs
    // world transform tests: see query.rs
}
